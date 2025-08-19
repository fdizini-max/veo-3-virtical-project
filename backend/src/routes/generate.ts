import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generationQueue } from '@/queue/generation.queue';
import { exportQueue } from '@/queue/export.queue';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { mockDb } from '@/db/mock-adapter';
import multer from 'multer';
import path from 'path';
import { logger as appLogger } from '@/utils/logger';

const router = Router();
let prisma: any = null;
function safeParseObject(maybeJson: unknown): any {
  if (typeof maybeJson !== 'string') return maybeJson;
  try {
    const parsed = JSON.parse(maybeJson);
    if (parsed && typeof parsed === 'object') return parsed;
    return {};
  } catch (e: any) {
    try {
      appLogger.warn('Failed to parse job.metadata JSON, defaulting to object', { error: e?.message });
    } catch {}
    return {};
  }
}

// Initialize Prisma client with error handling
async function initializePrisma() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    logger.info('Prisma client initialized successfully');
  } catch (error) {
    logger.warn('Failed to initialize Prisma client, using mock database', {
      error: error.message
    });
    // Continue without database for testing
  }
}

// Helper function to check database availability
function isDatabaseAvailable(): boolean {
  return prisma !== null;
}

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: config.limits.maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files for reference images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Validation schemas
const generateRequestSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(config.limits.maxPromptLength, `Prompt must be less than ${config.limits.maxPromptLength} characters`),
  mode: z.enum(['VERTICAL_FIRST', 'HORIZONTAL']).default('VERTICAL_FIRST'),
  duration: z.number()
    .min(1, 'Duration must be at least 1 second')
    .max(config.veo3.maxDuration, `Duration cannot exceed ${config.veo3.maxDuration} seconds`)
    .optional()
    .default(5),
  fps: z.number()
    .int()
    .min(24)
    .max(30)
    .optional()
    .default(config.veo3.defaultFps),
  resolution: z.string()
    .optional()
    .default(config.veo3.defaultResolution),
  backgroundMode: z.enum(['SOLID_COLOR', 'GREENSCREEN', 'MINIMAL_GRADIENT', 'CUSTOM'])
    .optional()
    .default('MINIMAL_GRADIENT'),
  useFastModel: z.boolean().optional().default(false),
});

const exportRequestSchema = z.object({
  exportType: z.enum(['METADATA_ROTATE', 'GUARANTEED_UPRIGHT', 'HORIZONTAL', 'SCALE_PAD']),
  resolution: z.string().optional().default('1080x1920'),
  fps: z.number().int().min(24).max(30).optional().default(30),
  preset: z.string().optional(), // TikTok, Reels, Shorts, Custom
  cropX: z.number().optional(),
  cropY: z.number().optional(),
});

/**
 * POST /api/generate - Create new video generation job
 */
