import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WorkspaceLog } from '../workspace-tracking/entities/workspace-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';

// Used when CHECKIN_MAX_HOURS is unset, non-numeric, or non-positive.
const DEFAULT_MAX_HOURS = 12;

// Caps how many stale logs a single run will process. Without this, a
// large backlog (e.g. after an outage) would fetch and sequentially
// process everything in one run, which could run long enough to overlap
// with the next hourly trigger. Any remainder is picked up on the next run.
const MAX_LOGS_PER_RUN = 500;

@Injectable()
export class StaleCheckinJob {
  private readonly logger = new Logger(StaleCheckinJob.name);

  // Guards against two runs overlapping if one run takes longer than the
  // hour between triggers (e.g. while draining a large backlog).
  private isRunning = false;

  constructor(
    @InjectRepository(WorkspaceLog)
    private readonly logsRepository: Repository<WorkspaceLog>,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Runs every hour. Finds workspace check-ins that have been open longer
   * than CHECKIN_MAX_HOURS (default: 12) and force-closes them, computing
   * durationMinutes the same way the normal checkout path does.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async closeStaleCheckIns(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        'StaleCheckinJob: previous run still in progress, skipping this trigger',
      );
      return;
    }

    this.isRunning = true;
    try {
      await this.run();
    } finally {
      this.isRunning = false;
    }
  }

  private async run(): Promise<void> {
    const maxHours = this.resolveMaxHours();
    const threshold = new Date(Date.now() - maxHours * 60 * 60 * 1000);

    let staleLogs: WorkspaceLog[];
    try {
      staleLogs = await this.logsRepository.find({
        where: {
          checkedOutAt: IsNull(),
          checkedInAt: LessThan(threshold),
        },
        take: MAX_LOGS_PER_RUN,
      });
    } catch (err) {
      // Previously, a find() failure here would throw out of the whole
      // method with nothing logged from this job at all — the only trace
      // would be whatever (if anything) @nestjs/schedule's cron wrapper
      // does with a rejected callback. Log it explicitly so a DB blip is
      // visible in this job's own logs, not just inferred from its absence.
      this.logger.error(
        `StaleCheckinJob: failed to query stale check-ins: ${(err as Error).message}`,
      );
      return;
    }

    if (staleLogs.length === 0) {
      this.logger.log('StaleCheckinJob: no stale check-ins found');
      return;
    }

    this.logger.log(
      `StaleCheckinJob: found ${staleLogs.length} stale check-in(s) to close` +
        (staleLogs.length === MAX_LOGS_PER_RUN
          ? ` (hit the per-run cap of ${MAX_LOGS_PER_RUN} — remainder will be picked up next run)`
          : ''),
    );

    let closed = 0;
    let notifyFailures = 0;

    for (const log of staleLogs) {
      const now = new Date();

      // TODO: this duration formula is copy-commented as matching
      // CheckInProvider.checkOut() rather than calling into a shared
      // implementation. If that formula ever changes, this job's copy can
      // silently drift out of sync. Worth extracting both to a shared
      // `computeDurationMinutes()` utility if/when touching either.
      const durationMinutes = this.computeDurationMinutes(log.checkedInAt, now);

      log.checkedOutAt = now;
      log.durationMinutes = durationMinutes;
      // Mark as auto-closed via the notes field so utilization stats can
      // distinguish force-closed logs from voluntary check-outs.
      log.notes = log.notes
        ? `${log.notes} [auto-closed after ${maxHours}h]`
        : `[auto-closed after ${maxHours}h]`;

      try {
        await this.logsRepository.save(log);
      } catch (err) {
        // The row is still open (checkedOutAt was never persisted), so
        // it'll naturally be picked up again on the next run — no special
        // recovery needed here beyond logging.
        this.logger.error(
          `StaleCheckinJob: failed to close log ${log.id}: ${(err as Error).message}`,
        );
        continue;
      }

      closed++;

      try {
        await this.notificationsService.create({
          userId: log.userId,
          type: NotificationType.GENERAL,
          title: 'Workspace check-in closed automatically',
          message: `Your check-in was automatically closed after ${maxHours} hours of inactivity. Duration recorded: ${log.durationMinutes} minute(s).`,
          metadata: {
            workspaceLogId: log.id,
            workspaceId: log.workspaceId,
            durationMinutes: log.durationMinutes,
          },
        });
      } catch (err) {
        // Unlike a save() failure, this log is now permanently closed
        // (checkedOutAt is set), so it won't be re-queried by a future
        // run — a failed notification here won't get a second chance.
        // Logged distinctly from a save failure so on-call doesn't
        // mistake "notification didn't send" for "check-in wasn't closed".
        notifyFailures++;
        this.logger.error(
          `StaleCheckinJob: log ${log.id} was closed but notifying user ${log.userId} failed: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `StaleCheckinJob: closed ${closed}/${staleLogs.length} stale check-in(s)` +
        (notifyFailures > 0 ? `, ${notifyFailures} notification(s) failed to send` : ''),
    );
  }

  /**
   * Parses and validates CHECKIN_MAX_HOURS, falling back to
   * DEFAULT_MAX_HOURS for anything unset, non-numeric, or non-positive.
   *
   * The original used `parseInt(value ?? '12', 10)` with no validation —
   * a misconfigured value like "abc" silently became `NaN`, which would
   * turn `threshold` into an Invalid Date and hand TypeORM a `LessThan`
   * comparison against it (undefined query behavior at best). A value of
   * "0" or a negative number would also silently make the threshold equal
   * to or later than "now", which could sweep up check-ins that just
   * started. Both are now caught and logged instead of reaching the query.
   */
  private resolveMaxHours(): number {
    const raw = this.configService.get<string>('CHECKIN_MAX_HOURS');
    if (raw === undefined) {
      return DEFAULT_MAX_HOURS;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.logger.warn(
        `StaleCheckinJob: invalid CHECKIN_MAX_HOURS value "${raw}", falling back to ${DEFAULT_MAX_HOURS}h`,
      );
      return DEFAULT_MAX_HOURS;
    }

    return parsed;
  }

  private computeDurationMinutes(checkedInAt: Date, checkedOutAt: Date): number {
    return Math.round((checkedOutAt.getTime() - checkedInAt.getTime()) / 60000);
  }
}