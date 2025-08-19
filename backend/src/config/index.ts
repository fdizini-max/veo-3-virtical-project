import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

/**
 * Configuration Schema Validation
 * Ensures all required environment variables are present and valid
 */

const configSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  DATABASE_SSL: z.string().transform(val => val === 'true').default('false'),
  
  // Redis
  REDIS_URL: z.string().min(1, 'Redis URL is required'),
  REDIS_PASSWORD: z.string().optional(),
  
  // API Keys
  GEMINI_API_KEY: z.string().min(1, 'Gemini API key is required'),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash-lite'),
  
  // Google Cloud
  GOOGLE_CLOUD_PROJECT_ID: z.string().min(1, 'GCP Project ID is required'),
  GOOGLE_CLOUD_STORAGE_BUCKET: z.string().min(1, 'GCS bucket name is required'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  
  // Veo 3 Settings
  VEO3_MODEL: z.string().default('veo-3.0-generate-preview'),
  VEO3_FAST_MODEL: z.string().default('veo-3.0-fast'),
  VEO3_MAX_DURATION: z.string().transform(Number).default('10'),
  VEO3_DEFAULT_FPS: z.string().transform(Number).default('30'),
  VEO3_DEFAULT_RESOLUTION: z.string().default('1920x1080'),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  
  // Storage
  STORAGE_TYPE: z.enum(['local', 'gcs']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),
  CDN_URL: z.string().optional(),
  CDN_CACHE_CONTROL: z.string().default('public, max-age=31536000'),
  
  // FFmpeg
  FFMPEG_PATH: z.string().default('/usr/bin/ffmpeg'),
  FFMPEG_THREADS: z.string().transform(Number).default('4'),
  FFMPEG_TIMEOUT: z.string().transform(Number).default('300000'),
  
  // Generation Limits
  MAX_PROMPT_LENGTH: z.string().transform(Number).default('500'),
  MAX_GENERATIONS_PER_USER_PER_DAY: z.string().transform(Number).default('10'),
  MAX_FILE_SIZE_MB: z.string().transform(Number).default('100'),
  
  // Export Settings
  EXPORT_CRF: z.string().transform(Number).default('18'),
  EXPORT_PRESET: z.enum(['ultrafast', 'fast', 'medium', 'slow', 'veryslow']).default('medium'),
  
  // Queue Settings
  QUEUE_GENERATION_CONCURRENCY: z.string().transform(Number).default('2'),
  QUEUE_EXPORT_CONCURRENCY: z.string().transform(Number).default('4'),
  QUEUE_CLEANUP_SCHEDULE: z.string().default('0 2 * * *'),
  
  // Job Retention
  JOB_RETENTION_COMPLETED: z.string().transform(Number).default('86400000'),
  JOB_RETENTION_FAILED: z.string().transform(Number).default('259200000'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  RATE_LIMIT_GENERATION_PER_HOUR: z.string().transform(Number).default('5'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs'),
  ENABLE_METRICS: z.string().transform(val => val === 'true').default('true'),
  SENTRY_DSN: z.string().optional(),

  // Feature Flags
  ENABLE_QUEUES: z.string().transform(val => val === 'true').default('true'),
  
  // Optional Services
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  
  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
});

// Parse and validate environment variables
const env = configSchema.parse(process.env);

/**
 * Typed Configuration Object
 * Provides strongly-typed access to all configuration values
 */
export const config = {
  // Environment
  env: env.NODE_ENV,
  port: env.PORT,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  // URLs
  frontendUrl: env.FRONTEND_URL,
  
  // Database
  database: {
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL,
  },
  
  // Redis
  redis: {
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
  },
  
  // Gemini API
  gemini: {
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
  },
  
  // Google Cloud
  gcp: {
    projectId: env.GOOGLE_CLOUD_PROJECT_ID,
    storageBucket: env.GOOGLE_CLOUD_STORAGE_BUCKET,
    credentialsPath: env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  
  // Veo 3 Configuration
  veo3: {
    model: env.VEO3_MODEL,
    fastModel: env.VEO3_FAST_MODEL,
    maxDuration: env.VEO3_MAX_DURATION,
    defaultFps: env.VEO3_DEFAULT_FPS,
    defaultResolution: env.VEO3_DEFAULT_RESOLUTION,
  },
  
  // Security
  security: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    sessionSecret: env.SESSION_SECRET,
    encryptionKey: env.ENCRYPTION_KEY,
  },
  
  // Storage
  storage: {
    type: env.STORAGE_TYPE,
    localPath: env.STORAGE_LOCAL_PATH,
    cdnUrl: env.CDN_URL,
    cacheControl: env.CDN_CACHE_CONTROL,
  },
  
  // FFmpeg
  ffmpeg: {
    path: env.FFMPEG_PATH,
    threads: env.FFMPEG_THREADS,
    timeout: env.FFMPEG_TIMEOUT,
  },
  
  // Generation Limits
  limits: {
    maxPromptLength: env.MAX_PROMPT_LENGTH,
    maxGenerationsPerUserPerDay: env.MAX_GENERATIONS_PER_USER_PER_DAY,
    maxFileSizeMB: env.MAX_FILE_SIZE_MB,
  },
  
  // Export Settings
  export: {
    crf: env.EXPORT_CRF,
    preset: env.EXPORT_PRESET,
    presets: {
      tiktok: { resolution: '1080x1920', fps: 30 },
      reels: { resolution: '1080x1920', fps: 30 },
      shorts: { resolution: '1080x1920', fps: 30 },
    },
  },
  
  // Queue Configuration
  queue: {
    generation: {
      concurrency: env.QUEUE_GENERATION_CONCURRENCY,
    },
    export: {
      concurrency: env.QUEUE_EXPORT_CONCURRENCY,
    },
    cleanup: {
      schedule: env.QUEUE_CLEANUP_SCHEDULE,
    },
    retention: {
      completed: env.JOB_RETENTION_COMPLETED,
      failed: env.JOB_RETENTION_FAILED,
    },
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    generationPerHour: env.RATE_LIMIT_GENERATION_PER_HOUR,
  },
  
  // Logging
  logging: {
    level: env.LOG_LEVEL,
    filePath: env.LOG_FILE_PATH,
    enableMetrics: env.ENABLE_METRICS,
    sentryDsn: env.SENTRY_DSN,
  },

  // Feature Flags
  queuesEnabled: env.ENABLE_QUEUES,
  
  // Optional Services
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },
  
  email: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.EMAIL_FROM,
  },
} as const;

