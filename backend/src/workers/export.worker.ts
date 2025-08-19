import { Worker, Job, WorkerOptions } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { ffmpegService } from '@/services/ffmpeg.service';
import { storageService } from '@/services/storage.service';
import { logger, Timer } from '@/utils/logger';
import { config } from '@/config';
import path from 'path';

/**
 * Export Worker - Processes video export jobs in background
 * 
 * This worker handles video export operations:
 * 1. Downloads source video from storage
 * 2. Applies FFmpeg processing (rotation, crop, encoding)
 * 3. Uploads processed video to storage
 * 4. Updates database with results
 */

interface ExportJobData {
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

interface ExportJobResult {
  success: boolean;
  exportJobId: string;
  outputMediaId?: string;
  processingTime: number;
  ffmpegCommand?: string;
  error?: string;
  metadata?: any;
}

const prisma = new PrismaClient();

/**
 * Export Worker Class
 */
class ExportWorker {
  private worker: Worker;
  private isShuttingDown = false;

  constructor() {
    const workerOptions: WorkerOptions = {
      connection: {
        host: config.redis.url.includes('://') ? new URL(config.redis.url).hostname : config.redis.url,
        port: config.redis.url.includes('://') ? new URL(config.redis.url).port ? parseInt(new URL(config.redis.url).port) : 6379 : 6379,
        password: config.redis.password,
      },
      concurrency: config.queue.export.concurrency,
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 50 },
      maxStalledCount: 3,
      stalledInterval: 30000,
    };

    this.worker = new Worker('export-queue', this.processJob.bind(this), workerOptions);

    this.setupEventHandlers();
    this.setupGracefulShutdown();

    logger.info('Export worker initialized', {
      concurrency: config.queue.export.concurrency,
      redis: config.redis.url,
    });
  }

  /**
   * Process a single export job
   */
  private async processJob(job: Job<ExportJobData>): Promise<ExportJobResult> {
    const timer = new Timer('export-job', {
      jobId: job.id,
      exportJobId: job.data.exportJobId,
      exportType: job.data.exportType
    });

    logger.info('Starting export job', {
      jobId: job.id,
      exportJobId: job.data.exportJobId,
      exportType: job.data.exportType,
      resolution: job.data.resolution
    });

    try {
      // Update job progress
      await this.updateJobProgress(job, 5, 'Preparing export...');
      await this.updateExportStatus(job.data.exportJobId, 'PROCESSING', 5);

      // Get source media information
      await this.updateJobProgress(job, 10, 'Retrieving source video...');
      const sourceMedia = await this.getSourceMedia(job.data.sourceMediaId);

      // Download source video to temporary location
      await this.updateJobProgress(job, 20, 'Downloading source video...');
      const tempInputPath = await this.downloadSourceVideo(sourceMedia);

      // Generate output filename
      const outputFilename = this.generateOutputFilename(job.data);
      const tempOutputPath = path.join(config.storage.localPath, 'temp', outputFilename);

      // Process video with FFmpeg
      await this.updateJobProgress(job, 30, 'Processing video...');
      const processingResult = await ffmpegService.processVideo({
        inputPath: tempInputPath,
        outputPath: tempOutputPath,
        exportType: job.data.exportType,
        resolution: job.data.resolution,
        fps: job.data.fps,
        crf: job.data.crf,
        preset: job.data.preset,
        cropX: job.data.cropX,
        cropY: job.data.cropY,
      });

      if (!processingResult.success) {
        throw new Error(`Video processing failed: ${processingResult.error}`);
      }

      // Upload processed video to storage
      await this.updateJobProgress(job, 80, 'Uploading processed video...');
      const uploadResult = await storageService.uploadFile(
        tempOutputPath,
        outputFilename,
        'video/mp4'
      );

      // Generate thumbnail if needed
      await this.updateJobProgress(job, 90, 'Generating thumbnail...');
      const thumbnailPath = await this.generateThumbnail(tempOutputPath, outputFilename);

      // Create media record for exported video
      await this.updateJobProgress(job, 95, 'Finalizing export...');
      const exportedMedia = await this.createExportedMediaRecord(
        job.data,
        uploadResult,
        processingResult,
        thumbnailPath
      );

      // Update export job as completed
      await this.updateJobProgress(job, 100, 'Export completed!');
      await this.updateExportCompleted(job.data.exportJobId, exportedMedia.id, processingResult);

      // Cleanup temporary files
      await this.cleanupTempFiles([tempInputPath, tempOutputPath]);

      const processingTime = timer.end('Export completed successfully');

      logger.info('Export job completed', {
        jobId: job.id,
        exportJobId: job.data.exportJobId,
        outputMediaId: exportedMedia.id,
        processingTime,
        ffmpegCommand: processingResult.command
      });

      return {
        success: true,
        exportJobId: job.data.exportJobId,
        outputMediaId: exportedMedia.id,
        processingTime,
        ffmpegCommand: processingResult.command,
        metadata: {
          originalResolution: processingResult.videoInfo ? 
            `${processingResult.videoInfo.width}x${processingResult.videoInfo.height}` : 'unknown',
          exportType: job.data.exportType,
          platform: job.data.platform,
        }
      };

    } catch (error) {
      const processingTime = timer.end('Export failed');

      logger.error('Export job failed', {
        jobId: job.id,
        exportJobId: job.data.exportJobId,
        error: error.message,
        stack: error.stack,
        processingTime
      });

      // Update export status to failed
      await this.updateExportStatus(
        job.data.exportJobId,
        'FAILED',
        0,
        error.message
      );

      return {
        success: false,
        exportJobId: job.data.exportJobId,
        processingTime,
        error: error.message
      };
    }
  }

