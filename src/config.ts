import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

type LatePolicy =
  | { type: 'apr'; value: number }
  | { type: 'flat'; value: number };

export interface BillingConfig {
  invoiceCadenceDays: number;
  invoiceDueDays: number;
  latePolicy: LatePolicy;
  minIncrementHours: number;
  travelHalfRate: boolean;
  internalConferenceCapPerDay: number;
  maxSimultaneousBillable: number;
  requireRetainer: boolean;
}

export interface AppConfig {
  intakeChannelId: string;
  archiveCategoryId: string;
  reviewChannelId: string;
  staffRoleIds: string[];
  billing: BillingConfig;
}

loadEnv();

const configPath = path.resolve(process.cwd(), 'config.json');

if (!fs.existsSync(configPath)) {
  throw new Error(`Missing config.json at ${configPath}`);
}

const configJson = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppConfig;

export const ENV = {
  token: process.env.DISCORD_TOKEN ?? '',
  clientId: process.env.CLIENT_ID ?? '',
  guildId: process.env.GUILD_ID,
  registerCommands: (process.env.REGISTER_COMMANDS ?? 'false').toLowerCase() === 'true',
  nodeEnv: process.env.NODE_ENV ?? 'development'
};

export const CONFIG: AppConfig = configJson;

export const DATA_DIR = path.resolve(process.cwd(), 'data');
const dbPathOverride = process.env.HARTLAW_DB_PATH;
export const DB_PATH = dbPathOverride ? path.resolve(dbPathOverride) : path.join(DATA_DIR, 'hartlaw.db');
export const ARCHIVE_DIR = path.join(DATA_DIR, 'archives');
export const LOG_DIR = path.resolve(process.cwd(), 'logs');

export const ensureDataDirs = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
};

ensureDataDirs();
