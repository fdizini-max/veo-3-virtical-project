import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { storageService } from '@/services/storage.service';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { mockDb } from '@/db/mock-adapter';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = Router();
let prisma: any = null;

// Initialize Prisma client with error handling
async function initializePrisma() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    logger.info('Prisma client initialized successfully in upload routes');
  } catch (error) {
    logger.warn('Failed to initialize Prisma client in upload routes, using mock database', {
      error: error.message
    });
  }
}

// Helper function to check database availability
function isDatabaseAvailable(): boolean {
  return prisma !== null;
}

// Configure multer for different upload types
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(config.storage.localPath, 'temp');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(file.originalname);
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 50);
    
    cb(null, `${timestamp}_${randomString}_${safeName}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.limits.maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
    files: 1, // Single file upload
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = {
      image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
    };

    const uploadType = req.query.type as string || 'image';
    const allowed = allowedMimeTypes[uploadType as keyof typeof allowedMimeTypes] || allowedMimeTypes.image;

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types for ${uploadType}: ${allowed.join(', ')}`), false);
    }
  },
});

// Validation schemas
const uploadMetadataSchema = z.object({
  type: z.enum(['image', 'video']).default('image'),
  purpose: z.enum(['reference', 'import', 'avatar', 'thumbnail']).default('reference'),
  description: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
});

/**
 * POST /api/upload - Handle file uploads
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  let tempFilePath: string | null = null;

  try {
    logger.info('File upload request received', {
      requestId: req.requestId,
      hasFile: !!req.file,
      uploadType: req.query.type,
      purpose: req.query.purpose,
      userAgent: req.headers['user-agent']
    });

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a file to upload'
      });
    }

    tempFilePath = req.file.path;

    // Validate metadata
    let parsedTags: string[] | undefined;
    if (typeof req.body.tags === 'string') {
      try {
        parsedTags = JSON.parse(req.body.tags);
      } catch (_e) {
        return res.status(400).json({
          error: 'Invalid upload metadata',
          message: 'tags must be a valid JSON array of strings'
        });
      }
    }

    const metadataResult = uploadMetadataSchema.safeParse({
      type: req.query.type || req.body.type,
      purpose: req.query.purpose || req.body.purpose,
      description: req.body.description,
      tags: parsedTags,
    });

    if (!metadataResult.success) {
      return res.status(400).json({
        error: 'Invalid upload metadata',
        details: metadataResult.error.issues
      });
    }

    const metadata = metadataResult.data;

    // Validate file based on type
    const fileValidation = await validateUploadedFile(req.file, metadata.type);
    if (!fileValidation.isValid) {
      return res.status(400).json({
        error: 'File validation failed',
        details: fileValidation.errors
      });
    }

    // TODO: Get actual user ID from authentication
    const userId = 'demo_user';

    // Upload to permanent storage
    logger.info('Uploading file to permanent storage', {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      type: metadata.type,
      requestId: req.requestId
    });

    const uploadResult = await storageService.uploadFile(
      req.file.path,
      req.file.filename,
      req.file.mimetype
    );

    // Create media record in database
    const mediaRecord = await prisma.media.create({
      data: {
        userId,
        filename: uploadResult.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        storageType: config.storage.type.toUpperCase() as any,
        storagePath: uploadResult.path,
        publicUrl: uploadResult.publicUrl,
        
        // Video/Image specific metadata (will be populated by processing)
        duration: metadata.type === 'video' ? null : undefined,
        width: null,
        height: null,
        fps: metadata.type === 'video' ? null : undefined,
        codec: metadata.type === 'video' ? null : undefined,
        hasAudio: metadata.type === 'video' ? true : undefined,
        
        status: 'READY',
      }
    });

    // Clean up temporary file
    await fs.unlink(req.file.path);
    tempFilePath = null;

    logger.info('File upload completed', {
      mediaId: mediaRecord.id,
      filename: uploadResult.filename,
      publicUrl: uploadResult.publicUrl,
      size: req.file.size,
      type: metadata.type,
      purpose: metadata.purpose,
      requestId: req.requestId
    });

    // Return upload result
    res.status(201).json({
      id: mediaRecord.id,
      filename: mediaRecord.filename,
      originalName: mediaRecord.originalName,
      mimeType: mediaRecord.mimeType,
      fileSize: mediaRecord.fileSize,
      publicUrl: mediaRecord.publicUrl,
      storageType: mediaRecord.storageType,
      status: mediaRecord.status,
      type: metadata.type,
      purpose: metadata.purpose,
      uploadedAt: mediaRecord.createdAt,
      
      // Include file validation results
      validation: fileValidation,
    });

  } catch (error) {
    // Clean up temporary file on error
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup temp file', {
          tempFilePath,
          error: cleanupError.message
        });
      }
    }

    logger.error('File upload failed', {
      filename: req.file?.filename,
      originalName: req.file?.originalname,
      size: req.file?.size,
      error: error.message,
      stack: error.stack,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'File upload failed',
      message: error.message,
      requestId: req.requestId
    });
  }
});

/**
 * GET /api/upload/:id - Get uploaded file information
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const media = await prisma.media.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true }
        }
      }
    });

    if (!media) {
      return res.status(404).json({
        error: 'File not found',
        message: `Media with ID ${id} does not exist`
      });
    }

    // TODO: Check if user has permission to access this file
    // if (media.userId !== req.user?.id) {
    //   return res.status(403).json({ error: 'Access denied' });
    // }

    logger.debug('Media info retrieved', {
      mediaId: id,
      filename: media.filename,
      requestId: req.requestId
    });

    res.json({
      id: media.id,
      filename: media.filename,
      originalName: media.originalName,
      mimeType: media.mimeType,
      fileSize: media.fileSize,
      publicUrl: media.publicUrl,
      thumbnailUrl: media.thumbnailUrl,
      storageType: media.storageType,
      status: media.status,
      
      // Video metadata if available
      ...(media.duration && { duration: media.duration }),
      ...(media.width && { width: media.width }),
      ...(media.height && { height: media.height }),
      ...(media.fps && { fps: media.fps }),
      ...(media.codec && { codec: media.codec }),
      ...(media.hasAudio !== null && { hasAudio: media.hasAudio }),
      
      uploadedAt: media.createdAt,
      updatedAt: media.updatedAt,
    });

  } catch (error) {
    logger.error('Failed to get media info', {
      mediaId: req.params.id,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'Failed to get file information',
      message: error.message
    });
  }
});

/**
 * DELETE /api/upload/:id - Delete uploaded file
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const media = await prisma.media.findUnique({
      where: { id }
    });

    if (!media) {
      return res.status(404).json({
        error: 'File not found'
      });
    }

    // TODO: Check permissions
    // if (media.userId !== req.user?.id) {
    //   return res.status(403).json({ error: 'Access denied' });
    // }

    // Delete from storage
    await storageService.deleteFile(media.storagePath);

    // Delete from database
    await prisma.media.delete({
      where: { id }
    });

    logger.info('Media deleted', {
      mediaId: id,
      filename: media.filename,
      requestId: req.requestId
    });

    res.json({
      message: 'File deleted successfully',
      mediaId: id
    });

  } catch (error) {
    logger.error('Failed to delete media', {
      mediaId: req.params.id,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'Failed to delete file',
      message: error.message
    });
  }
});

/**
 * POST /api/upload/:id/generate-thumbnail - Generate video thumbnail
 */