router.post('/', upload.single('referenceImage'), async (req: Request, res: Response) => {
  // Initialize Prisma on first request
  if (prisma === null) {
    await initializePrisma();
  }

  try {
    logger.info('New generation request received', {
      requestId: req.requestId,
      hasFile: !!req.file,
      bodyKeys: Object.keys(req.body)
    });

    // Parse and validate request body
    const validationResult = generateRequestSchema.safeParse({
      ...req.body,
      duration: req.body.duration ? parseInt(req.body.duration) : undefined,
      fps: req.body.fps ? parseInt(req.body.fps) : undefined,
      useFastModel: req.body.useFastModel === 'true',
    });

    if (!validationResult.success) {
      logger.warn('Generation request validation failed', {
        requestId: req.requestId,
        errors: validationResult.error.issues
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.issues,
        message: 'Please check your request parameters'
      });
    }

    const requestData = validationResult.data;

    // TODO: Check user limits and permissions
    // For testing, use our demo user
    const userId = 'b6109de6-52e2-4511-b121-e00be0fcf92a';

    // Create job record in database (if available) or mock database
    let job;
    if (isDatabaseAvailable() && prisma) {
      job = await prisma.job.create({
        data: {
          type: 'GENERATE',
          status: 'PENDING',
          prompt: requestData.prompt,
          mode: requestData.mode,
          metadata: JSON.stringify({
            duration: requestData.duration,
            fps: requestData.fps,
            resolution: requestData.resolution,
            backgroundMode: requestData.backgroundMode,
            useFastModel: requestData.useFastModel,
            hasReferenceImage: !!req.file,
            ...(req.file && {
              referenceImage: {
                originalName: req.file.originalname,
                filename: req.file.filename,
                mimetype: req.file.mimetype,
                size: req.file.size,
              }
            }),
            requestId: req.requestId,
          }),
          userId,
        },
      });
    } else {
      // Use mock database for testing
      job = await mockDb.createJob({
        type: 'GENERATE',
        status: 'PENDING',
        prompt: requestData.prompt,
        mode: requestData.mode,
        metadata: {
          duration: requestData.duration,
          fps: requestData.fps,
          resolution: requestData.resolution,
          backgroundMode: requestData.backgroundMode,
          useFastModel: requestData.useFastModel,
          hasReferenceImage: !!req.file,
          ...(req.file && {
            referenceImage: {
              originalName: req.file.originalname,
              filename: req.file.filename,
              mimetype: req.file.mimetype,
              size: req.file.size,
            }
          }),
          requestId: req.requestId,
        },
        userId,
      });
      
      logger.warn('Using mock database for job creation', {
        jobId: job.id,
        requestId: req.requestId
      });
    }

    // Add job to generation queue
    const queueResult = await generationQueue.addGenerationJob({
      generationId: job.id,
      userId,
      prompt: requestData.prompt,
      mode: requestData.mode,
      duration: requestData.duration,
      fps: requestData.fps,
      resolution: requestData.resolution,
      backgroundMode: requestData.backgroundMode,
      useFastModel: requestData.useFastModel,
      referenceImageUrl: req.file ? `/uploads/temp/${req.file.filename}` : undefined,
      requestMetadata: {
        requestId: req.requestId,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      },
    });

    // Update job with queue information
    if (isDatabaseAvailable() && prisma) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'PENDING',
          metadata: JSON.stringify({
            ...(typeof job.metadata === 'string' ? safeParseObject(job.metadata) : job.metadata),
            queueJobId: queueResult.jobId,
            estimatedWaitTime: queueResult.estimatedWaitTime,
            queuePosition: queueResult.queuePosition,
          }),
        },
      });
    } else {
      // Update mock database
      await mockDb.updateJob(job.id, {
        status: 'PENDING',
        metadata: {
          ...job.metadata,
          queueJobId: queueResult.jobId,
          estimatedWaitTime: queueResult.estimatedWaitTime,
          queuePosition: queueResult.queuePosition,
        },
      });
    }

    logger.info('Generation job created and queued', {
      jobId: job.id,
      queueJobId: queueResult.jobId,
      userId,
      mode: requestData.mode,
      duration: requestData.duration,
      requestId: req.requestId
    });

    // Return job details
    res.status(201).json({
      id: job.id,
      status: job.status,
      type: job.type,
      mode: job.mode,
      prompt: job.prompt,
      progress: job.progress,
      estimatedWaitTime: queueResult.estimatedWaitTime,
      queuePosition: queueResult.queuePosition,
      metadata: job.metadata,
      createdAt: job.createdAt,
    });

  } catch (error) {
    logger.error('Failed to create generation job', {
      error: error.message,
      stack: error.stack,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'Failed to create generation job',
      message: error.message,
      requestId: req.requestId
    });
  }
});

