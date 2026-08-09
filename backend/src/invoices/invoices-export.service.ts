import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { Workbook } from 'exceljs';
import { Parser } from 'json2csv';

export interface InvoiceExportFilters {
  status?: InvoiceStatus;
  startDate?: string;
  endDate?: string;
}

/**
 * Flat, export-ready shape of a single invoice row. Kept separate from the
 * `Invoice` entity so the CSV/Excel field lists can't drift out of sync
 * with each other — see `EXPORT_FIELDS` below, the single source both
 * formats are built from.
 */
interface InvoiceExportRow {
  id: string;
  invoiceNumber: string;
  user: string;
  email: string;
  bookingId: string;
  // Naira, not kobo — but crucially NOT pre-formatted with a currency
  // symbol. The original hardcoded "₦" regardless of the invoice's actual
  // `currency` field, which is actively wrong for any non-NGN invoice (and
  // the entity clearly anticipates non-NGN invoices, since it has its own
  // currency column). Currency is its own separate export field instead.
  amount: number | '';
  currency: string;
  status: string;
  paidAt: Date | '';
  createdAt: Date | '';
}

// Guards against a single export request loading an unbounded number of
// rows into memory. Raise if you need larger exports, alongside switching
// to a streaming CSV writer and ExcelJS's streaming workbook writer.
const MAX_EXPORT_ROWS = 50_000;

const EXPORT_FIELDS: { key: keyof InvoiceExportRow; header: string; width: number }[] = [
  { key: 'id', header: 'ID', width: 38 },
  { key: 'invoiceNumber', header: 'Invoice #', width: 18 },
  { key: 'user', header: 'User', width: 25 },
  { key: 'email', header: 'Email', width: 28 },
  { key: 'bookingId', header: 'Booking ID', width: 38 },
  { key: 'amount', header: 'Amount', width: 15 },
  { key: 'currency', header: 'Currency', width: 10 },
  { key: 'status', header: 'Status', width: 12 },
  { key: 'paidAt', header: 'Paid At', width: 22 },
  { key: 'createdAt', header: 'Created At', width: 22 },
];

@Injectable()
export class InvoicesExportService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoicesRepository: Repository<Invoice>,
  ) {}

  private buildFilteredQuery(filters?: InvoiceExportFilters) {
    const { startDate, endDate } = this.parseDateRange(filters);

    const qb = this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.user', 'user')
      .leftJoinAndSelect('invoice.booking', 'booking')
      .select([
        'invoice',
        'user.id',
        'user.firstname',
        'user.lastname',
        'user.email',
        'booking.id',
      ]);

    if (filters?.status) {
      if (!Object.values(InvoiceStatus).includes(filters.status)) {
        throw new BadRequestException(
          `Invalid status filter "${filters.status}". Expected one of: ${Object.values(
            InvoiceStatus,
          ).join(', ')}`,
        );
      }
      qb.andWhere('invoice.status = :status', { status: filters.status });
    }

    if (startDate) {
      qb.andWhere('invoice.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      qb.andWhere('invoice.createdAt <= :endDate', { endDate });
    }

    qb.orderBy('invoice.createdAt', 'DESC');
    return qb;
  }

  /**
   * Validates and parses the raw string date filters up front, so a
   * malformed date fails fast with a clear 400 instead of either silently
   * matching zero rows or bubbling a raw database error to the client.
   */
  private parseDateRange(filters?: InvoiceExportFilters): {
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

  private async findInvoices(filters?: InvoiceExportFilters): Promise<Invoice[]> {
    const qb = this.buildFilteredQuery(filters);

    const count = await qb.getCount();
    if (count > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `This export would contain ${count} rows, which exceeds the ${MAX_EXPORT_ROWS}-row limit. Narrow your filters (date range or status) and try again.`,
      );
    }

    return qb.getMany();
  }

  private mapInvoice(inv: Invoice): InvoiceExportRow {
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      user: inv.user ? `${inv.user.firstname} ${inv.user.lastname}`.trim() : '',
      email: inv.user?.email ?? '',
      bookingId: inv.bookingId ?? '',
      amount: typeof inv.amountKobo === 'number' ? inv.amountKobo / 100 : '',
      currency: inv.currency,
      status: inv.status,
      paidAt: inv.paidAt ?? '',
      createdAt: inv.createdAt ?? '',
    };
  }

  async exportInvoicesCsv(filters?: InvoiceExportFilters): Promise<Buffer> {
    const invoices = await this.findInvoices(filters);
    const data = invoices.map((inv) => this.mapInvoice(inv));

    // CSV has no native date type, so convert Date -> ISO string only at
    // this boundary — the shared InvoiceExportRow keeps real Dates so the
    // Excel export (below) can use them natively.
    const csvRows = data.map((row) => ({
      ...row,
      paidAt: row.paidAt instanceof Date ? row.paidAt.toISOString() : '',
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : '',
    }));

    const parser = new Parser<Record<string, unknown>>({
      fields: EXPORT_FIELDS.map((f) => f.key),
    });

    if (csvRows.length === 0) {
      const header = EXPORT_FIELDS.map((f) => f.header).join(',');
      return Buffer.from(`${header}\n`, 'utf-8');
    }

    return Buffer.from(parser.parse(csvRows), 'utf-8');
  }

  async exportInvoicesExcel(filters?: InvoiceExportFilters): Promise<Buffer> {
    const invoices = await this.findInvoices(filters);

    const workbook = new Workbook();
    workbook.creator = 'BeaconPay';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Invoices');
    sheet.columns = EXPORT_FIELDS.map((f) => ({
      header: f.header,
      key: f.key,
      width: f.width,
    }));

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: EXPORT_FIELDS.length },
    };

    // Real number formatting (not a pre-baked currency-symbol string) so
    // the column is summable/sortable — but unlike a single-currency
    // export, this does NOT hardcode a symbol, since invoices can be in
    // different currencies (that's what the separate `currency` column is
    // for). Plain thousands-separated number with 2 decimal places.
    const amountColumn = sheet.getColumn('amount');
    amountColumn.numFmt = '#,##0.00';
    amountColumn.alignment = { horizontal: 'right' };

    // Real Excel date columns instead of ISO-string text, so recipients
    // can sort/filter chronologically and apply their own date formatting.
    const dateFormat = 'yyyy-mm-dd hh:mm';
    sheet.getColumn('paidAt').numFmt = dateFormat;
    sheet.getColumn('createdAt').numFmt = dateFormat;

    invoices.forEach((inv) => {
      sheet.addRow(this.mapInvoice(inv));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}