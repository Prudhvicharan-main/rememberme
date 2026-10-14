/**
 * Logging utility with configurable log levels.
 * Helps with debugging while keeping console clean in production.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  level: LogLevel;
  prefix?: string;
}

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  private config: LogConfig;

  constructor(config: LogConfig = { level: 'warn', prefix: '[RememberMe]' }) {
    this.config = config;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  debug(...args: any[]): void {
    if (this.shouldLog('debug')) console.debug(this.config.prefix, ...args);
  }

  info(...args: any[]): void {
    if (this.shouldLog('info')) console.info(this.config.prefix, ...args);
  }

  warn(...args: any[]): void {
    if (this.shouldLog('warn')) console.warn(this.config.prefix, ...args);
  }

  error(...args: any[]): void {
    if (this.shouldLog('error')) console.error(this.config.prefix, ...args);
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

export const logger = new Logger({
  level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
  prefix: '[RememberMe]',
});
