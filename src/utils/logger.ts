/**
 * Structured logging utility
 *
 * Reads LOG_LEVEL and NODE_ENV from process.env on each call
 * (via getters) so it works in Cloudflare Workers where
 * process.env is populated after module load.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error'];

class Logger {
  private get logLevel(): LogLevel {
    const level = process.env.LOG_LEVEL as LogLevel | undefined;
    return level && LEVEL_ORDER.includes(level) ? level : 'info';
  }

  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(this.logLevel);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    if (this.isProduction) {
      console.log(JSON.stringify(entry));
    } else {
      const colorMap = {
        debug: '\x1b[36m',
        info: '\x1b[32m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
      };
      const reset = '\x1b[0m';
      console.log(
        `${colorMap[level]}[${level.toUpperCase()}]${reset} ${message}`,
        meta ? JSON.stringify(meta, null, 2) : ''
      );
    }
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown> | Error) {
    if (meta instanceof Error) {
      this.log('error', message, {
        error: meta.message,
        stack: meta.stack,
      });
    } else {
      this.log('error', message, meta);
    }
  }
}

export const logger = new Logger();
