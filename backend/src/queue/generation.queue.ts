import { Queue, QueueOptions, JobsOptions } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';

/**
 * Generation Queue - Manages video generation job queue
 * 
 * This queue handles:
 * - Adding new generation jobs
 * - Job prioritization and scheduling
 * - Retry logic and failure handling
 * - Queue monitoring and management
 */

interface GenerationJobData {
  generationId: string;
  userId: string;
  prompt: string;
  mode: 'VERTICAL_FIRST' | 'HORIZONTAL';
  duration: number;
  fps: number;
  resolution: string;
  backgroundMode: 'SOLID_COLOR' | 'GREENSCREEN' | 'MINIMAL_GRADIENT' | 'CUSTOM';
  referenceImageUrl?: string;
  useFastModel: boolean;
  priority?: 'low' | 'normal' | 'high';
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

/**
 * Generation Queue Class
 */
class GenerationQueue {
  private queue: Queue<GenerationJobData>;
  private readonly queueName = 'generation-queue';

  constructor() {
    if (!config.queuesEnabled) {
      // Create a no-op queue shim when queues are disabled
      // @ts-expect-error - we are providing a minimal shim that satisfies used methods
      this.queue = {
        add: async () => ({ id: 'noop', isCompleted: async () => true }),
        getStats: async () => ({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: false }),
        getQueueInfo: async () => ({ isHealthy: true, estimatedWaitTime: 0 }),
        getJob: async () => null,
        pause: async () => {},
        resume: async () => {},
        clean: async () => {},
        close: async () => {},
        getWaiting: async () => [],
        getActive: async () => [],
        getCompleted: async () => [],
        getFailed: async () => [],
        getDelayed: async () => [],
        isPaused: async () => false,
        on: () => this,
        client: { ping: async () => 'PONG' },
      } as unknown as Queue<GenerationJobData>;

      logger.warn('Queues are disabled; using no-op generation queue');
      return;
    }

    const queueOptions: QueueOptions = {
      connection: {
        host: config.redis.url.includes('://') ? new URL(config.redis.url).hostname : config.redis.url,
        port: config.redis.url.includes('://') ? new URL(config.redis.url).port ? parseInt(new URL(config.redis.url).port) : 6379 : 6379,
        password: config.redis.password,
      },
      defaultJobOptions: {
        removeOnComplete: 20, // Keep last 20 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3, // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay
        },
        delay: 0, // No delay by default
      },
    };

    this.queue = new Queue(this.queueName, queueOptions);

    this.setupEventHandlers();

    logger.info('Generation queue initialized', {
      queueName: this.queueName,
      redis: config.redis.url,
    });
  }

  /**
   * Add a new generation job to the queue
   */
  async addGenerationJob(
    jobData: GenerationJobData,
    options: {
      priority?: number;
      delay?: number;
      attempts?: number;
      webhook?: string;
    } = {}
  ) {
    try {
      const jobOptions: JobsOptions = {
        priority: this.getPriorityScore(jobData.priority || 'normal'),
        delay: options.delay || 0,
        attempts: options.attempts || 3,
        removeOnComplete: 20,
        removeOnFail: 50,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      };

      // Add job metadata
      const enhancedJobData = {
        ...jobData,
        queuedAt: new Date().toISOString(),
        webhook: options.webhook,
        estimatedProcessingTime: this.estimateProcessingTime(jobData),
      };

      const job = await this.queue.add(
        'generate-video',
        enhancedJobData,
        jobOptions
      );

      logger.info('Generation job added to queue', {
        jobId: job.id,
        generationId: jobData.generationId,
        userId: jobData.userId,
        priority: jobData.priority,
        mode: jobData.mode,
        duration: jobData.duration,
        estimatedTime: enhancedJobData.estimatedProcessingTime
      });

      return {
        jobId: job.id,
        estimatedWaitTime: await this.estimateWaitTime(),
        queuePosition: await this.getQueuePosition(job.id!),
      };

    } catch (error) {
      logger.error('Failed to add generation job to queue', {
        generationId: jobData.generationId,
        error: error.message
      });
      throw new Error(`Failed to queue generation: ${error.message}`);
    }
  }

