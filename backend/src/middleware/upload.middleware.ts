import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { config } from '@/config';
import { logger } from '@/utils/logger';

/**
 * Upload Middleware - Handles file upload configuration and validation
 */

// Ensure upload directory exists
async function ensureUploadDir() {
  const uploadDir = path.join(config.storage.localPath, 'temp');
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (error) {
    logger.error('Failed to create upload directory', {
      uploadDir,
      error: error.message
    });
  }
}

// Initialize upload directory
ensureUploadDir();

// Storage configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(config.storage.localPath, 'temp');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 50);
    
    const filename = `${timestamp}_${randomString}_${safeName}${extension}`;
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const uploadType = req.query.type as string || req.body.type || 'image';
  
  const allowedTypes = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg']
  };

  const allowed = allowedTypes[uploadType as keyof typeof allowedTypes] || allowedTypes.image;

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Invalid file type. Allowed types for ${uploadType}: ${allowed.join(', ')}`);
    error.name = 'INVALID_FILE_TYPE';
    cb(error);
  }
};

// Base multer configuration
const baseUploadConfig = {
  storage,
  fileFilter,
  limits: {
    fileSize: config.limits.maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
    files: 10, // Maximum 10 files in batch
    fields: 20, // Maximum form fields
  },
};

// Export configured multer instances
export const uploadSingle = multer({
  ...baseUploadConfig,
  limits: {
    ...baseUploadConfig.limits,
    files: 1,
  }
}).single('file');

export const uploadMultiple = multer({
  ...baseUploadConfig,
}).array('files', 10);

export const uploadFields = multer({
  ...baseUploadConfig,
}).fields([
  { name: 'referenceImage', maxCount: 1 },
  { name: 'videoFile', maxCount: 1 },
  { name: 'audioFile', maxCount: 1 },
]);

/**
 * Upload error handler middleware
 */
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    logger.warn('Multer upload error', {
      error: error.message,
      code: error.code,
      field: error.field,
      requestId: req.requestId
    });

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'File too large',
          message: `File size exceeds ${config.limits.maxFileSizeMB}MB limit`,
          maxSize: config.limits.maxFileSizeMB
        });
      
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Too many files',
          message: 'Maximum 10 files allowed in batch upload'
        });
      
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Unexpected file field',
          message: `Unexpected file field: ${error.field}`
        });
      
      default:
        return res.status(400).json({
          error: 'Upload error',
          message: error.message
        });
    }
  }

  if (error.name === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: error.message
    });
  }

  // Pass other errors to global error handler
  next(error);
};

/**
 * File cleanup middleware - removes temp files after request
 */
export const cleanupTempFiles = async (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Clean up temp files after response is sent
    setImmediate(async () => {
      const filesToClean: string[] = [];
      
      if (req.file) {
        filesToClean.push(req.file.path);
      }
      
      if (req.files) {
        if (Array.isArray(req.files)) {
          filesToClean.push(...req.files.map(f => f.path));
        } else {
          Object.values(req.files).forEach(files => {
            if (Array.isArray(files)) {
              filesToClean.push(...files.map(f => f.path));
            }
          });
        }
      }
      
      // Clean up files
      for (const filePath of filesToClean) {
        try {
          await fs.unlink(filePath);
          logger.debug('Temp file cleaned up', { filePath });
        } catch (error) {
          logger.warn('Failed to cleanup temp file', {
            filePath,
            error: error.message
          });
        }
      }
    });
    
    return originalSend.call(this, data);
  };
  
  next();
};

export default {
  uploadSingle,
  uploadMultiple,
  uploadFields,
  handleUploadError,
  cleanupTempFiles,
};
