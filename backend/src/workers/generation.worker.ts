import { Worker, Job, WorkerOptions } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { veoService } from '@/services/veo.service';
import { storageService } from '@/services/storage.service';
import { pollingService } from '@/services/polling.service';
import { logger, Timer } from '@/utils/logger';
import { config } from '@/config';
import { VeoGenerationRequest, VeoJobStatus } from '@/types/veo.types';

/**
 * Generation Worker - Processes video generation jobs in background
 * 
 * This worker handles the complete video generation pipeline:
 * 1. Receives generation jobs from the queue
 * 2. Calls Veo 3 API through the veoService
 * 3. Polls for completion status
 * 4. Downloads and stores the generated video
 * 5. Updates database with results
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
  requestMetadata?: Record<string, any>;
}

interface GenerationJobResult {
  success: boolean;
  generationId: string;
  outputMediaId?: string;
  veoOperationId?: string;
  processingTime: number;
  actualCost?: number;
  error?: string;
  metadata?: any;
}

const prisma = new PrismaClient();

/**
 * Generation Worker Class
 */
class GenerationWorker {
  private worker: Worker;
  private isShuttingDown = false;

  constructor() {
    const workerOptions: WorkerOptions = {
      connection: {
        host: config.redis.url.includes('://') ? new URL(config.redis.url).hostname : config.redis.url,
        port: config.redis.url.includes('://') ? new URL(config.redis.url).port ? parseInt(new URL(config.redis.url).port) : 6379 : 6379,
        password: config.redis.password,
      },
      concurrency: config.queue.generation.concurrency,
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
      maxStalledCount: 3, // Retry stalled jobs 3 times
      stalledInterval: 30000, // Check for stalled jobs every 30 seconds
    };

    this.worker = new Worker('generation-queue', this.processJob.bind(this), workerOptions);

    this.setupEventHandlers();
    this.setupGracefulShutdown();

    logger.info('Generation worker initialized', {
      concurrency: config.queue.generation.concurrency,
      redis: config.redis.url,
    });
  }

  /**
   * Process a single generation job
   */
  private async processJob(job: Job<GenerationJobData>): Promise<GenerationJobResult> {
    const timer = new Timer('generation-job', {
      jobId: job.id,
      generationId: job.data.generationId,
      userId: job.data.userId
    });

    logger.info('Starting generation job', {
      jobId: job.id,
      generationId: job.data.generationId,
      userId: job.data.userId,
      mode: job.data.mode,
      duration: job.data.duration
    });

    try {
      // Update job progress and database status
      await this.updateJobProgress(job, 5, 'Initializing generation...');
      await this.updateGenerationStatus(job.data.generationId, 'PROCESSING', 5);

      // Prepare Veo 3 request
      await this.updateJobProgress(job, 10, 'Preparing API request...');
      const veoRequest = this.buildVeoRequest(job.data);

      // Call Veo 3 API
      await this.updateJobProgress(job, 15, 'Submitting to Veo 3 API...');
      const veoResponse = await veoService.generateVideo(veoRequest);

      logger.veoApi('Veo 3 generation started', {
        jobId: job.id,
        generationId: job.data.generationId,
        operationId: veoResponse.operationId,
        estimatedTime: veoResponse.estimatedCompletionTime
      });

      // Store operation ID in database
      await this.updateGenerationOperationId(job.data.generationId, veoResponse.operationId);

      // Poll for completion using enhanced polling service
      await this.updateJobProgress(job, 20, 'AI is generating your video...');
      const completedOperation = await this.pollForCompletionEnhanced(
        job,
        veoResponse.operationId,
        veoResponse.estimatedCompletionTime
      );

      if (!completedOperation.videoUrl) {
        throw new Error('Video generation completed but no video URL received');
      }

      // Download and store video
      await this.updateJobProgress(job, 85, 'Downloading generated video...');
      const filename = this.generateFilename(job.data);
      const storagePath = await veoService.downloadVideo(completedOperation.videoUrl, filename);

      // Create media record
      await this.updateJobProgress(job, 95, 'Finalizing video...');
      const mediaRecord = await this.createMediaRecord(job.data, storagePath, filename);

      // Update generation with final results
      await this.updateJobProgress(job, 100, 'Generation completed!');
      await this.updateGenerationCompleted(
        job.data.generationId,
        mediaRecord.id,
        veoResponse.estimatedCompletionTime
      );

      const processingTime = timer.end('Generation completed successfully');

      logger.info('Generation job completed', {
        jobId: job.id,
        generationId: job.data.generationId,
        mediaId: mediaRecord.id,
        processingTime,
        operationId: veoResponse.operationId
      });

      return {
        success: true,
        generationId: job.data.generationId,
        outputMediaId: mediaRecord.id,
        veoOperationId: veoResponse.operationId,
        processingTime,
        metadata: completedOperation.metadata
      };

    } catch (error) {
      const processingTime = timer.end('Generation failed');

      logger.error('Generation job failed', {
        jobId: job.id,
        generationId: job.data.generationId,
        error: error.message,
        stack: error.stack,
        processingTime
      });

      // Update generation status to failed
      await this.updateGenerationStatus(
        job.data.generationId,
        'FAILED',
        0,
        error.message
      );

      return {
        success: false,
        generationId: job.data.generationId,
        processingTime,
        error: error.message
      };
    }
  }

