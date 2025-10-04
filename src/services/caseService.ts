import { getDb } from '@db/client';
import { generateCaseId } from '@utils/ids';
import dayjs from 'dayjs';

export interface CaseInput {
  division: 'civil' | 'criminal' | 'appellate';
  clientName: string;
  channelId: string;
  currency?: 'USD' | 'R$';
}

export interface CaseRecord {
  id: string;
  division: 'civil' | 'criminal' | 'appellate';
  client_name: string;
  channel_id: string;
  status: 'ACTIVE' | 'ARCHIVED';
  currency: 'USD' | 'R$';
  contingency_only: number;
  contingency_percent: number | null;
  archived_category_code: 'CV' | 'CR' | 'SC' | null;
  created_at: string;
  archived_at: string | null;
}

export class CaseService {
  private db = getDb();

  createCase(input: CaseInput): CaseRecord {
    const id = generateCaseId(input.clientName);
    const now = dayjs().toISOString();
    this.db
      .prepare(
        `INSERT INTO cases (id, division, client_name, channel_id, status, currency, contingency_only, contingency_percent, created_at)
         VALUES (@id, @division, @client_name, @channel_id, 'ACTIVE', @currency, 0, NULL, @created_at)`
      )
      .run({
        id,
        division: input.division,
        client_name: input.clientName,
        channel_id: input.channelId,
        currency: input.currency ?? 'USD',
        created_at: now
      });
    return this.getCase(id)!;
  }

  getCase(id: string): CaseRecord | null {
    const row = this.db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as CaseRecord | undefined;
    return row ?? null;
  }

  getCaseByChannel(channelId: string): CaseRecord | null {
    const row = this.db.prepare('SELECT * FROM cases WHERE channel_id = ?').get(channelId) as CaseRecord | undefined;
    return row ?? null;
  }

  setCurrency(caseId: string, currency: 'USD' | 'R$'): void {
    this.db.prepare('UPDATE cases SET currency = ? WHERE id = ?').run(currency, caseId);
  }

  setContingency(caseId: string, enabled: boolean, percent: number | null): void {
    this.db
      .prepare('UPDATE cases SET contingency_only = ?, contingency_percent = ? WHERE id = ?')
      .run(enabled ? 1 : 0, enabled ? percent : null, caseId);
  }

  archiveCase(caseId: string, categoryCode: 'CV' | 'CR' | 'SC'): void {
    this.db
      .prepare('UPDATE cases SET status = \'ARCHIVED\', archived_category_code = ?, archived_at = ? WHERE id = ?')
      .run(categoryCode, dayjs().toISOString(), caseId);
  }
}