  /**
   * Get source media information
   */
  private async getSourceMedia(mediaId: string) {
    const media = await prisma.media.findUnique({
      where: { id: mediaId }
    });

    if (!media) {
      throw new Error(`Source media not found: ${mediaId}`);
    }

    if (media.status !== 'READY') {
      throw new Error(`Source media not ready: ${media.status}`);
    }

    return media;
  }

  /**
   * Download source video to temporary location
   */
  private async downloadSourceVideo(media: any): Promise<string> {
    const tempPath = path.join(config.storage.localPath, 'temp', `source_${Date.now()}_${media.filename}`);
    
    try {
      const videoBuffer = await storageService.downloadFile(media.storagePath);
      await require('fs/promises').writeFile(tempPath, videoBuffer);
      
      logger.ffmpeg('Source video downloaded', {
        mediaId: media.id,
        tempPath,
        size: videoBuffer.length
      });

      return tempPath;
    } catch (error) {
      logger.error('Failed to download source video', {
        mediaId: media.id,
        storagePath: media.storagePath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate output filename
   */
  private generateOutputFilename(jobData: ExportJobData): string {
    const timestamp = Date.now();
    const exportType = jobData.exportType.toLowerCase();
    const resolution = jobData.resolution.replace('x', '_');
    const platform = jobData.platform ? `_${jobData.platform.toLowerCase()}` : '';
    
    return `export_${exportType}_${resolution}${platform}_${timestamp}.mp4`;
  }

  /**
   * Generate thumbnail for exported video
   */
  private async generateThumbnail(videoPath: string, baseFilename: string): Promise<string | null> {
    try {
      const thumbnailFilename = baseFilename.replace('.mp4', '_thumb.jpg');
      const thumbnailPath = path.join(config.storage.localPath, 'temp', thumbnailFilename);

      const result = await ffmpegService.generateThumbnail(videoPath, thumbnailPath, {
        timeOffset: '00:00:01',
        width: 320,
        height: 180,
        quality: 2
      });

      if (result.success) {
        // Upload thumbnail to storage
        const uploadResult = await storageService.uploadFile(
          thumbnailPath,
          thumbnailFilename,
          'image/jpeg'
        );

        // Cleanup temp thumbnail
        await require('fs/promises').unlink(thumbnailPath);

        return uploadResult.publicUrl || null;
      }

      return null;
    } catch (error) {
      logger.warn('Thumbnail generation failed', {
        videoPath,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Create media record for exported video
   */
  private async createExportedMediaRecord(
    jobData: ExportJobData,
    uploadResult: any,
    processingResult: any,
    thumbnailUrl: string | null
  ) {
    try {
      return await prisma.media.create({
        data: {
          userId: jobData.userId,
          filename: uploadResult.filename,
          originalName: `${jobData.exportType}_export.mp4`,
          mimeType: 'video/mp4',
          fileSize: uploadResult.size,
          storageType: config.storage.type.toUpperCase() as any,
          storagePath: uploadResult.path,
          publicUrl: uploadResult.publicUrl,
          thumbnailUrl,
          
          // Video metadata from processing result
          duration: processingResult.videoInfo?.duration,
          width: processingResult.videoInfo?.width,
          height: processingResult.videoInfo?.height,
          fps: processingResult.videoInfo?.fps,
          codec: processingResult.videoInfo?.codec,
          hasAudio: processingResult.videoInfo?.hasAudio,
          
          status: 'READY'
        }
      });
    } catch (error) {
      logger.error('Failed to create exported media record', {
        exportJobId: jobData.exportJobId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(job: Job<ExportJobData>, progress: number, message: string): Promise<void> {
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
   * Update export status in database
   */
  private async updateExportStatus(
    exportJobId: string,
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
    progress: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        progress: Math.round(progress),
        updatedAt: new Date()
      };

      if (status === 'PROCESSING') {
        updateData.startedAt = new Date();
      }

      if (status === 'COMPLETED' || status === 'FAILED') {
        updateData.completedAt = new Date();
      }

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      await prisma.job.update({
        where: { id: exportJobId },
        data: updateData
      });

    } catch (error) {
      logger.error('Failed to update export status', {
        exportJobId,
        status,
        error: error.message
      });
    }
  }

  /**
   * Update export as completed
   */
  private async updateExportCompleted(
    exportJobId: string,
    outputMediaId: string,
    processingResult: any
  ): Promise<void> {
    try {
      await prisma.job.update({
        where: { id: exportJobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          outputFile: processingResult.outputPath,
          metadata: {
            ...(await prisma.job.findUnique({ where: { id: exportJobId }, select: { metadata: true } }))?.metadata,
            ffmpegCommand: processingResult.command,
            processingTime: processingResult.processingTime,
            outputVideoInfo: processingResult.videoInfo,
            completedAt: new Date().toISOString()
          },
          completedAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to update export completion', {
        exportJobId,
        outputMediaId,
        error: error.message
      });
    }
  }

  /**
   * Cleanup temporary files
   */
  private async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await require('fs/promises').unlink(filePath);
        logger.debug('Temp file cleaned up', { filePath });
      } catch (error) {
        logger.warn('Failed to cleanup temp file', {
          filePath,
          error: error.message
        });
      }
    }
  }

  /**
   * Setup event handlers for the worker
   */
  private setupEventHandlers(): void {
    this.worker.on('ready', () => {
      logger.info('Export worker ready');
    });

    this.worker.on('error', (error) => {
      logger.error('Export worker error', {
        error: error.message,
        stack: error.stack
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Export job failed', {
        jobId: job?.id,
        exportJobId: job?.data?.exportJobId,
        error: error.message,
        attempts: job?.attemptsMade
      });
    });

    this.worker.on('completed', (job, result: ExportJobResult) => {
      logger.info('Export job completed', {
        jobId: job.id,
        exportJobId: result.exportJobId,
        success: result.success,
        processingTime: result.processingTime
      });
    });

    this.worker.on('progress', (job, progress) => {
      logger.debug('Export job progress', {
        jobId: job.id,
        exportJobId: job.data.exportJobId,
        progress
      });
    });
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down export worker gracefully...`);
      this.isShuttingDown = true;

      try {
        await this.worker.close();
        await prisma.$disconnect();
        logger.info('Export worker shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during export worker shutdown', {
          error: error.message
        });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));
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
        concurrency: config.queue.export.concurrency
      };
    } catch (error) {
      logger.error('Failed to get export worker stats', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Close the worker
   */
  async close(): Promise<void> {
    this.isShuttingDown = true;
    await this.worker.close();
    await prisma.$disconnect();
    logger.info('Export worker closed');
  }
}

// Create and export worker instance
export const exportWorker = new ExportWorker();

// Export for testing
export { ExportWorker };
