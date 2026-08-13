import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import type { LeadStage, LeadSource } from './entities/lead.entity';

export type { LeadStage, LeadSource };

// Postgres unique_violation error code — used to detect the specific race
// where two concurrent upsert() calls for the same email both pass the
// `existing` check before either has saved. REQUIRES a unique constraint
// on Lead.email in your schema/migration; without one this whole
// race-safety mechanism does nothing (the second insert just succeeds and
// silently creates a duplicate lead).
const POSTGRES_UNIQUE_VIOLATION = '23505';

// Every activity pushed onto Lead.activities now shares one shape instead
// of three different ad-hoc object literals ({source,at} / {stage,at} /
// {stage,at,note}) — `type` disambiguates which kind of event it is, so
// anything reading this column later has a shape it can actually rely on.
// Ideally this lives alongside the Lead entity itself; defined here since
// that file isn't in view.
export type LeadActivityType = 'created' | 'touched' | 'stage_changed' | 'won';

export interface LeadActivity {
  type: LeadActivityType;
  at: string;
  source?: LeadSource;
  fromStage?: LeadStage;
  toStage?: LeadStage;
  note?: string;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(@InjectRepository(Lead) private readonly repo: Repository<Lead>) {}

  async upsert(email: string, source: LeadSource, name: string): Promise<Lead> {
    const normalizedEmail = this.normalizeEmail(email);
    const existing = await this.repo.findOne({ where: { email: normalizedEmail } });
    const now = new Date().toISOString();

    if (existing) {
      existing.activities = [
        ...(existing.activities ?? []),
        { type: 'touched', at: now, source } as LeadActivity,
      ];
      // Fill in / correct the name on repeat touches, but never clobber a
      // real name with a blank one if this particular call happened not
      // to include it.
      const trimmedName = name?.trim();
      if (trimmedName && trimmedName !== existing.name) {
        existing.name = trimmedName;
      }
      return this.repo.save(existing);
    }

    const created = this.repo.create({
      email: normalizedEmail,
      name: name?.trim() ?? '',
      source,
      stage: 'NEW' as LeadStage,
      // Previously started as [] — meaning a brand-new lead's actual
      // creation event, arguably the single most important entry in its
      // whole history, was the one touchpoint that never got recorded.
      activities: [{ type: 'created', at: now, source } as LeadActivity],
    });

    try {
      return await this.repo.save(created);
    } catch (err) {
      if (this.isDuplicateEmailError(err)) {
        // A concurrent upsert() for the same email won the race and
        // already inserted its row; the unique constraint on email
        // rejects THIS insert. That's not a real failure — fetch and
        // return the row the other call created instead of erroring out
        // or (without this catch) ending up with a genuine duplicate.
        const raceWinner = await this.repo.findOne({ where: { email: normalizedEmail } });
        if (raceWinner) {
          this.logger.warn(
            `upsert race detected for ${normalizedEmail} — returning the lead created by a concurrent call.`,
          );
          return raceWinner;
        }
      }
      throw err;
    }
  }

  /**
   * Returns up to `limit` leads, optionally filtered by stage.
   *
   * This intentionally keeps the same (Lead[]) return shape as before —
   * changing to a real paginated response ({ data, total, page }) is a
   * bigger, deliberate API change for callers to opt into, not something
   * to impose silently here. In the meantime, `limit` at least puts a
   * ceiling on an otherwise-unbounded query as your lead volume grows.
   */
  async findAll(stage?: LeadStage, limit = 500): Promise<Lead[]> {
    const safeLimit = Math.min(
      Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 500,
      1000,
    );
    return this.repo.find({
      where: stage ? { stage } : {},
      take: safeLimit,
    });
  }

  async updateStage(id: string, stage: LeadStage): Promise<Lead> {
    const lead = await this.repo.findOne({ where: { id } });
    if (!lead) {
      throw new NotFoundException(`Lead "${id}" not found`);
    }

    if (lead.stage === stage) {
      // No real transition happened — skip the write and the activity
      // entry. markWon() already applied this exact guard for its own
      // WON-specific case; this brings the more general updateStage()
      // in line with that, instead of logging a "changed to X" entry
      // for a change that didn't occur.
      return lead;
    }

    const now = new Date().toISOString();
    const fromStage = lead.stage;
    lead.stage = stage;
    lead.activities = [
      ...(lead.activities ?? []),
      { type: 'stage_changed', at: now, fromStage, toStage: stage } as LeadActivity,
    ];
    return this.repo.save(lead);
  }

  async markWon(email: string): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    const lead = await this.repo.findOne({ where: { email: normalizedEmail } });

    if (!lead) {
      // Previously silent — a "mark won" event for an email with no
      // matching lead just vanished with zero trace. Could mean a
      // webhook misconfiguration or a conversion that was never tracked
      // as a lead in the first place; worth knowing about either way.
      this.logger.warn(
        `markWon called for "${normalizedEmail}" but no matching lead exists — nothing to update.`,
      );
      return;
    }

    if (lead.stage === 'WON') {
      return;
    }

    const now = new Date().toISOString();
    lead.stage = 'WON' as LeadStage;
    lead.activities = [
      ...(lead.activities ?? []),
      {
        type: 'won',
        at: now,
        note: 'registered/subscribed',
      } as LeadActivity,
    ];
    await this.repo.save(lead);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isDuplicateEmailError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}