import path from 'path';
import fs from 'fs';

process.env.HARTLAW_DB_PATH = path.resolve(__dirname, 'tmp', 'billing.db');
fs.mkdirSync(path.dirname(process.env.HARTLAW_DB_PATH), { recursive: true });

import '../src/db/migrate';
import { BillingService } from '../src/services/billingService';
import { getDb } from '../src/db/client';

const billing = new BillingService();

beforeEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM time_entries').run();
});

test('rounds hours to nearest tenth and applies travel half rate', () => {
  const entry = billing.addTimeEntry({
    caseId: 'case1',
    staffUserId: 'user1',
    role: 'Equity Partner (Lead Counsel)',
    tier: 'standard',
    hours: 0.16,
    description: 'Travel to court',
    isTravel: true,
    teamSize: 1
  });
  expect(entry.hours).toBeCloseTo(0.2, 5);
  expect(entry.amount_usd).toBeCloseTo(400 * 0.5 * 0.2, 2);
});

test('internal conference capped at configured max', () => {
  const first = billing.addTimeEntry({
    caseId: 'case2',
    staffUserId: 'user1',
    role: 'Equity Partner (Lead Counsel)',
    tier: 'standard',
    hours: 0.2,
    description: 'Internal strategy',
    isInternalConference: true,
    teamSize: 1
  });
  expect(first.hours).toBeCloseTo(0.2, 5);
  const second = billing.addTimeEntry({
    caseId: 'case2',
    staffUserId: 'user2',
    role: 'Equity Partner (Lead Counsel)',
    tier: 'standard',
    hours: 0.2,
    description: 'Internal follow-up',
    isInternalConference: true,
    teamSize: 1
  });
  expect(second.hours).toBeLessThanOrEqual(0.1);
});

test('team size clamps to max simultaneous billable', () => {
  const entry = billing.addTimeEntry({
    caseId: 'case3',
    staffUserId: 'user3',
    role: 'Equity Partner (Lead Counsel)',
    tier: 'standard',
    hours: 1,
    description: 'Large team review',
    teamSize: 6
  });
  expect(entry.description).toContain('[TEAM_CLAMPED:');
  expect(entry.rate_rbx).toBe(40 + (3 - 1) * 20);
});
