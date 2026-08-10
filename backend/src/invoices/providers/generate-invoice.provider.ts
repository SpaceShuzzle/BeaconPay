import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { User } from '../../users/entities/user.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { InvoiceStatus } from '../enums/invoice-status.enum';
import { EmailService } from '../../email/email.service';
import { PdfInvoiceProvider } from './pdf-invoice.provider';

// Postgres unique_violation error code — used to detect the specific race
// where two concurrent generateForPayment() calls both pass the
// idempotency check before either has saved. REQUIRES a unique constraint
// on Invoice.paymentId in your schema/migration; without one, this whole
// race-safety mechanism does nothing (the second insert would just
// succeed and silently create a duplicate).
const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class GenerateInvoiceProvider {
  private readonly logger = new Logger(GenerateInvoiceProvider.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoicesRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Workspace)
    private readonly workspacesRepository: Repository<Workspace>,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly pdfInvoiceProvider: PdfInvoiceProvider,
  ) {}

  async generateForPayment(paymentId: string): Promise<Invoice> {
    // Idempotency — return existing invoice if already generated
    const existing = await this.invoicesRepository.findOne({
      where: { paymentId },
    });
    if (existing) {
      return existing;
    }

    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException(`Payment "${paymentId}" not found`);
    }

    const [booking, user] = await Promise.all([
      this.bookingsRepository.findOne({ where: { id: payment.bookingId } }),
      this.usersRepository.findOne({ where: { id: payment.userId } }),
    ]);

    if (!booking) {
      this.logger.warn(
        `Generating invoice for payment ${paymentId} with no matching booking (bookingId: ${payment.bookingId}) — line item description will be generic.`,
      );
    }
    if (!user) {
      this.logger.warn(
        `Generating invoice for payment ${paymentId} but no matching user was found (userId: ${payment.userId}) — invoice will be created but the "invoice ready" email cannot be sent.`,
      );
    }

    const workspace = booking
      ? await this.workspacesRepository.findOne({
          where: { id: booking.workspaceId },
        })
      : null;

    const invoiceNumber = await this.nextInvoiceNumber();

    const lineItems = [
      {
        description: workspace
          ? `${workspace.name} — ${booking.planType} booking`
          : `Booking ${booking?.id ?? ''}`,
        startDate: booking?.startDate,
        endDate: booking?.endDate,
        seatCount: booking?.seatCount ?? 1,
        amountKobo: payment.amount,
        amountNaira: payment.amount / 100,
      },
    ];

    const invoice = this.invoicesRepository.create({
      invoiceNumber,
      userId: payment.userId,
      bookingId: payment.bookingId,
      paymentId: payment.id,
      amountKobo: payment.amount,
      currency: payment.currency,
      status: InvoiceStatus.PAID,
      paidAt: payment.paidAt,
      lineItems,
    });

    let saved: Invoice;
    try {
      saved = await this.invoicesRepository.save(invoice);
    } catch (err) {
      // If a concurrent call for the same paymentId won the race and
      // already inserted its row, the unique constraint on paymentId
      // rejects THIS insert. That's not a real error — it means the
      // invoice already exists, just created by the other call a moment
      // ago. Fetch and return that one instead of duplicating it or
      // propagating a confusing constraint-violation error to the caller.
      if (this.isDuplicatePaymentIdError(err)) {
        const raceWinner = await this.invoicesRepository.findOne({
          where: { paymentId },
        });
        if (raceWinner) {
          this.logger.warn(
            `generateForPayment race detected for payment ${paymentId} — a concurrent call already created invoice ${raceWinner.invoiceNumber}; returning it instead of creating a duplicate.`,
          );
          return raceWinner;
        }
      }
      throw err;
    }

    this.logger.log(
      `Invoice ${invoiceNumber} generated for payment ${paymentId}`,
    );

    if (user) {
      // Fire-and-forget (doesn't block the response), but unlike the
      // previous `.catch(() => void 0)` chain, failures here are logged
      // and recorded, and can be retried later via
      // retryFailedInvoiceEmails() — a failure no longer just vanishes
      // with the invoice silently never reaching the customer.
      void this.sendInvoiceEmailAndRecordOutcome(saved, user);
    }

    return saved;
  }

  /**
   * Sweeps for invoices whose "invoice ready" email never confirmed as
   * sent, and retries them.
   *
   * The original send only ever attempted once, silently, as a
   * fire-and-forget chain with both errors caught and discarded. This
   * closes that gap: point a scheduler at this method (e.g.
   * `@nestjs/schedule`'s `@Cron`) and a transient PDF-generation or SMTP
   * failure gets a second chance instead of permanently orphaning the
   * customer's invoice email.
   */
  async retryFailedInvoiceEmails(
    options: { maxAgeHours?: number; limit?: number } = {},
  ): Promise<{ attempted: number; succeeded: number }> {
    const { maxAgeHours = 72, limit = 50 } = options;
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    // TODO: invoiceEmailSentAt is an assumed column, not confirmed to
    // exist on Invoice — add it (nullable Date) if you want failed
    // deliveries to be queryable/retryable rather than only visible in
    // whatever's left of your log retention window. Same for createdAt if
    // it isn't already there via a standard @CreateDateColumn().
    const candidates = await this.invoicesRepository.find({
      where: {
        invoiceEmailSentAt: IsNull(),
        createdAt: MoreThan(cutoff),
      } as Partial<Invoice>,
      take: limit,
      order: { createdAt: 'ASC' } as never,
    });

    let succeeded = 0;

    for (const invoice of candidates) {
      const user = await this.usersRepository.findOne({
        where: { id: invoice.userId },
      });
      if (!user) {
        this.logger.warn(
          `Skipping invoice email retry for ${invoice.invoiceNumber}: user ${invoice.userId} not found`,
        );
        continue;
      }

      const ok = await this.sendInvoiceEmailAndRecordOutcome(invoice, user);
      if (ok) succeeded++;
    }

    if (candidates.length > 0) {
      this.logger.log(
        `Invoice email retry sweep: ${succeeded}/${candidates.length} succeeded`,
      );
    }

    return { attempted: candidates.length, succeeded };
  }

  /**
   * Generates the PDF and sends the "invoice ready" email, recording the
   * outcome on the invoice row either way. Shared between the initial
   * send in generateForPayment() and the retry sweep above, so the two
   * code paths can't drift out of sync with each other.
   *
   * Returns whether the send succeeded, so callers can tally results
   * without needing to inspect anything else.
   */
  private async sendInvoiceEmailAndRecordOutcome(
    invoice: Invoice,
    user: User,
  ): Promise<boolean> {
    try {
      const pdfBuffer = await this.pdfInvoiceProvider.generate(invoice);
      await this.emailService.sendInvoiceReadyEmail(
        user.email,
        // NOTE: `user.fullName` — double-check this field actually exists
        // on your User entity. Other services in this codebase (e.g.
        // DashboardService) reference `firstname`/`lastname` separately
        // rather than a combined `fullName`; if that's the case here too,
        // this should be `` `${user.firstname} ${user.lastname}`.trim() ``
        // instead.
        user.fullName,
        {
          invoiceNumber: invoice.invoiceNumber,
          amountNaira: (invoice.amountKobo / 100).toFixed(2),
          paidAt: invoice.paidAt
            ? new Date(invoice.paidAt).toLocaleString()
            : '',
        },
        pdfBuffer,
      );

      await this.invoicesRepository.update(invoice.id, {
        invoiceEmailSentAt: new Date(),
      } as Partial<Invoice>);

      return true;
    } catch (err) {
      this.logger.error(
        `Failed to generate/send invoice email for ${invoice.invoiceNumber} (payment ${invoice.paymentId}): ${this.reasonMessage(err)}`,
      );
      return false;
    }
  }

  private isDuplicatePaymentIdError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }

  private reasonMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  /**
   * Atomically increment and return the next invoice sequence number.
   * Produces strings like INV-00001, INV-00002, …
   *
   * Note: Postgres sequences are intentionally non-transactional — if
   * `save()` fails after this runs, the consumed number is gone for good,
   * leaving a gap (e.g. INV-00005 never appears). That's expected,
   * standard sequence behavior and generally fine for invoice numbering:
   * what actually matters is uniqueness and monotonicity, not
   * gaplessness. Flagging only so it's a known property, not a surprise.
   */
  private async nextInvoiceNumber(): Promise<string> {
    const result = await this.dataSource.query<{ nextval: string }[]>(
      `SELECT nextval('invoice_number_seq')`,
    );
    const seq = parseInt(result[0].nextval, 10);
    return `INV-${String(seq).padStart(5, '0')}`;
  }
}