  /**
   * Cancel a generation job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      
      if (!job) {
        logger.warn('Attempted to cancel non-existent job', { jobId });
        return false;
      }

      // Check if job is already completed
      if (await job.isCompleted()) {
        logger.warn('Attempted to cancel completed job', { jobId });
        return false;
      }

      // Remove the job
      await job.remove();

      logger.info('Generation job cancelled', {
        jobId,
        generationId: job.data.generationId
      });

      return true;

    } catch (error) {
      logger.error('Failed to cancel generation job', {
        jobId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      
      if (!job) {
        logger.warn('Attempted to retry non-existent job', { jobId });
        return false;
      }

      if (!(await job.isFailed())) {
        logger.warn('Attempted to retry non-failed job', { jobId });
        return false;
      }

      await job.retry();

      logger.info('Generation job retried', {
        jobId,
        generationId: job.data.generationId
      });

      return true;

    } catch (error) {
      logger.error('Failed to retry generation job', {
        jobId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get job status and details
   */
  async getJobStatus(jobId: string) {
    try {
      const job = await this.queue.getJob(jobId);
      
      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progress = job.progress;

      return {
        jobId: job.id,
        generationId: job.data.generationId,
        state,
        progress,
        data: job.data,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        opts: job.opts,
      };

    } catch (error) {
      logger.error('Failed to get job status', {
        jobId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    try {
      const waiting = await this.queue.getWaiting();
      const active = await this.queue.getActive();
      const completed = await this.queue.getCompleted();
      const failed = await this.queue.getFailed();
      const delayed = await this.queue.getDelayed();
      const isPaused = await this.queue.isPaused();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: isPaused,
      };

    } catch (error) {
      logger.error('Failed to get queue stats', {
        error: error.message
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

  /**
   * Get detailed queue information
   */
  async getQueueInfo() {
    try {
      const stats = await this.getStats();
      const waitTime = await this.estimateWaitTime();
      
      return {
        ...stats,
        estimatedWaitTime: waitTime,
        concurrency: config.queue.generation.concurrency,
        queueName: this.queueName,
        isHealthy: await this.isHealthy(),
      };

    } catch (error) {
      logger.error('Failed to get queue info', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanup(olderThan: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      // Clean completed jobs older than specified time
      await this.queue.clean(olderThan, 100, 'completed');
      
      // Clean failed jobs older than specified time (keep more for analysis)
      await this.queue.clean(olderThan * 3, 200, 'failed');

      logger.info('Queue cleanup completed', {
        olderThan: olderThan / (60 * 60 * 1000) + ' hours'
      });

    } catch (error) {
      logger.error('Queue cleanup failed', {
        error: error.message
      });
    }
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info('Generation queue paused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info('Generation queue resumed');
  }

  /**
   * Get jobs by user ID
   */
  async getJobsByUser(userId: string, limit: number = 50) {
    try {
      const jobs = await this.queue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, limit);
      
      return jobs
        .filter(job => job.data.userId === userId)
        .map(job => ({
          jobId: job.id,
          generationId: job.data.generationId,
          state: job.opts.delay ? 'delayed' : 'waiting',
          progress: job.progress,
          createdAt: new Date(job.timestamp),
          processedOn: job.processedOn ? new Date(job.processedOn) : null,
          finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
          failedReason: job.failedReason,
        }));

    } catch (error) {
      logger.error('Failed to get jobs by user', {
        userId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Estimate processing time for a job
   */
  private estimateProcessingTime(jobData: GenerationJobData): number {
    let baseTime = 120; // 2 minutes base

    // Adjust for duration
    baseTime += jobData.duration * 15; // 15 seconds per second of video

    // Adjust for complexity
    if (jobData.referenceImageUrl) {
      baseTime += 30; // Image-to-video adds time
    }

    if (jobData.useFastModel) {
      baseTime *= 0.6; // Fast model is ~40% faster
    }

    // Adjust for mode (vertical-first might take slightly longer)
    if (jobData.mode === 'VERTICAL_FIRST') {
      baseTime *= 1.1;
    }

    return Math.round(baseTime);
  }

  /**
   * Estimate wait time for new jobs
   */
  private async estimateWaitTime(): Promise<number> {
    try {
      const stats = await this.getStats();
      const avgProcessingTime = 180; // 3 minutes average
      const concurrency = config.queue.generation.concurrency;
      
      // Calculate wait time based on queue length and concurrency
      const waitingJobs = stats.waiting;
      const activeJobs = stats.active;
      
      if (waitingJobs === 0) {
        return 0; // No wait if queue is empty
      }

      // Estimate based on current load
      const availableSlots = Math.max(concurrency - activeJobs, 0);
      
      if (availableSlots > 0) {
        return Math.ceil(waitingJobs / availableSlots) * avgProcessingTime;
      } else {
        return waitingJobs * avgProcessingTime;
      }

    } catch (error) {
      logger.error('Failed to estimate wait time', {
        error: error.message
      });
      return 300; // Default to 5 minutes
    }
  }

  /**
   * Get position of a job in the queue
   */
  private async getQueuePosition(jobId: string): Promise<number> {
    try {
      const waitingJobs = await this.queue.getWaiting();
      const position = waitingJobs.findIndex(job => job.id === jobId);
      return position >= 0 ? position + 1 : 0;
    } catch (error) {
      logger.error('Failed to get queue position', {
        jobId,
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Convert priority string to numeric score
   */
  private getPriorityScore(priority: 'low' | 'normal' | 'high'): number {
    const priorities = {
      low: 1,
      normal: 5,
      high: 10,
    };
    return priorities[priority] || priorities.normal;
  }

  /**
   * Check if queue is healthy
   */
  private async isHealthy(): Promise<boolean> {
    try {
      // Check Redis connection
      await this.queue.client.ping();
      
      // Check if there are any stalled jobs
      const stats = await this.getStats();
      const stalledThreshold = 10; // Consider unhealthy if more than 10 jobs are stalled
      
      return stats.failed < stalledThreshold;

    } catch (error) {
      logger.error('Queue health check failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.queue.on('error', (error) => {
      logger.error('Generation queue error', {
        error: error.message,
        stack: error.stack
      });
    });

    this.queue.on('waiting', (jobId) => {
      logger.debug('Job waiting', { jobId });
    });

    this.queue.on('active', (job) => {
      logger.info('Job started processing', {
        jobId: job.id,
        generationId: job.data.generationId
      });
    });

    this.queue.on('stalled', (jobId) => {
      logger.warn('Job stalled', { jobId });
    });

    this.queue.on('progress', (job, progress) => {
      logger.debug('Job progress updated', {
        jobId: job.id,
        generationId: job.data.generationId,
        progress
      });
    });

    this.queue.on('completed', (job, result) => {
      logger.info('Job completed', {
        jobId: job.id,
        generationId: job.data.generationId,
        success: result.success
      });
    });

    this.queue.on('failed', (job, error) => {
      logger.error('Job failed', {
        jobId: job?.id,
        generationId: job?.data?.generationId,
        error: error.message,
        attempts: job?.attemptsMade
      });
    });

    this.queue.on('removed', (job) => {
      logger.info('Job removed', {
        jobId: job.id,
        generationId: job.data.generationId
      });
    });
  }

  /**
   * Close the queue connection
   */
  async close(): Promise<void> {
    await this.queue.close();
    logger.info('Generation queue closed');
  }
}

// Create and export queue instance
export const generationQueue = new GenerationQueue();

// Export for testing
export { GenerationQueue };
