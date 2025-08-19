import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from '@/config';

/**
 * Winston Logger Configuration
 * Provides structured logging for the Vertical Veo 3 application
 */

// Ensure log directory exists
const logDir = config.logging.filePath;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaString = '';
    if (Object.keys(meta).length > 0) {
      metaString = '\n' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaString}`;
  })
);

// Create transports array
const transports: winston.transport[] = [];

// Console transport
transports.push(
  new winston.transports.Console({
    level: config.isDevelopment ? 'debug' : 'info',
    format: config.isDevelopment ? consoleFormat : logFormat,
  })
);

// File transports for production
if (config.isProduction || config.logging.enableMetrics) {
  // General log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      level: config.logging.level,
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  // Note: Per-category file filters are not natively supported on transports; use general logs
}

// Create the logger
const base = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

/**
 * Enhanced logging methods with context
 */

export interface LogContext {
  userId?: string;
  requestId?: string;
  operationId?: string;
  jobId?: string;
  service?: string;
  category?: string;
  duration?: number;
  [key: string]: any;
}

class EnhancedLogger {
  private baseLogger: winston.Logger;

  constructor(baseLogger: winston.Logger) {
    this.baseLogger = baseLogger;
  }

  private log(level: string, message: string, context: LogContext = {}) {
    this.baseLogger.log(level, message, {
      ...context,
      timestamp: new Date().toISOString(),
      environment: config.env,
    });
  }

  debug(message: string, context: LogContext = {}) {
    this.log('debug', message, context);
  }

  info(message: string, context: LogContext = {}) {
    this.log('info', message, context);
  }

  warn(message: string, context: LogContext = {}) {
    this.log('warn', message, context);
  }

  error(message: string, context: LogContext = {}) {
    this.log('error', message, context);
  }

  // Specialized logging methods
  veoApi(message: string, context: LogContext = {}) {
    this.log('info', message, { ...context, service: 'veo', category: 'veo' });
  }

  ffmpeg(message: string, context: LogContext = {}) {
    this.log('info', message, { ...context, service: 'ffmpeg', category: 'ffmpeg' });
  }

  queue(message: string, context: LogContext = {}) {
    this.log('info', message, { ...context, service: 'queue', category: 'queue' });
  }

  auth(message: string, context: LogContext = {}) {
    this.log('info', message, { ...context, service: 'auth', category: 'auth' });
  }

  storage(message: string, context: LogContext = {}) {
    this.log('info', message, { ...context, service: 'storage', category: 'storage' });
  }

  // Performance logging
  performance(operation: string, duration: number, context: LogContext = {}) {
    this.log('info', `Performance: ${operation}`, {
      ...context,
      category: 'performance',
      operation,
      duration,
      durationMs: duration,
    });
  }

  // Request logging
  request(method: string, path: string, statusCode: number, duration: number, context: LogContext = {}) {
    this.log('info', `${method} ${path} ${statusCode}`, {
      ...context,
      category: 'request',
      method,
      path,
      statusCode,
      duration,
      responseTime: duration,
    });
  }

  // Security logging
  security(event: string, context: LogContext = {}) {
    this.log('warn', `Security Event: ${event}`, {
      ...context,
      category: 'security',
      event,
    });
  }

  // Business metrics
  metric(metric: string, value: number, unit: string = '', context: LogContext = {}) {
    this.log('info', `Metric: ${metric}=${value}${unit}`, {
      ...context,
      category: 'metric',
      metric,
      value,
      unit,
    });
  }
}

// Create enhanced logger instance
const enhancedLogger = new EnhancedLogger(base);

// Export both the base and enhanced logger with consistent names
export { enhancedLogger as logger };
export const baseLogger = base;

/**
 * Request ID middleware helper
 */
export function withRequestId(requestId: string) {
  return {
    debug: (message: string, context: LogContext = {}) => 
      enhancedLogger.debug(message, { ...context, requestId }),
    info: (message: string, context: LogContext = {}) => 
      enhancedLogger.info(message, { ...context, requestId }),
    warn: (message: string, context: LogContext = {}) => 
      enhancedLogger.warn(message, { ...context, requestId }),
    error: (message: string, context: LogContext = {}) => 
      enhancedLogger.error(message, { ...context, requestId }),
    veoApi: (message: string, context: LogContext = {}) => 
      enhancedLogger.veoApi(message, { ...context, requestId }),
    ffmpeg: (message: string, context: LogContext = {}) => 
      enhancedLogger.ffmpeg(message, { ...context, requestId }),
  };
}

/**
 * User context helper
 */
export function withUser(userId: string) {
  return {
    debug: (message: string, context: LogContext = {}) => 
      enhancedLogger.debug(message, { ...context, userId }),
    info: (message: string, context: LogContext = {}) => 
      enhancedLogger.info(message, { ...context, userId }),
    warn: (message: string, context: LogContext = {}) => 
      enhancedLogger.warn(message, { ...context, userId }),
    error: (message: string, context: LogContext = {}) => 
      enhancedLogger.error(message, { ...context, userId }),
  };
}

/**
 * Operation context helper
 */
export function withOperation(operationId: string) {
  return {
    debug: (message: string, context: LogContext = {}) => 
      enhancedLogger.debug(message, { ...context, operationId }),
    info: (message: string, context: LogContext = {}) => 
      enhancedLogger.info(message, { ...context, operationId }),
    warn: (message: string, context: LogContext = {}) => 
      enhancedLogger.warn(message, { ...context, operationId }),
    error: (message: string, context: LogContext = {}) => 
      enhancedLogger.error(message, { ...context, operationId }),
  };
}

/**
 * Timer utility for performance logging
 */
export class Timer {
  private startTime: number;
  private operation: string;
  private context: LogContext;

  constructor(operation: string, context: LogContext = {}) {
    this.startTime = Date.now();
    this.operation = operation;
    this.context = context;
    enhancedLogger.debug(`Starting: ${operation}`, context);
  }

  end(message?: string) {
    const duration = Date.now() - this.startTime;
    const finalMessage = message || `Completed: ${this.operation}`;
    enhancedLogger.performance(finalMessage, duration, this.context);
    return duration;
  }

  endWithResult<T>(result: T, message?: string): T {
    this.end(message);
    return result;
  }
}

/**
 * Async function timer decorator
 */
export function timed(operation: string, context: LogContext = {}) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value;
    if (!originalMethod) return;

    descriptor.value = async function (...args: any[]) {
      const timer = new Timer(`${operation}:${propertyKey}`, context);
      try {
        const result = await originalMethod.apply(this, args);
        timer.end();
        return result;
      } catch (error) {
        timer.end(`Failed: ${operation}:${propertyKey}`);
        throw error;
      }
    } as T;
  };
}

// Initialize logger
if (config.isDevelopment) {
  enhancedLogger.info('Logger initialized', {
    level: config.logging.level,
    environment: config.env,
    logDir: config.logging.filePath,
  });
}

export default enhancedLogger;
