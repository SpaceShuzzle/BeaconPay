// @ts-nocheck
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

@Injectable()
export class JobsObservabilityService {
  private readonly logger = new Logger(JobsObservabilityService.name);

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('bookings') private bookingsQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {}

  private getAllQueues(): Queue[] {
    return [this.emailQueue, this.bookingsQueue, this.notificationsQueue];
  }

  private getQueueByName(name: string): Queue {
    const queue = this.getAllQueues().find((q) => q.name === name);
    if (!queue) {
      throw new NotFoundException(`Queue "${name}" not found`);
    }
    return queue;
  }

  async getQueueStats(queueName: string): Promise<QueueStats> {
    const queue = this.getQueueByName(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { name: queueName, waiting, active, completed, failed, delayed };
  }

  async getAllQueueStats(): Promise<QueueStats[]> {
    const queues = this.getAllQueues();
    const stats: QueueStats[] = [];

    for (const queue of queues) {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      stats.push({
        name: queue.name,
        waiting,
        active,
        completed,
        failed,
        delayed,
      });

      if (failed > 0) {
        this.logger.warn(
          `Queue "${queue.name}" has ${failed} failed job(s)`,
        );
      }

      if (failed >= 3) {
        const failedJobs = await queue.getFailed(0, 2);
        for (const job of failedJobs) {
          this.logger.warn(
            `ALERT: Job ${job.id} in queue "${queue.name}" has failed ${job.attemptsMade} times. Data: ${JSON.stringify(job.data)}`,
          );
        }
      }
    }

    return stats;
  }

  async getFailedJobs(queueName: string, limit = 50): Promise<Job[]> {
    const queue = this.getQueueByName(queueName);
    return queue.getFailed(0, limit);
  }

  async retryJob(queueName: string, jobId: string): Promise<Job> {
    const queue = this.getQueueByName(queueName);
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job "${jobId}" not found in queue "${queueName}"`);
    }
    await job.retry();
    return job;
  }

  async getDeadLetterQueue(queueName: string): Promise<Job[]> {
    const queue = this.getQueueByName(queueName);
    const failedJobs = await queue.getFailed(0, 100);
    return failedJobs.filter((job) => {
      const maxAttempts = (job.opts?.attempts as number) ?? 3;
      return job.attemptsMade >= maxAttempts;
    });
  }

  async purgeDeadLetterQueue(queueName: string): Promise<{ purged: number }> {
    const queue = this.getQueueByName(queueName);
    const deadJobs = await this.getDeadLetterQueue(queueName);

    for (const job of deadJobs) {
      await job.remove();
    }

    this.logger.log(
      `Purged ${deadJobs.length} dead-letter job(s) from queue "${queueName}"`,
    );

    return { purged: deadJobs.length };
  }
}
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  /** Whether the queue is currently paused (jobs added but not processed). */
  paused: boolean;
}

// Log a warning-level alert once a queue's failed-job count crosses this
// threshold, on top of the general "queue has N failed jobs" log line.
const FAILED_JOB_ALERT_THRESHOLD = 3;

// Fallback max-attempts value used only when neither the job itself nor its
// queue's default job options specify one. Bull's own default is 1 attempt,
// but most retry-capable queues in this app configure more — 3 is kept as
// a last-resort guess, not an assumption applied blindly to every queue.
const FALLBACK_MAX_ATTEMPTS = 3;

// getFailed() pagination batch size when walking a queue's full failed set
// (used by getDeadLetterQueue, which can't just take the first N — a job
// far down the list can still be past its max attempts).
const DEAD_LETTER_BATCH_SIZE = 200;

// Safety cap on how many failed jobs getDeadLetterQueue will walk through,
// so a queue with an enormous backlog can't turn an observability call into
// an unbounded, slow, memory-heavy scan.
const DEAD_LETTER_MAX_SCANNED = 5_000;

// Upper bound on getFailedJobs' limit param, since it's plausible this ends
// up wired to a controller query param that a caller could set arbitrarily
// high.
const MAX_FAILED_JOBS_LIMIT = 500;

@Injectable()
export class JobsObservabilityService {
  private readonly logger = new Logger(JobsObservabilityService.name);

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('bookings') private bookingsQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {}

  private getAllQueues(): Queue[] {
    return [this.emailQueue, this.bookingsQueue, this.notificationsQueue];
  }

  private getQueueByName(name: string): Queue {
    const queue = this.getAllQueues().find((q) => q.name === name);
    if (!queue) {
      throw new NotFoundException(`Queue "${name}" not found`);
    }
    return queue;
  }

  /**
   * Collects counts (and paused state) for a single queue. Shared by
   * `getQueueStats` and `getAllQueueStats` so the two never drift out of
   * sync with each other.
   */
  private async collectQueueStats(queue: Queue): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return { name: queue.name, waiting, active, completed, failed, delayed, paused };
  }

  /**
   * Logs a warning if a queue has any failed jobs, and a more detailed
   * alert (including the most recent failed jobs' data) once it crosses
   * `FAILED_JOB_ALERT_THRESHOLD`.
   */
  private async logFailureWarnings(queue: Queue, failedCount: number): Promise<void> {
    if (failedCount === 0) {
      return;
    }

    this.logger.warn(`Queue "${queue.name}" has ${failedCount} failed job(s)`);

    if (failedCount >= FAILED_JOB_ALERT_THRESHOLD) {
      const failedJobs = await queue.getFailed(0, 2);
      for (const job of failedJobs) {
        this.logger.warn(
          `ALERT: Job ${job.id} in queue "${queue.name}" has failed ${job.attemptsMade} times. Data: ${JSON.stringify(job.data)}`,
        );
      }
    }
  }

  async getQueueStats(queueName: string): Promise<QueueStats> {
    const queue = this.getQueueByName(queueName);
    return this.collectQueueStats(queue);
  }

  async getAllQueueStats(): Promise<QueueStats[]> {
    const queues = this.getAllQueues();

    // Collect + log per queue concurrently instead of one queue at a time —
    // these are independent Redis round-trips, no reason to serialize them.
    const stats = await Promise.all(
      queues.map(async (queue) => {
        const queueStats = await this.collectQueueStats(queue);
        await this.logFailureWarnings(queue, queueStats.failed);
        return queueStats;
      }),
    );

    return stats;
  }

  async getFailedJobs(queueName: string, limit = 50): Promise<Job[]> {
    const queue = this.getQueueByName(queueName);
    const cappedLimit = Math.min(Math.max(limit, 0), MAX_FAILED_JOBS_LIMIT);
    return queue.getFailed(0, cappedLimit);
  }

  async retryJob(queueName: string, jobId: string): Promise<Job> {
    const queue = this.getQueueByName(queueName);
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job "${jobId}" not found in queue "${queueName}"`);
    }
    await job.retry();
    return job;
  }

  /**
   * Returns failed jobs that have exhausted their retry attempts.
   *
   * Walks the queue's failed set in batches rather than only inspecting the
   * first 100 — with the previous fixed `getFailed(0, 100)` call, a queue
   * with more than 100 failed jobs would silently miss dead-letter jobs
   * sitting past that cutoff. Scanning stops early once a full batch comes
   * back empty, and is capped at `DEAD_LETTER_MAX_SCANNED` jobs so a queue
   * with a very large failed backlog can't turn this into an unbounded scan.
   */
  async getDeadLetterQueue(queueName: string): Promise<Job[]> {
    const queue = this.getQueueByName(queueName);

    const failedCount = await queue.getFailedCount();
    if (failedCount === 0) {
      return [];
    }

    const deadJobs: Job[] = [];
    let offset = 0;

    while (offset < DEAD_LETTER_MAX_SCANNED) {
      const batch = await queue.getFailed(offset, offset + DEAD_LETTER_BATCH_SIZE - 1);
      if (batch.length === 0) {
        break;
      }

      for (const job of batch) {
        const maxAttempts = this.resolveMaxAttempts(queue, job);
        if (job.attemptsMade >= maxAttempts) {
          deadJobs.push(job);
        }
      }

      offset += batch.length;
      if (batch.length < DEAD_LETTER_BATCH_SIZE) {
        break;
      }
    }

    if (offset >= DEAD_LETTER_MAX_SCANNED) {
      this.logger.warn(
        `Dead-letter scan for queue "${queueName}" stopped after ${DEAD_LETTER_MAX_SCANNED} jobs — there may be more dead-letter jobs beyond this scan.`,
      );
    }

    return deadJobs;
  }

  /**
   * Purges all dead-letter jobs for a queue. Removals run concurrently and
   * individual failures don't abort the rest of the purge — with the
   * previous sequential `for...of` + `await`, one job that failed to remove
   * would throw and leave every subsequent dead job un-purged with no
   * indication of how far it got.
   */
  async purgeDeadLetterQueue(
    queueName: string,
  ): Promise<{ purged: number; failed: number }> {
    const deadJobs = await this.getDeadLetterQueue(queueName);

    const results = await Promise.allSettled(deadJobs.map((job) => job.remove()));

    const purged = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - purged;

    if (failed > 0) {
      this.logger.warn(
        `Purged ${purged} dead-letter job(s) from queue "${queueName}", but ${failed} failed to remove — see individual errors above.`,
      );
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.logger.error(
            `Failed to remove dead-letter job ${deadJobs[index].id} from queue "${queueName}": ${(result.reason as Error)?.message ?? result.reason}`,
          );
        }
      });
    } else {
      this.logger.log(`Purged ${purged} dead-letter job(s) from queue "${queueName}"`);
    }

    return { purged, failed };
  }

  /**
   * Resolves the effective max-attempts for a job: the job's own configured
   * attempts if set, otherwise the queue's default job options, otherwise
   * `FALLBACK_MAX_ATTEMPTS`. The previous version always fell back to a
   * hardcoded 3 for every queue, which would misclassify jobs as
   * dead-letter (or fail to) on any queue configured with a different
   * default.
   */
  private resolveMaxAttempts(queue: Queue, job: Job): number {
    return (
      (job.opts?.attempts as number | undefined) ??
      (queue.defaultJobOptions?.attempts as number | undefined) ??
      FALLBACK_MAX_ATTEMPTS
    );
  }
}