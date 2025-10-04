import { CONFIG } from '@config';
import { getDb } from '@db/client';
import { RateService } from './rateService';
import dayjs from 'dayjs';
import { structuredLog } from '@utils/logger';

export type Tier = 'standard' | 'high-profile' | 'scotus';

export interface TimeEntryInput {
  caseId: string;
  staffUserId: string;
  role: string;
  tier: Tier;
  hours: number;
  description: string;
  currency?: 'USD' | 'R$';
  isTravel?: boolean;
  isInternalConference?: boolean;
  teamSize?: number;
}

export interface TimeEntryRecord {
  id: string;
  case_id: string;
  staff_user_id: string;
  role: string;
  tier: Tier;
  hours: number;
  rate_usd: number | null;
  rate_rbx: number | null;
  amount_usd: number | null;
  amount_rbx: number | null;
  description: string;
  created_at: string;
}

const ROBUX_RATES = {
  standard: { lead: 40, additional: 20 },
  'high-profile': { lead: 60, additional: 30 },
  scotus: { lead: 75, additional: 35 }
} as const;

export class BillingService {
  private db = getDb();
  private rateService = new RateService();

  private roundHours(hours: number): number {
    const minIncrement = CONFIG.billing.minIncrementHours;
    const rounded = Math.ceil((hours + 1e-6) / minIncrement) * minIncrement;
    return Number(rounded.toFixed(2));
  }

  private robuxRate(tier: Tier, teamSize: number): number {
    const band = ROBUX_RATES[tier];
    if (!band) return 0;
    const size = Math.max(1, teamSize);
    return band.lead + (size - 1) * band.additional;
  }

  private ensureInternalConferenceCap(caseId: string, day: string, requestedHours: number): number {
    const cap = CONFIG.billing.internalConferenceCapPerDay;
    if (cap <= 0) return requestedHours;
    const existing = this.db
      .prepare(
        "SELECT IFNULL(SUM(hours),0) as total FROM time_entries WHERE case_id = ? AND description LIKE '%[INTERNAL]%' AND DATE(created_at) = DATE(?)"
      )
      .get(caseId, day) as { total: number };
    const remaining = Math.max(0, cap - existing.total);
    return Math.min(remaining, requestedHours);
  }

  private ensureTeamLimit(caseId: string, teamSize: number): number {
    const max = CONFIG.billing.maxSimultaneousBillable;
    if (teamSize <= max) return teamSize;
    const override = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(`case_allow_exceed_${caseId}`) as
      | { value: string }
      | undefined;
    if (override?.value === 'true') return teamSize;
    return max;
  }

  addTimeEntry(input: TimeEntryInput): TimeEntryRecord {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = dayjs().toISOString();
    const roundedHours = this.roundHours(input.hours);
    let finalHours = roundedHours;
    let description = input.description.trim();

    if (input.isInternalConference) {
      const allowed = this.ensureInternalConferenceCap(input.caseId, now, roundedHours);
      if (allowed <= 0) {
        throw new Error('Internal conference cap reached for today.');
      }
      if (allowed < roundedHours) {
        structuredLog('warn', 'Internal conference hours capped', { requested: roundedHours, allowed });
        finalHours = allowed;
      }
      description = `[INTERNAL] ${description}`;
    }

    const teamSize = this.ensureTeamLimit(input.caseId, input.teamSize ?? 1);
    if (teamSize < (input.teamSize ?? 1)) {
      description = `${description} [TEAM_CLAMPED:${teamSize}]`;
    }

    const rateUsd = this.rateService.getRate(input.role, input.tier) ?? 0;
    const robuxRate = this.robuxRate(input.tier, teamSize);

    let effectiveRateUsd = rateUsd;
    let effectiveRateRbx = robuxRate;

    if (input.isTravel && CONFIG.billing.travelHalfRate) {
      effectiveRateUsd = rateUsd / 2;
      effectiveRateRbx = robuxRate / 2;
      description = `[TRAVEL] ${description}`;
    }

    const amountUsd = Number((effectiveRateUsd * finalHours).toFixed(2));
    const amountRbx = Number((effectiveRateRbx * finalHours).toFixed(2));

    const record: TimeEntryRecord = {
      id,
      case_id: input.caseId,
      staff_user_id: input.staffUserId,
      role: input.role,
      tier: input.tier,
      hours: finalHours,
      rate_usd: effectiveRateUsd,
      rate_rbx: effectiveRateRbx,
      amount_usd: amountUsd,
      amount_rbx: amountRbx,
      description,
      created_at: now
    };

    this.db
      .prepare(
        `INSERT INTO time_entries (id, case_id, staff_user_id, role, tier, hours, rate_usd, rate_rbx, amount_usd, amount_rbx, description, created_at)
         VALUES (@id, @case_id, @staff_user_id, @role, @tier, @hours, @rate_usd, @rate_rbx, @amount_usd, @amount_rbx, @description, @created_at)`
      )
      .run(record);

    return record;
  }

  getEntriesForCase(caseId: string): TimeEntryRecord[] {
    return this.db.prepare('SELECT * FROM time_entries WHERE case_id = ? ORDER BY created_at ASC').all(caseId) as TimeEntryRecord[];
  }

  invoiceSummary(caseId: string, currency: 'USD' | 'R$') {
    const entries = this.getEntriesForCase(caseId);
    const subtotalUsd = entries.reduce((sum, entry) => sum + (entry.amount_usd ?? 0), 0);
    const subtotalRbx = entries.reduce((sum, entry) => sum + (entry.amount_rbx ?? 0), 0);
    const subtotal = currency === 'USD' ? subtotalUsd : subtotalRbx;
    return {
      caseId,
      currency,
      entries,
      subtotal,
      subtotalUsd,
      subtotalRbx
    };
  }
}