/**
 * GET /api/generate/:id - Get job status
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    logger.debug('Job status requested', {
      jobId: id,
      requestId: req.requestId
    });

    // Get job from database
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, username: true }
        },
        generation: {
          include: {
            outputMedia: true
          }
        }
      }
    });

    if (!job) {
      logger.warn('Job not found', {
        jobId: id,
        requestId: req.requestId
      });

      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${id} does not exist`
      });
    }

    // Get additional queue information if job is still processing
    let queueInfo = null;
    if (['PENDING', 'PROCESSING'].includes(job.status)) {
      const queueJobId = (job.metadata as any)?.queueJobId;
      if (queueJobId) {
        queueInfo = await generationQueue.getJobStatus(queueJobId);
      }
    }

    logger.debug('Job status retrieved', {
      jobId: id,
      status: job.status,
      progress: job.progress,
      hasQueueInfo: !!queueInfo,
      requestId: req.requestId
    });

    // Build response
    const response = {
      id: job.id,
      type: job.type,
      status: job.status,
      mode: job.mode,
      prompt: job.prompt,
      progress: job.progress,
      inputFile: job.inputFile,
      outputFile: job.outputFile,
      errorMessage: job.errorMessage,
      metadata: job.metadata,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      
      // Include queue information if available
      ...(queueInfo && {
        queueStatus: queueInfo.state,
        queueProgress: queueInfo.progress,
        estimatedTimeRemaining: queueInfo.estimatedTimeRemaining,
      }),
      
      // Include generation details if available
      ...(job.generation && {
        generation: {
          id: job.generation.id,
          veoOperationId: job.generation.veoOperationId,
          outputMedia: job.generation.outputMedia ? {
            id: job.generation.outputMedia.id,
            filename: job.generation.outputMedia.filename,
            publicUrl: job.generation.outputMedia.publicUrl,
            thumbnailUrl: job.generation.outputMedia.thumbnailUrl,
            duration: job.generation.outputMedia.duration,
            width: job.generation.outputMedia.width,
            height: job.generation.outputMedia.height,
          } : null,
        }
      }),
    };

    res.json(response);

  } catch (error) {
    logger.error('Failed to get job status', {
      jobId: req.params.id,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'Failed to get job status',
      message: error.message,
      requestId: req.requestId
    });
  }
});

/**
 * POST /api/generate/:id/export - Export video
 */
router.post('/:id/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    logger.info('Export request received', {
      jobId: id,
      exportOptions: req.body,
      requestId: req.requestId
    });

    // Validate export request
    const validationResult = exportRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Export validation failed',
        details: validationResult.error.issues
      });
    }

    const exportData = validationResult.data;

    // Get the original generation job
    const originalJob = await prisma.job.findUnique({
      where: { id },
      include: {
        generation: {
          include: {
            outputMedia: true
          }
        }
      }
    });

    if (!originalJob) {
      return res.status(404).json({
        error: 'Original job not found',
        message: `Job with ID ${id} does not exist`
      });
    }

    if (originalJob.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'Job not completed',
        message: 'Cannot export video from incomplete generation job'
      });
    }

    if (!originalJob.outputFile && !originalJob.generation?.outputMedia) {
      return res.status(400).json({
        error: 'No output file available',
        message: 'Original job has no output file to export'
      });
    }

    // Create export job
    const exportJob = await prisma.job.create({
      data: {
        type: 'EXPORT',
        status: 'PENDING',
        mode: originalJob.mode, // Inherit mode from original
        inputFile: originalJob.outputFile || originalJob.generation?.outputMedia?.storagePath,
        metadata: {
          originalJobId: originalJob.id,
          exportType: exportData.exportType,
          resolution: exportData.resolution,
          fps: exportData.fps,
          preset: exportData.preset,
          cropX: exportData.cropX,
          cropY: exportData.cropY,
          requestId: req.requestId,
        },
        userId: originalJob.userId,
      },
    });

    // Enqueue export job
    try {
      const sourceMediaId = originalJob.generation?.outputMedia?.id as string | undefined;
      const queueResp = await exportQueue.addExportJob({
        exportJobId: exportJob.id,
        originalJobId: originalJob.id,
        userId: originalJob.userId!,
        sourceMediaId: sourceMediaId || '',
        exportType: exportData.exportType,
        resolution: exportData.resolution,
        fps: exportData.fps,
        preset: exportData.preset,
        cropX: exportData.cropX,
        cropY: exportData.cropY,
        platform: (exportData as any).platform,
        requestMetadata: { requestId: req.requestId },
      });

      // Save queueJobId reference
      await prisma.job.update({
        where: { id: exportJob.id },
        data: {
          metadata: {
            ...(exportJob.metadata as any),
            queueJobId: queueResp.jobId,
          },
          status: 'PROCESSING',
          startedAt: new Date(),
          progress: 1,
        },
      });
    } catch (e) {
      logger.error('Failed to enqueue export job', {
        exportJobId: exportJob.id,
        error: (e as Error).message,
      });
    }

    logger.info('Export job created', {
      exportJobId: exportJob.id,
      originalJobId: originalJob.id,
      exportType: exportData.exportType,
      requestId: req.requestId
    });

    res.status(201).json({
      id: exportJob.id,
      type: exportJob.type,
      status: exportJob.status,
      originalJobId: originalJob.id,
      exportType: exportData.exportType,
      resolution: exportData.resolution,
      fps: exportData.fps,
      preset: exportData.preset,
      progress: exportJob.progress,
      metadata: exportJob.metadata,
      createdAt: exportJob.createdAt,
    });

  } catch (error) {
    logger.error('Failed to create export job', {
      jobId: req.params.id,
      error: error.message,
      stack: error.stack,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'Failed to create export job',
      message: error.message,
      requestId: req.requestId
    });
  }
});