router.post('/:id/generate-thumbnail', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const media = await prisma.media.findUnique({
      where: { id }
    });

    if (!media) {
      return res.status(404).json({
        error: 'Media not found'
      });
    }

    if (!media.mimeType.startsWith('video/')) {
      return res.status(400).json({
        error: 'Thumbnail generation only available for videos'
      });
    }

    // TODO: Implement thumbnail generation using FFmpeg
    // This would extract a frame from the video and create a thumbnail
    
    logger.info('Thumbnail generation requested', {
      mediaId: id,
      filename: media.filename,
      requestId: req.requestId
    });

    res.json({
      message: 'Thumbnail generation started',
      mediaId: id,
      status: 'processing'
    });

  } catch (error) {
    logger.error('Failed to generate thumbnail', {
      mediaId: req.params.id,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'Failed to generate thumbnail',
      message: error.message
    });
  }
});

/**
 * File validation helper
 */
async function validateUploadedFile(file: Express.Multer.File, type: 'image' | 'video') {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Basic file validation
    if (file.size === 0) {
      errors.push('File is empty');
    }

    if (file.size > config.limits.maxFileSizeMB * 1024 * 1024) {
      errors.push(`File size exceeds ${config.limits.maxFileSizeMB}MB limit`);
    }

    // Type-specific validation
    if (type === 'image') {
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedImageTypes.includes(file.mimetype)) {
        errors.push(`Invalid image type. Allowed: ${allowedImageTypes.join(', ')}`);
      }

      // TODO: Validate image dimensions using sharp or similar
      // const dimensions = await getImageDimensions(file.path);
      // if (dimensions.width < 256 || dimensions.height < 256) {
      //   errors.push('Image must be at least 256x256 pixels');
      // }
    }

    if (type === 'video') {
      const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
      if (!allowedVideoTypes.includes(file.mimetype)) {
        errors.push(`Invalid video type. Allowed: ${allowedVideoTypes.join(', ')}`);
      }

      // TODO: Validate video properties using ffprobe
      // const videoInfo = await getVideoInfo(file.path);
      // if (videoInfo.duration > 60) {
      //   warnings.push('Video is longer than 60 seconds, consider trimming for better results');
      // }
    }

    // Check file extension matches MIME type
    const expectedExtensions = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/x-msvideo': ['.avi'],
      'video/webm': ['.webm'],
    };

    const fileExtension = path.extname(file.originalname).toLowerCase();
    const expectedExts = expectedExtensions[file.mimetype as keyof typeof expectedExtensions];
    
    if (expectedExts && !expectedExts.includes(fileExtension)) {
      warnings.push(`File extension ${fileExtension} doesn't match MIME type ${file.mimetype}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fileInfo: {
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        uploadedAs: file.filename,
      }
    };

  } catch (error) {
    logger.error('File validation error', {
      filename: file.filename,
      error: error.message
    });

    return {
      isValid: false,
      errors: ['File validation failed'],
      warnings: [],
      fileInfo: {
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        uploadedAs: file.filename,
      }
    };
  }
}

/**
 * GET /api/upload/limits - Get upload limits for current user
 */
router.get('/limits', async (req: Request, res: Response) => {
  try {
    // TODO: Get actual user limits based on subscription
    const limits = {
      maxFileSize: config.limits.maxFileSizeMB, // MB
      maxFiles: 100, // Total files per user
      allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
      maxImageDimensions: { width: 4096, height: 4096 },
      minImageDimensions: { width: 256, height: 256 },
      maxVideoDuration: 300, // 5 minutes
      storageQuota: {
        used: 0, // TODO: Calculate actual usage
        limit: 1024, // 1GB in MB
        unit: 'MB'
      }
    };

    logger.debug('Upload limits requested', {
      requestId: req.requestId
    });

    res.json(limits);

  } catch (error) {
    logger.error('Failed to get upload limits', {
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'Failed to get upload limits',
      message: error.message
    });
  }
});

/**
 * GET /api/upload/user/:userId - Get user's uploaded files
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const type = req.query.type as string; // 'image' or 'video'
    const purpose = req.query.purpose as string;

    // Build where clause
    const where: any = { userId };
    if (type) {
      where.mimeType = { startsWith: type + '/' };
    }

    // Get files with pagination
    const [files, total] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          filename: true,
          originalName: true,
          mimeType: true,
          fileSize: true,
          publicUrl: true,
          thumbnailUrl: true,
          duration: true,
          width: true,
          height: true,
          status: true,
          createdAt: true,
        }
      }),
      prisma.media.count({ where })
    ]);

    logger.info('User files retrieved', {
      userId,
      page,
      limit,
      total,
      type,
      requestId: req.requestId
    });

    res.json({
      files,
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
    logger.error('Failed to get user files', {
      userId: req.params.userId,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'Failed to get user files',
      message: error.message
    });
  }
});

/**
 * POST /api/upload/batch - Handle multiple file uploads
 */
router.post('/batch', upload.array('files', 10), async (req: Request, res: Response) => {
  const tempFiles: string[] = [];

  try {
    logger.info('Batch upload request received', {
      fileCount: req.files?.length || 0,
      requestId: req.requestId
    });

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        message: 'Please select files to upload'
      });
    }

    const files = req.files as Express.Multer.File[];
    tempFiles.push(...files.map(f => f.path));

    // Validate all files first
    const validationResults = await Promise.all(
      files.map(file => validateUploadedFile(file, 'image')) // Default to image for batch
    );

    const invalidFiles = validationResults
      .map((result, index) => ({ result, file: files[index] }))
      .filter(({ result }) => !result.isValid);

    if (invalidFiles.length > 0) {
      return res.status(400).json({
        error: 'Some files failed validation',
        invalidFiles: invalidFiles.map(({ result, file }) => ({
          filename: file.originalname,
          errors: result.errors
        }))
      });
    }

    // Upload all files to storage
    const uploadPromises = files.map(async (file) => {
      const uploadResult = await storageService.uploadFile(
        file.path,
        file.filename,
        file.mimetype
      );

      return prisma.media.create({
        data: {
          userId: 'demo_user', // TODO: Get actual user
          filename: uploadResult.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          storageType: config.storage.type.toUpperCase() as any,
          storagePath: uploadResult.path,
          publicUrl: uploadResult.publicUrl,
          status: 'READY',
        }
      });
    });

    const mediaRecords = await Promise.all(uploadPromises);

    // Clean up temporary files
    await Promise.all(tempFiles.map(filePath => 
      fs.unlink(filePath).catch(err => 
        logger.warn('Failed to cleanup temp file', { filePath, error: err.message })
      )
    ));

    logger.info('Batch upload completed', {
      uploadedCount: mediaRecords.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      requestId: req.requestId
    });

    res.status(201).json({
      message: `Successfully uploaded ${mediaRecords.length} files`,
      files: mediaRecords.map(media => ({
        id: media.id,
        filename: media.filename,
        originalName: media.originalName,
        publicUrl: media.publicUrl,
        fileSize: media.fileSize,
        uploadedAt: media.createdAt,
      })),
      summary: {
        totalFiles: mediaRecords.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        successCount: mediaRecords.length,
        failedCount: 0,
      }
    });

  } catch (error) {
    // Clean up temporary files on error
    await Promise.all(tempFiles.map(filePath => 
      fs.unlink(filePath).catch(() => {}) // Ignore cleanup errors
    ));

    logger.error('Batch upload failed', {
      fileCount: req.files?.length || 0,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      error: 'Batch upload failed',
      message: error.message
    });
  }
});

export default router;