  /**
   * Build Veo 3 API request from job data
   */
  private buildVeoRequest(jobData: GenerationJobData): VeoGenerationRequest {
    return {
      userId: jobData.userId,
      prompt: jobData.prompt,
      mode: jobData.mode as any,
      duration: jobData.duration,
      fps: jobData.fps,
      resolution: jobData.resolution,
      backgroundMode: jobData.backgroundMode as any,
      referenceImageUrl: jobData.referenceImageUrl,
      useFastModel: jobData.useFastModel,
      requestId: jobData.generationId,
      clientMetadata: jobData.requestMetadata
    };
  }

  /**
   * Enhanced poll for completion using polling service
   */
  private async pollForCompletionEnhanced(
    job: Job<GenerationJobData>,
    operationId: string,
    estimatedTime: number
  ) {
    return new Promise((resolve, reject) => {
      // Set up progress tracking
      let lastProgress = 20;

      pollingService.startPolling(operationId, {
        maxPolls: 360, // 30 minutes max
        initialInterval: 5000, // 5 seconds
        maxInterval: 15000, // 15 seconds max
        backoffMultiplier: 1.05, // Gentle backoff
        
        onProgress: async (status) => {
          try {
            // Check if worker is shutting down
            if (this.isShuttingDown) {
              pollingService.stopPolling(operationId);
              reject(new Error('Worker is shutting down'));
              return;
            }

            // Calculate combined progress (20% base + 65% from polling)
            const pollingProgress = Math.min((status.progress || 0) * 0.65, 65);
            const currentProgress = Math.min(lastProgress + pollingProgress, 85);

            // Update job progress
            await this.updateJobProgress(
              job,
              currentProgress,
              this.getProgressMessage(status.status, status.progress || 0)
            );

            // Update database
            await this.updateGenerationStatus(
              job.data.generationId,
              status.status as any,
              currentProgress
            );

            // Log progress every 10 polls
            const pollingStats = pollingService.getPollingStatus(operationId);
            if (pollingStats && pollingStats.pollCount % 10 === 0) {
              logger.veoApi('Generation polling progress', {
                jobId: job.id,
                operationId,
                status: status.status,
                progress: currentProgress,
                pollCount: pollingStats.pollCount,
                estimatedTimeRemaining: status.estimatedTimeRemaining
              });
            }

          } catch (error) {
            logger.error('Error updating progress during polling', {
              jobId: job.id,
              operationId,
              error: error.message
            });
          }
        },

        onComplete: (status) => {
          logger.info('Veo 3 generation completed', {
            jobId: job.id,
            operationId,
            videoUrl: status.videoUrl,
            processingTime: status.metadata?.processingTime
          });
          resolve(status);
        },

        onError: (error) => {
          logger.error('Veo 3 generation failed during polling', {
            jobId: job.id,
            operationId,
            error: error.message
          });
          reject(error);
        }
      });
    });
  }

  /**
   * Get user-friendly progress message
   */
  private getProgressMessage(status: VeoJobStatus, progress: number): string {
    switch (status) {
      case 'PENDING':
        return 'Preparing generation...';
      case 'QUEUED':
        return 'Waiting in Veo 3 queue...';
      case 'PROCESSING':
        if (progress < 30) return 'AI is analyzing your prompt...';
        if (progress < 60) return 'Generating video frames...';
        if (progress < 90) return 'Applying final touches...';
        return 'Almost ready...';
      case 'COMPLETED':
        return 'Generation completed!';
      case 'FAILED':
        return 'Generation failed';
      default:
        return 'Processing...';
    }
  }

  /**
   * Generate filename for the video
   */
  private generateFilename(jobData: GenerationJobData): string {
    const timestamp = Date.now();
    const mode = jobData.mode.toLowerCase();
    const duration = jobData.duration;
    const userId = jobData.userId.substring(0, 8);
    
    return `gen_${userId}_${mode}_${duration}s_${timestamp}.mp4`;
  }