/**
 * Additional helpful endpoints
 */

/**
 * DELETE /api/generate/:id - Cancel job
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${id} does not exist`
      });
    }

    if (['COMPLETED', 'FAILED'].includes(job.status)) {
      return res.status(400).json({
        error: 'Cannot cancel job',
        message: 'Job is already completed or failed'
      });
    }

    // Cancel queue job if it exists
    const queueJobId = (job.metadata as any)?.queueJobId;
    if (queueJobId) {
      await generationQueue.cancelJob(queueJobId);
    }

    // Update job status
    await prisma.job.update({
      where: { id },
      data: {
        status: 'FAILED', // Using FAILED since we don't have CANCELLED in enum
        errorMessage: 'Job cancelled by user',
        completedAt: new Date(),
        updatedAt: new Date(),
      }
    });

    logger.info('Job cancelled', {
      jobId: id,
      queueJobId,
      requestId: req.requestId
    });

    res.json({
      message: 'Job cancelled successfully',
      jobId: id
    });

  } catch (error) {
    logger.error('Failed to cancel job', {
      jobId: req.params.id,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'Failed to cancel job',
      message: error.message
    });
  }
});

/**
 * GET /api/generate - List user's jobs
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string;
    const type = req.query.type as string;
    const mode = req.query.mode as string;

    // For testing, use our demo user
    const userId = 'b6109de6-52e2-4511-b121-e00be0fcf92a';

    // Build where clause
    const where: any = { userId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (mode) where.mode = mode;

    // Get jobs with pagination
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          generation: {
            include: {
              outputMedia: {
                select: {
                  id: true,
                  filename: true,
                  publicUrl: true,
                  thumbnailUrl: true,
                  duration: true,
                  width: true,
                  height: true,
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where })
    ]);

    logger.info('Jobs list retrieved', {
      userId,
      page,
      limit,
      total,
      filters: { status, type, mode },
      requestId: req.requestId
    });

    res.json({
      jobs: jobs.map(job => ({
        id: job.id,
        type: job.type,
        status: job.status,
        mode: job.mode,
        prompt: job.prompt,
        progress: job.progress,
        inputFile: job.inputFile,
        outputFile: job.outputFile,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        metadata: job.metadata,
        generation: job.generation ? {
          id: job.generation.id,
          outputMedia: job.generation.outputMedia,
        } : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      }
    });

  } catch (error) {
    logger.error('Failed to get jobs list', {
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'Failed to get jobs list',
      message: error.message
    });
  }
});

/**
 * POST /api/generate/:id/retry - Retry failed job
 */
router.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    if (job.status !== 'FAILED') {
      return res.status(400).json({
        error: 'Can only retry failed jobs'
      });
    }

    // Reset job status
    await prisma.job.update({
      where: { id },
      data: {
        status: 'PENDING',
        progress: 0,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        updatedAt: new Date(),
      }
    });

    // Re-add to queue
    if (job.type === 'GENERATE') {
      const metadata = job.metadata as any;
      await generationQueue.addGenerationJob({
        generationId: job.id,
        userId: job.userId || 'b6109de6-52e2-4511-b121-e00be0fcf92a',
        prompt: job.prompt!,
        mode: job.mode,
        duration: metadata.duration,
        fps: metadata.fps,
        resolution: metadata.resolution,
        backgroundMode: metadata.backgroundMode,
        useFastModel: metadata.useFastModel,
        referenceImageUrl: metadata.referenceImage?.filename ? 
          `/uploads/temp/${metadata.referenceImage.filename}` : undefined,
      });
    }

    logger.info('Job retried', {
      jobId: id,
      type: job.type,
      requestId: req.requestId
    });

    res.json({
      message: 'Job queued for retry',
      jobId: id,
      status: 'PENDING'
    });

  } catch (error) {
    logger.error('Failed to retry job', {
      jobId: req.params.id,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'Failed to retry job',
      message: error.message
    });
  }
});

export default router;