/**
 * Configuration Validation
 * Validates that all required services are properly configured
 */
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required API keys
  if (!config.gemini.apiKey) {
    errors.push('Gemini API key is required');
  }
  
  // Check database connection
  if (!config.database.url) {
    errors.push('Database URL is required');
  }
  
  // Check Redis connection unless queues are disabled
  if (config.queuesEnabled) {
    if (!config.redis.url) {
      errors.push('Redis URL is required');
    }
  }
  
  // Check GCP configuration if using GCS storage
  if (config.storage.type === 'gcs') {
    if (!config.gcp.projectId) {
      errors.push('GCP Project ID is required for GCS storage');
    }
    if (!config.gcp.storageBucket) {
      errors.push('GCS bucket name is required for GCS storage');
    }
  }
  
  // Check JWT configuration
  if (config.security.jwtSecret.length < 32) {
    errors.push('JWT secret must be at least 32 characters long');
  }
  
  // Check FFmpeg path in production
  if (config.isProduction && config.ffmpeg.path === '/usr/bin/ffmpeg') {
    // This is just a warning, not an error
    console.warn('Using default FFmpeg path in production. Ensure FFmpeg is installed.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get configuration for specific service
 */
export function getServiceConfig(service: string) {
  const serviceConfigs = {
    veo: {
      apiKey: config.gemini.apiKey,
      model: config.veo3.model,
      fastModel: config.veo3.fastModel,
      maxDuration: config.veo3.maxDuration,
    },
    storage: {
      type: config.storage.type,
      localPath: config.storage.localPath,
      gcsBucket: config.gcp.storageBucket,
      cdnUrl: config.storage.cdnUrl,
    },
    queue: {
      redis: config.redis,
      concurrency: {
        generation: config.queue.generation.concurrency,
        export: config.queue.export.concurrency,
      },
      retention: config.queue.retention,
    },
    ffmpeg: {
      path: config.ffmpeg.path,
      threads: config.ffmpeg.threads,
      timeout: config.ffmpeg.timeout,
      crf: config.export.crf,
      preset: config.export.preset,
    },
  };
  
  return serviceConfigs[service as keyof typeof serviceConfigs];
}

// Export individual config sections for convenience
export const {
  env: environment,
  port,
  isDevelopment,
  isProduction,
  database,
  redis,
  gemini,
  gcp,
  veo3,
  security,
  storage,
  ffmpeg,
  limits,
  queue,
  rateLimit,
  logging,
} = config;

export default config;
