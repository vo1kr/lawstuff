import { getDb } from '@db/client';
import { structuredLog } from '@utils/logger';

const createTables = () => {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      type TEXT CHECK(type IN ('civil','criminal','appellate')),
      status TEXT CHECK(status IN ('PENDING','ACTIVE','CLOSED')),
      client_user_id TEXT,
      intake_json TEXT,
      intake_channel_id TEXT,
      thread_or_channel_id TEXT,
      assigned_user_id TEXT,
      linked_case_id TEXT,
      created_at DATETIME,
      updated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      division TEXT CHECK(division IN ('civil','criminal','appellate')),
      client_name TEXT,
      channel_id TEXT,
      status TEXT CHECK(status IN ('ACTIVE','ARCHIVED')),
      currency TEXT CHECK(currency IN ('USD','R$')) DEFAULT 'USD',
      contingency_only INTEGER DEFAULT 0,
      contingency_percent INTEGER,
      archived_category_code TEXT CHECK(archived_category_code IN ('CV','CR','SC')),
      created_at DATETIME,
      archived_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      staff_user_id TEXT,
      role TEXT,
      tier TEXT CHECK(tier IN ('standard','high-profile','scotus')),
      hours REAL,
      rate_usd REAL,
      rate_rbx REAL,
      amount_usd REAL,
      amount_rbx REAL,
      description TEXT,
      created_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      author_user_id TEXT,
      rating INTEGER CHECK(rating BETWEEN 1 AND 5),
      text TEXT,
      channel_message_id TEXT,
      created_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      channel_id TEXT,
      uploader_user_id TEXT,
      discord_attachment_url TEXT,
      local_path TEXT,
      filename TEXT,
      uploaded_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS rates_usd (
      role TEXT,
      tier TEXT,
      rate REAL,
      PRIMARY KEY(role, tier)
    );
  `);
};

const seedRates = () => {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as count FROM rates_usd').get() as { count: number };
  if (count.count > 0) return;
  const insert = db.prepare('INSERT INTO rates_usd (role, tier, rate) VALUES (?, ?, ?)');
  const rates: Array<[string, string, number]> = [
    ['Managing Partner / Trial Chair', 'standard', 500],
    ['Managing Partner / Trial Chair', 'high-profile', 875],
    ['Managing Partner / Trial Chair', 'scotus', 1125],
    ['Equity Partner (Lead Counsel)', 'standard', 400],
    ['Equity Partner (Lead Counsel)', 'high-profile', 700],
    ['Equity Partner (Lead Counsel)', 'scotus', 900],
    ['Non-Equity Partner', 'standard', 360],
    ['Non-Equity Partner', 'high-profile', 630],
    ['Non-Equity Partner', 'scotus', 810],
    ['Of Counsel — Full-Time', 'standard', 340],
    ['Of Counsel — Full-Time', 'high-profile', 595],
    ['Of Counsel — Full-Time', 'scotus', 765],
    ['Of Counsel — Part-Time', 'standard', 300],
    ['Of Counsel — Part-Time', 'high-profile', 525],
    ['Of Counsel — Part-Time', 'scotus', 675],
    ['Senior Associate', 'standard', 280],
    ['Senior Associate', 'high-profile', 490],
    ['Senior Associate', 'scotus', 630],
    ['Mid-Level Associate', 'standard', 240],
    ['Mid-Level Associate', 'high-profile', 420],
    ['Mid-Level Associate', 'scotus', 540],
    ['Junior Associate', 'standard', 200],
    ['Junior Associate', 'high-profile', 350],
    ['Junior Associate', 'scotus', 450],
    ['Staff/Contract Attorney', 'standard', 180],
    ['Staff/Contract Attorney', 'high-profile', 315],
    ['Staff/Contract Attorney', 'scotus', 405],
    ['Senior Paralegal', 'standard', 120],
    ['Senior Paralegal', 'high-profile', 210],
    ['Senior Paralegal', 'scotus', 270],
    ['Junior Paralegal', 'standard', 100],
    ['Junior Paralegal', 'high-profile', 175],
    ['Junior Paralegal', 'scotus', 225],
    ['Law Clerk / Intern', 'standard', 80],
    ['Law Clerk / Intern', 'high-profile', 140],
    ['Law Clerk / Intern', 'scotus', 180],
    ['Investigator / Litigation Support', 'standard', 120],
    ['Investigator / Litigation Support', 'high-profile', 210],
    ['Investigator / Litigation Support', 'scotus', 270],
    ['E-Discovery Specialist', 'standard', 140],
    ['E-Discovery Specialist', 'high-profile', 245],
    ['E-Discovery Specialist', 'scotus', 315]
  ];
  const insertMany = db.transaction((rows: typeof rates) => {
    for (const row of rows) insert.run(row[0], row[1], row[2]);
  });
  insertMany(rates);
};

const seedSettings = () => {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
  if (count.count > 0) return;
  const defaults = [
    ['invoice_cadence_days', '14'],
    ['invoice_due_days', '7'],
    ['late_policy_type', 'apr'],
    ['late_policy_value', '18'],
    ['billing_min_increment', '0.1'],
    ['travel_half_rate', 'true'],
    ['internal_conference_cap', '0.3'],
    ['max_simultaneous_billable', '3'],
    ['require_retainer', 'true']
  ];
  const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  const insertMany = db.transaction((rows: typeof defaults) => {
    for (const row of rows) insert.run(row[0], row[1]);
  });
  insertMany(defaults);
};

const main = () => {
  structuredLog('info', 'Running database migrations');
  createTables();
  seedRates();
  seedSettings();
  structuredLog('info', 'Database migrations complete');
};

main();
