/**
 * Structured logging utility
 * Outputs JSON-formatted logs for production, human-readable for development
 */

import { env } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = env.LOG_LEVEL as LogLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    if (env.NODE_ENV === 'production') {
      console.log(JSON.stringify(entry));
    } else {
      const colorMap = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
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
