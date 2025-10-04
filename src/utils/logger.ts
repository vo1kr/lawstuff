import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { LOG_DIR, ENV } from '@config';

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: ENV.nodeEnv === 'development' ? 'debug' : 'info',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] ${level}: ${message}${metaString}`;
      })
    )
  }),
  new DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'hartlaw-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
];

export const logger = winston.createLogger({
  level: 'info',
  transports
});

export const structuredLog = (
  level: 'info' | 'error' | 'warn' | 'debug',
  message: string,
  meta?: Record<string, unknown>
) => {
  logger.log(level, message, meta);
};
