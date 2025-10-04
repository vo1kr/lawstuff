import { getDb } from '@db/client';
import { generateTicketId } from '@utils/ids';
import { SettingsService } from './settingsService';
import dayjs from 'dayjs';

export interface TicketInput {
  type: 'civil' | 'criminal' | 'appellate';
  clientUserId: string;
  intakeJson: Record<string, unknown>;
  intakeChannelId: string;
  threadId: string;
  linkedCaseId?: string | null;
}

export interface TicketRecord {
  id: string;
  type: 'civil' | 'criminal' | 'appellate';
  status: 'PENDING' | 'ACTIVE' | 'CLOSED';
  client_user_id: string;
  intake_json: string;
  intake_channel_id: string;
  thread_or_channel_id: string;
  assigned_user_id: string | null;
  linked_case_id: string | null;
  created_at: string;
  updated_at: string;
}

export class TicketService {
  private db = getDb();
  private settings = new SettingsService();

  async createTicket(input: TicketInput): Promise<TicketRecord> {
    const id = await generateTicketId(this.settings);
    const now = dayjs().toISOString();
    this.db
      .prepare(
        `INSERT INTO tickets (id, type, status, client_user_id, intake_json, intake_channel_id, thread_or_channel_id, linked_case_id, created_at, updated_at)
         VALUES (@id, @type, 'PENDING', @client_user_id, @intake_json, @intake_channel_id, @thread_or_channel_id, @linked_case_id, @created_at, @updated_at)`
      )
      .run({
        id,
        type: input.type,
        client_user_id: input.clientUserId,
        intake_json: JSON.stringify(input.intakeJson),
        intake_channel_id: input.intakeChannelId,
        thread_or_channel_id: input.threadId,
        linked_case_id: input.linkedCaseId ?? null,
        created_at: now,
        updated_at: now
      });
    return this.getTicket(id)!;
  }

  getTicket(id: string): TicketRecord | null {
    const row = this.db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as TicketRecord | undefined;
    return row ?? null;
  }

  listTicketsByThread(threadId: string): TicketRecord | null {
    const row = this.db
      .prepare('SELECT * FROM tickets WHERE thread_or_channel_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(threadId) as TicketRecord | undefined;
    return row ?? null;
  }

  updateAssignment(id: string, userId: string | null): void {
    this.db.prepare('UPDATE tickets SET assigned_user_id = ?, updated_at = ? WHERE id = ?').run(userId, dayjs().toISOString(), id);
  }

  updateStatus(id: string, status: 'PENDING' | 'ACTIVE' | 'CLOSED'): void {
    this.db.prepare('UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?').run(status, dayjs().toISOString(), id);
  }

  linkCase(id: string, caseId: string): void {
    this.db.prepare('UPDATE tickets SET linked_case_id = ?, updated_at = ? WHERE id = ?').run(caseId, dayjs().toISOString(), id);
  }
}
