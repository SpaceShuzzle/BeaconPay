import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ContactMessage } from './entities/contact-message.entity';
import { SubmitContactDto } from './dto/submit-contact.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  // A window within which an identical (email, subject, message) submission
  // is treated as an accidental double-submit (double-click, slow-network
  // retry, naive bot resubmission) rather than a genuine second message,
  // and is silently ignored instead of creating a duplicate row and firing
  // four emails instead of two.
  private static readonly DUPLICATE_SUBMISSION_WINDOW_MS = 30_000;

  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactRepo: Repository<ContactMessage>,
    private readonly emailService: EmailService,
  ) {}

  async submit(
    dto: SubmitContactDto,
    ipAddress?: string | null,
  ): Promise<{ message: string }> {
    if (await this.isRecentDuplicate(dto)) {
      this.logger.warn(
        `Ignored duplicate contact submission from ${dto.email}: "${dto.subject}"`,
      );
      // Same response as a genuine submission — the user's message WAS
      // received (the first time), so this isn't misleading, and it avoids
      // leaking "this looked like a duplicate" as a distinguishable signal
      // to whatever's on the other end of the form (bot or human).
      return { message: 'Your message has been sent successfully.' };
    }

    const contactMessage = this.contactRepo.create({
      ...dto,
      ipAddress: ipAddress || undefined,
    });

    const saved = await this.contactRepo.save(contactMessage);
    this.logger.log(`Contact form submitted by ${dto.email}: ${dto.subject}`);

    // Fires both emails concurrently and does NOT block the HTTP response
    // on them — but unlike two independent fire-and-forget `.catch()`s,
    // this tracks the outcome of both and persists it, so "did anyone
    // actually get notified about this?" is answerable later from the DB
    // instead of only existing (briefly) in scrolled-past logs.
    void this.sendNotificationsAndRecordOutcome(saved, dto);

    return { message: 'Your message has been sent successfully.' };
  }

  private async isRecentDuplicate(dto: SubmitContactDto): Promise<boolean> {
    const cutoff = new Date(
      Date.now() - ContactService.DUPLICATE_SUBMISSION_WINDOW_MS,
    );

    // Assumes ContactMessage has a `createdAt` column (e.g. via
    // @CreateDateColumn()) — adjust the field name here if yours differs.
    const existing = await this.contactRepo.findOne({
      where: {
        email: dto.email,
        subject: dto.subject,
        message: dto.message,
        createdAt: MoreThan(cutoff),
      },
    });

    return !!existing;
  }

  private async sendNotificationsAndRecordOutcome(
    saved: ContactMessage,
    dto: SubmitContactDto,
  ): Promise<void> {
    const [confirmation, notification] = await Promise.allSettled([
      this.emailService.sendContactConfirmation(
        dto.email,
        dto.fullName,
        dto.subject,
      ),
      this.emailService.sendContactNotification(
        dto.fullName,
        dto.email,
        dto.subject,
        dto.message,
      ),
    ]);

    if (confirmation.status === 'rejected') {
      // Worse UX (the sender doesn't get a receipt), but not a lost
      // business opportunity — warn level.
      this.logger.warn(
        `Failed to send contact confirmation to ${dto.email}: ${this.reasonMessage(confirmation.reason)}`,
      );
    }

    if (notification.status === 'rejected') {
      // The admin never learns this inquiry exists — a genuinely lost
      // lead, not just a UX rough edge, so this gets error level (and is
      // the one worth alerting on).
      this.logger.error(
        `Failed to notify admin of contact submission #${saved.id} from ${dto.email}: ${this.reasonMessage(notification.reason)}`,
      );
    }

    // TODO: these two columns are assumed, not confirmed to exist on
    // ContactMessage — add them (nullable Date columns, or booleans if you
    // prefer) if you want failed deliveries to be queryable later rather
    // than only visible in whatever's left in your log retention window.
    try {
      await this.contactRepo.update(saved.id, {
        confirmationEmailSentAt:
          confirmation.status === 'fulfilled' ? new Date() : null,
        notificationEmailSentAt:
          notification.status === 'fulfilled' ? new Date() : null,
      } as Partial<ContactMessage>);
    } catch (err) {
      this.logger.error(
        `Failed to persist email delivery status for contact message #${saved.id}: ${this.reasonMessage(err)}`,
      );
    }
  }

  private reasonMessage(reason: unknown): string {
    return reason instanceof Error ? reason.message : String(reason);
  }
}