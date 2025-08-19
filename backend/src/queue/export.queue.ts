import { Queue, QueueOptions, JobsOptions } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';

interface ExportJobQueueData {
  exportJobId: string;
  originalJobId: string;
  userId: string;
  sourceMediaId: string;
  exportType: 'METADATA_ROTATE' | 'GUARANTEED_UPRIGHT' | 'SCALE_PAD' | 'HORIZONTAL';
  resolution: string;
  fps: number;
  preset?: string;
  crf?: number;
  cropX?: number;
  cropY?: number;
  platform?: string;
  requestMetadata?: Record<string, any>;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

class ExportQueue {
  private queue: Queue<ExportJobQueueData>;
  private readonly queueName = 'export-queue';

  constructor() {
    if (!config.queuesEnabled) {
      this.queue = {
        add: async () => ({ id: 'noop', isCompleted: async () => true }),
        getWaiting: async () => [],
        getActive: async () => [],
        getCompleted: async () => [],
        getFailed: async () => [],
        getDelayed: async () => [],
        isPaused: async () => false,
        pause: async () => {},
        resume: async () => {},
        clean: async () => {},
        close: async () => {},
        on: () => this,
      } as unknown as Queue<ExportJobQueueData>;

      logger.warn('Queues are disabled; using no-op export queue');
      return;
    }

    const queueOptions: QueueOptions = {
      connection: {
        host: config.redis.url.includes('://') ? new URL(config.redis.url).hostname : config.redis.url,
        port: config.redis.url.includes('://') ? new URL(config.redis.url).port ? parseInt(new URL(config.redis.url).port) : 6379 : 6379,
        password: config.redis.password,
      },
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 100,
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        delay: 0,
      },
    };

    this.queue = new Queue(this.queueName, queueOptions);
    this.setupEventHandlers();

    logger.info('Export queue initialized', {
      queueName: this.queueName,
      redis: config.redis.url,
    });
  }

  async addExportJob(
    jobData: ExportJobQueueData,
    options: { priority?: number; delay?: number; attempts?: number } = {}
  ) {
    try {
      const jobOptions: JobsOptions = {
        priority: options.priority ?? 5,
        delay: options.delay ?? 0,
        attempts: options.attempts ?? 2,
        removeOnComplete: 50,
        removeOnFail: 100,
        backoff: { type: 'exponential', delay: 3000 },
      };

      const enhancedJobData = {
        ...jobData,
        queuedAt: new Date().toISOString(),
      };

      const job = await this.queue.add('export-video', enhancedJobData, jobOptions);

      logger.info('Export job added to queue', {
        queueJobId: job.id,
        exportJobId: jobData.exportJobId,
        exportType: jobData.exportType,
        resolution: jobData.resolution,
      });

      return { jobId: job.id };

    } catch (error) {
      logger.error('Failed to add export job to queue', {
        exportJobId: jobData.exportJobId,
        error: (error as Error).message,
      });
      throw new Error(`Failed to queue export: ${(error as Error).message}`);
    }
  }

  async getStats(): Promise<QueueStats> {
    try {
      const waiting = await this.queue.getWaiting();
      const active = await this.queue.getActive();
      const completed = await this.queue.getCompleted();
      const failed = await this.queue.getFailed();
      const delayed = await this.queue.getDelayed();
      const paused = await this.queue.isPaused();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused,
      };

    } catch (error) {
      logger.error('Failed to get export queue stats', {
        error: (error as Error).message,
      });
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false,
      };
    }
  }

  async getQueueInfo() {
    try {
      const stats = await this.getStats();
      return {
        ...stats,
        queueName: this.queueName,
        concurrency: config.queue.export.concurrency,
        isHealthy: stats.failed < 10,
      };
    } catch (error) {
      logger.error('Failed to get export queue info', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info('Export queue paused');
  }

  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info('Export queue resumed');
  }

  async clean(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      await this.queue.clean(olderThanMs, 100, 'completed');
      await this.queue.clean(olderThanMs * 3, 200, 'failed');
    } catch (error) {
      logger.warn('Export queue cleanup failed', { error: (error as Error).message });
    }
  }

  async close(): Promise<void> {
    await this.queue.close();
    logger.info('Export queue closed');
  }

  private setupEventHandlers(): void {
    this.queue.on('error', (error) => {
      logger.error('Export queue error', {
        error: error.message,
        stack: (error as any).stack,
      });
    });

    this.queue.on('waiting', (job) => {
      logger.debug('Export job waiting', { jobId: job.id as string });
    });
    // Other queue-level events can be added here if needed (e.g., 'removed', 'drained', 'paused', 'resumed')
  }
}

export const exportQueue = new ExportQueue();

export type { ExportJobQueueData };


