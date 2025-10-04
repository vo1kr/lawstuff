import { getDb } from '@db/client';

type Tier = 'standard' | 'high-profile' | 'scotus';

export interface RateRecord {
  role: string;
  tier: Tier;
  rate: number;
}

export class RateService {
  private db = getDb();

  getRate(role: string, tier: Tier): number | null {
    const row = this.db.prepare('SELECT rate FROM rates_usd WHERE role = ? AND tier = ?').get(role, tier) as { rate: number } | undefined;
    return row?.rate ?? null;
  }

  getRatesForTier(tier: Tier): RateRecord[] {
    const rows = this.db.prepare('SELECT role, tier, rate FROM rates_usd WHERE tier = ? ORDER BY rate DESC').all(tier) as RateRecord[];
    return rows;
  }
}