  /**
   * Create media record in database
   */
  private async createMediaRecord(
    jobData: GenerationJobData,
    storagePath: string,
    filename: string
  ) {
    try {
      // Get file metadata from storage
      const metadata = await storageService.getFileMetadata(storagePath);
      const publicUrl = storageService.getPublicUrl(storagePath);

      return await prisma.media.create({
        data: {
          userId: jobData.userId,
          filename,
          originalName: filename,
          mimeType: 'video/mp4',
          fileSize: metadata.size,
          storageType: config.storage.type.toUpperCase() as any,
          storagePath,
          publicUrl,
          duration: jobData.duration,
          width: jobData.mode === 'VERTICAL_FIRST' ? 1080 : 1920,
          height: jobData.mode === 'VERTICAL_FIRST' ? 1920 : 1080,
          fps: jobData.fps,
          codec: 'h264',
          hasAudio: false, // Veo 3 typically generates video without audio
          hasSynthId: true, // Veo 3 includes SynthID watermark
          status: 'READY'
        }
      });

    } catch (error) {
      logger.error('Failed to create media record', {
        generationId: jobData.generationId,
        filename,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(
    job: Job<GenerationJobData>,
    progress: number,
    message: string
  ): Promise<void> {
    try {
      await job.updateProgress({
        progress: Math.round(progress),
        message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.warn('Failed to update job progress', {
        jobId: job.id,
        progress,
        error: error.message
      });
    }
  }

  /**
   * Update generation status in database
   */
  private async updateGenerationStatus(
    generationId: string,
    status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
    progress: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        progress: Math.round(progress),
        updatedAt: new Date()
      };

      if (status === 'PROCESSING' && !await this.hasStartTime(generationId)) {
        updateData.startedAt = new Date();
      }

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      await prisma.generation.update({
        where: { id: generationId },
        data: updateData
      });

    } catch (error) {
      logger.error('Failed to update generation status', {
        generationId,
        status,
        error: error.message
      });
    }
  }

  /**
   * Update generation with operation ID
   */
  private async updateGenerationOperationId(
    generationId: string,
    operationId: string
  ): Promise<void> {
    try {
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          veoOperationId: operationId,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to update operation ID', {
        generationId,
        operationId,
        error: error.message
      });
    }
  }

  /**
   * Update generation as completed
   */
  private async updateGenerationCompleted(
    generationId: string,
    mediaId: string,
    estimatedCost: number
  ): Promise<void> {
    try {
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          outputMediaId: mediaId,
          actualCost: estimatedCost,
          completedAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to update generation completion', {
        generationId,
        mediaId,
        error: error.message
      });
    }
  }

  /**
   * Check if generation has start time
   */
  private async hasStartTime(generationId: string): Promise<boolean> {
    try {
      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { startedAt: true }
      });
      return !!generation?.startedAt;
    } catch (error) {
      return false;
    }
  }

  /**
   * Setup event handlers for the worker
   */
  private setupEventHandlers(): void {
    this.worker.on('ready', () => {
      logger.info('Generation worker ready');
    });

    this.worker.on('error', (error) => {
      logger.error('Generation worker error', {
        error: error.message,
        stack: error.stack
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Generation job failed', {
        jobId: job?.id,
        generationId: job?.data?.generationId,
        error: error.message,
        attempts: job?.attemptsMade,
        maxAttempts: job?.opts.attempts
      });
    });

    this.worker.on('completed', (job, result: GenerationJobResult) => {
      logger.info('Generation job completed', {
        jobId: job.id,
        generationId: result.generationId,
        success: result.success,
        processingTime: result.processingTime
      });
    });

    this.worker.on('progress', (job, progress) => {
      logger.debug('Generation job progress', {
        jobId: job.id,
        generationId: job.data.generationId,
        progress
      });
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn('Generation job stalled', { jobId });
    });

    this.worker.on('resumed', (jobId) => {
      logger.info('Generation job resumed', { jobId });
    });
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down generation worker gracefully...`);
      this.isShuttingDown = true;

      try {
        await this.worker.close();
        await prisma.$disconnect();
        logger.info('Generation worker shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during worker shutdown', {
          error: error.message
        });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception in generation worker', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection in generation worker', {
        reason: String(reason),
        promise: String(promise)
      });
    });
  }

  /**
   * Get worker statistics
   */
  async getStats() {
    try {
      const waiting = await this.worker.getWaiting();
      const active = await this.worker.getActive();
      const completed = await this.worker.getCompleted();
      const failed = await this.worker.getFailed();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        isRunning: !this.worker.closing,
        concurrency: config.queue.generation.concurrency
      };
    } catch (error) {
      logger.error('Failed to get worker stats', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Pause the worker
   */
  async pause(): Promise<void> {
    await this.worker.pause();
    logger.info('Generation worker paused');
  }

  /**
   * Resume the worker
   */
  async resume(): Promise<void> {
    await this.worker.resume();
    logger.info('Generation worker resumed');
  }

  /**
   * Close the worker
   */
  async close(): Promise<void> {
    this.isShuttingDown = true;
    await this.worker.close();
    await prisma.$disconnect();
    logger.info('Generation worker closed');
  }
}

// Create and export worker instance
export const generationWorker = new GenerationWorker();

// Export for testing
export { GenerationWorker };
