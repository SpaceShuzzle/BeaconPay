import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailEntry } from './entities/mail-entry.entity';
// TODO: this assumes a NotificationsService with a method for this
// specific event, matching the pattern used elsewhere in this codebase
// (e.g. booking-cancellation notifications). Adjust the import path and
// method name/signature to whatever your actual notification service is
// — this is a placeholder interface, not a confirmed dependency, since
// this file alone doesn't show what's actually available.
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MailLoggingService {
  private readonly logger = new Logger(MailLoggingService.name);

  constructor(
    @InjectRepository(MailEntry)
    private readonly repo: Repository<MailEntry>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Logs a piece of mail as received. Notification is attempted
   * afterward and does NOT affect the outcome of this call — the mail
   * record is durably saved before notification is even attempted, so a
   * notification failure is a separate, logged concern rather than
   * something that makes this method throw despite the mail having been
   * genuinely logged.
   */
  async logMailReceived(
    memberId: string,
    packageName: string,
    recipient: string,
  ): Promise<MailEntry> {
    const entry = this.repo.create({
      memberId,
      packageName,
      status: 'received',
      recipient,
    });
    const saved = await this.repo.save(entry);

    void this.notifyMemberAndRecordOutcome(saved);

    return saved;
  }

  /**
   * Attempts the member notification and, only on real success, advances
   * status to 'notified' and records when. Previously 'notified' was
   * declared in the status type but never actually reachable — nothing
   * ever set it. On failure, status intentionally stays 'received' rather
   * than silently claiming a notification went out when it didn't.
   */
  private async notifyMemberAndRecordOutcome(entry: MailEntry): Promise<void> {
    try {
      await this.notificationsService.notifyMailReceived(
        entry.memberId,
        entry.packageName,
      );
      entry.status = 'notified';
      entry.notifiedAt = new Date();
      await this.repo.save(entry);
    } catch (err) {
      this.logger.error(
        `Failed to notify member ${entry.memberId} about package "${entry.packageName}" (mail #${entry.id}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async confirmPickup(mailId: string): Promise<MailEntry> {
    const mail = await this.repo.findOne({ where: { id: mailId } });
    if (!mail) {
      throw new NotFoundException(`Mail entry "${mailId}" not found`);
    }

    if (mail.status === 'picked-up') {
      // Guards against double-processing (a duplicate button press, two
      // staff members confirming the same package) instead of silently
      // "succeeding" a second time with no signal that nothing changed.
      throw new ConflictException(
        `Mail entry "${mailId}" was already marked picked up${
          mail.pickedUpAt ? ` at ${mail.pickedUpAt.toISOString()}` : ''
        }.`,
      );
    }

    mail.status = 'picked-up';
    mail.pickedUpAt = new Date();
    return this.repo.save(mail);
  }

  async getMemberMail(memberId: string): Promise<MailEntry[]> {
    return this.repo.find({
      where: { memberId },
      order: { receivedAt: 'DESC' },
    });
  }
}