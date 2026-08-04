import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Workbook } from 'exceljs';
import { Parser } from 'json2csv';

export interface BookingExportFilters {
  startDate?: string;
  endDate?: string;
  status?: BookingStatus;
}

/**
 * Flat, export-ready shape of a single booking row. Kept separate from the
 * `Booking` entity so CSV/Excel field lists and this interface can't drift
 * out of sync with each other (see `EXPORT_FIELDS` below).
 */
interface BookingExportRow {
  id: string;
  workspace: string;
  user: string;
  status: string;
  startDate: string;
  endDate: string;
  // Naira, not kobo, and NOT pre-formatted with a currency symbol — kept as
  // a real number so CSV/Excel consumers can sort, filter, and sum it.
  // Currency display is handled separately per-format (see numFmt in the
  // Excel export; CSV has no equivalent, so it's just a plain number there).
  amount: number | '';
}

// Guards against a single export request loading an unbounded number of
// rows into memory / blocking the event loop building the file. If you
// need to support larger exports, switch to a streaming CSV writer and
// ExcelJS's streaming workbook writer instead of raising this further.
const MAX_EXPORT_ROWS = 50_000;

const EXPORT_FIELDS: { key: keyof BookingExportRow; header: string; width: number }[] = [
  { key: 'id', header: 'ID', width: 38 },
  { key: 'workspace', header: 'Workspace', width: 25 },
  { key: 'user', header: 'User', width: 25 },
  { key: 'status', header: 'Status', width: 15 },
  { key: 'startDate', header: 'Start Date', width: 22 },
  { key: 'endDate', header: 'End Date', width: 22 },
  { key: 'amount', header: 'Amount (NGN)', width: 15 },
];

@Injectable()
export class BookingsExportService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
  ) {}

  private buildFilteredQuery(filters?: BookingExportFilters) {
    const { startDate, endDate } = this.parseDateRange(filters);

    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.workspace', 'workspace')
      .leftJoinAndSelect('booking.user', 'user')
      .select([
        'booking',
        'workspace.id',
        'workspace.name',
        'user.id',
        'user.firstname',
        'user.lastname',
        'user.email',
      ]);

    if (filters?.status) {
      if (!Object.values(BookingStatus).includes(filters.status)) {
        throw new BadRequestException(
          `Invalid status filter "${filters.status}". Expected one of: ${Object.values(
            BookingStatus,
          ).join(', ')}`,
        );
      }
      qb.andWhere('booking.status = :status', { status: filters.status });
    }

    if (startDate) {
      qb.andWhere('booking.startDate >= :startDate', { startDate });
    }

    if (endDate) {
      qb.andWhere('booking.endDate <= :endDate', { endDate });
    }

    qb.orderBy('booking.createdAt', 'DESC');
    return qb;
  }

  /**
   * Validates and parses the raw string date filters up front, so a
   * malformed date (typo, wrong format, garbage input) fails fast with a
   * clear 400 instead of either silently matching zero rows or bubbling a
   * raw database error out to the client.
   */
  private parseDateRange(filters?: BookingExportFilters): {
    startDate?: Date;
    endDate?: Date;
  } {
    const startDate = filters?.startDate ? new Date(filters.startDate) : undefined;
    const endDate = filters?.endDate ? new Date(filters.endDate) : undefined;

    if (startDate && Number.isNaN(startDate.getTime())) {
      throw new BadRequestException(`Invalid startDate: "${filters!.startDate}"`);
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BadRequestException(`Invalid endDate: "${filters!.endDate}"`);
    }
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }

    return { startDate, endDate };
  }

  private async findBookings(filters?: BookingExportFilters): Promise<Booking[]> {
    const qb = this.buildFilteredQuery(filters);

    // Count before fetching so an oversized export fails immediately
    // instead of after paying the cost of loading everything into memory.
    const count = await qb.getCount();
    if (count > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `This export would contain ${count} rows, which exceeds the ${MAX_EXPORT_ROWS}-row limit. Narrow your filters (date range or status) and try again.`,
      );
    }

    return qb.getMany();
  }

  private mapBooking(b: Booking): BookingExportRow {
    return {
      id: b.id,
      workspace: b.workspace?.name ?? '',
      user: b.user ? `${b.user.firstname} ${b.user.lastname}`.trim() : '',
      status: b.status,
      startDate: b.startDate ?? '',
      endDate: b.endDate ?? '',
      amount: typeof b.totalAmount === 'number' ? b.totalAmount / 100 : '',
    };
  }

  async exportBookingsCsv(filters?: BookingExportFilters): Promise<Buffer> {
    const bookings = await this.findBookings(filters);
    const data = bookings.map((b) => this.mapBooking(b));

    const parser = new Parser<BookingExportRow>({
      fields: EXPORT_FIELDS.map((f) => f.key),
    });

    // json2csv's Parser.parse() throws on a genuinely empty array even
    // with fields configured in some versions — fall back to a
    // header-only CSV so an empty result set still downloads a valid,
    // openable file instead of throwing mid-request.
    if (data.length === 0) {
      const header = EXPORT_FIELDS.map((f) => f.header).join(',');
      return Buffer.from(`${header}\n`, 'utf-8');
    }

    return Buffer.from(parser.parse(data), 'utf-8');
  }

  async exportBookingsExcel(filters?: BookingExportFilters): Promise<Buffer> {
    const bookings = await this.findBookings(filters);

    const workbook = new Workbook();
    workbook.creator = 'BeaconPay';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Bookings');
    sheet.columns = EXPORT_FIELDS.map((f) => ({
      header: f.header,
      key: f.key,
      width: f.width,
    }));

    sheet.getRow(1).font = { bold: true };
    // Keeps the header visible while scrolling through a long export.
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    // Lets recipients filter/sort by status, date range, etc. in Excel
    // without having to manually turn on AutoFilter themselves.
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: EXPORT_FIELDS.length },
    };

    const amountColumn = sheet.getColumn('amount');
    // Real number formatting instead of a pre-baked "₦1,234.56" string —
    // this is what actually makes the column summable/sortable in Excel
    // while still displaying with the currency symbol and thousands
    // separators.
    amountColumn.numFmt = '"₦"#,##0.00';
    amountColumn.alignment = { horizontal: 'right' };

    bookings.forEach((b) => {
      sheet.addRow(this.mapBooking(b));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}