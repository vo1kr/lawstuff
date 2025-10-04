import { customAlphabet } from 'nanoid';
import { SettingsService } from '@services/settingsService';
import dayjs from 'dayjs';

const digits = customAlphabet('0123456789', 4);
const caseIdAlphabet = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

export const generateTicketId = async (settings: SettingsService): Promise<string> => {
  const today = dayjs().format('YYYYMMDD');
  const counterKey = `ticket_counter_${today}`;
  const current = Number(await settings.get(counterKey)) || 0;
  const next = current + 1;
  await settings.set(counterKey, String(next));
  const sequence = String(next).padStart(4, '0');
  return `TKT-${today}-${sequence}`;
};

export const generateCaseId = (clientName: string): string => {
  const shortId = caseIdAlphabet();
  const sanitized = clientName
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'client';
  return `CASE-${shortId}-${sanitized}`;
};
