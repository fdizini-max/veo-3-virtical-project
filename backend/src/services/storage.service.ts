import { Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@/config';
import { logger } from '@/utils/logger';

/**
 * Storage Service - Handles file storage across different providers
 * Supports local storage and Google Cloud Storage
 */

export interface UploadResult {
  filename: string;
  path: string;
  publicUrl?: string;
  size: number;
  mimeType: string;
}

export interface StorageProvider {
  uploadBuffer(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult>;
  uploadFile(filePath: string, filename: string, mimeType: string): Promise<UploadResult>;
  downloadFile(path: string): Promise<Buffer>;
  deleteFile(path: string): Promise<void>;
  getPublicUrl(path: string): string;
  generateSignedUrl(path: string, expiresIn?: number): Promise<string>;
}

/**
 * Local Storage Provider
 */
class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists() {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create storage directory', {
        basePath: this.basePath,
        error: error.message
      });
    }
  }

  async uploadBuffer(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    const safeName = this.sanitizeFilename(filename);
    const fullPath = path.join(this.basePath, safeName);

    try {
      await fs.writeFile(fullPath, buffer);

      (logger as any).storage?.('File uploaded to local storage', {
        filename: safeName,
        path: fullPath,
        size: buffer.length
      });

      return {
        filename: safeName,
        path: safeName, // Relative path for database storage
        size: buffer.length,
        mimeType,
        publicUrl: this.getPublicUrl(safeName)
      };

    } catch (error) {
      logger.error('Failed to upload file to local storage', {
        filename: safeName,
        error: error.message
      });
      throw new Error(`Local storage upload failed: ${(error as Error).message}`);
    }
  }

  async uploadFile(filePath: string, filename: string, mimeType: string): Promise<UploadResult> {
    const buffer = await fs.readFile(filePath);
    return this.uploadBuffer(buffer, filename, mimeType);
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      logger.error('Failed to download file from local storage', {
        path: filePath,
        error: error.message
      });
      throw new Error(`Local storage download failed: ${error.message}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      await fs.unlink(fullPath);
      (logger as any).storage?.('File deleted from local storage', { path: filePath });
    } catch (error) {
      logger.error('Failed to delete file from local storage', {
        path: filePath,
        error: error.message
      });
      throw new Error(`Local storage deletion failed: ${(error as Error).message}`);
    }
  }

  getPublicUrl(filePath: string): string {
    if (config.storage.cdnUrl) {
      return `${config.storage.cdnUrl}/${filePath}`;
    }
    return `${config.frontendUrl}/uploads/${filePath}`;
  }

  async generateSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    // For local storage, return the public URL (no signing needed)
    return this.getPublicUrl(filePath);
  }

  private sanitizeFilename(filename: string): string {
    // Remove or replace unsafe characters
    const sanitized = filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    // Add timestamp to avoid conflicts
    const timestamp = Date.now();
    const extension = path.extname(sanitized);
    const basename = path.basename(sanitized, extension);
    
    return `${timestamp}_${basename}${extension}`;
  }
}



/**
 * Google Cloud Storage Provider
 */
class GCSStorageProvider implements StorageProvider {
  private storage: Storage;
  private bucket: string;

  constructor(bucketName: string) {
    this.bucket = bucketName;
    
    // Initialize GCS client
    const storageOptions: any = {
      projectId: config.gcp.projectId,
    };

    // Use service account key if provided
    if (config.gcp.credentialsPath) {
      storageOptions.keyFilename = config.gcp.credentialsPath;
    }

    this.storage = new Storage(storageOptions);

    (logger as any).storage?.('GCS Storage Provider initialized', {
      bucket: this.bucket,
      projectId: config.gcp.projectId
    });
  }

  async uploadBuffer(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    const safeName = this.generateUniqueFilename(filename);
    const file = this.storage.bucket(this.bucket).file(safeName);

    try {
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          cacheControl: config.storage.cacheControl,
        },
        public: true, // Make file publicly accessible
      });

      const publicUrl = this.getPublicUrl(safeName);

      (logger as any).storage?.('File uploaded to GCS', {
        filename: safeName,
        bucket: this.bucket,
        size: buffer.length,
        publicUrl
      });

      return {
        filename: safeName,
        path: safeName,
        publicUrl,
        size: buffer.length,
        mimeType,
      };

    } catch (error) {
      logger.error('Failed to upload file to GCS', {
        filename: safeName,
        bucket: this.bucket,
        error: error.message
      });
      throw new Error(`GCS upload failed: ${(error as Error).message}`);
    }
  }

  async uploadFile(filePath: string, filename: string, mimeType: string): Promise<UploadResult> {
    const buffer = await fs.readFile(filePath);
    return this.uploadBuffer(buffer, filename, mimeType);
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const file = this.storage.bucket(this.bucket).file(filePath);

    try {
      const [buffer] = await file.download();
      return buffer;
    } catch (error) {
      logger.error('Failed to download file from GCS', {
        path: filePath,
        bucket: this.bucket,
        error: error.message
      });
      throw new Error(`GCS download failed: ${(error as Error).message}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const file = this.storage.bucket(this.bucket).file(filePath);

    try {
      await file.delete();
      (logger as any).storage?.('File deleted from GCS', { path: filePath, bucket: this.bucket });
    } catch (error) {
      logger.error('Failed to delete file from GCS', {
        path: filePath,
        bucket: this.bucket,
        error: error.message
      });
      throw new Error(`GCS deletion failed: ${(error as Error).message}`);
    }
  }

  getPublicUrl(filePath: string): string {
    if (config.storage.cdnUrl) {
      return `${config.storage.cdnUrl}/${filePath}`;
    }
    return `https://storage.googleapis.com/${this.bucket}/${filePath}`;
  }

  async generateSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const file = this.storage.bucket(this.bucket).file(filePath);

    try {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
      });

      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate signed URL', {
        path: filePath,
        error: error.message
      });
      throw new Error(`Failed to generate signed URL: ${(error as Error).message}`);
    }
  }

  private generateUniqueFilename(filename: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4().substring(0, 8);
    const extension = path.extname(filename);
    const basename = path.basename(filename, extension)
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 50); // Limit length

    return `${timestamp}_${uuid}_${basename}${extension}`;
  }
}

/**
 * Storage Service Main Class
 */
class StorageService {
  private provider!: StorageProvider;

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider() {
    switch (config.storage.type) {
      case 'gcs':
        this.provider = new GCSStorageProvider(config.gcp.storageBucket);
        break;
      case 'local':
      default:
        this.provider = new LocalStorageProvider(config.storage.localPath);
        break;
    }

    logger.info('Storage service initialized', {
      type: config.storage.type,
      ...(config.storage.type === 'gcs' && { bucket: config.gcp.storageBucket }),
      ...(config.storage.type === 'local' && { path: config.storage.localPath }),
    });
  }

  /**
   * Upload a buffer as a file
   */
  async uploadBuffer(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    const startTime = Date.now();

    try {
      const result = await this.provider.uploadBuffer(buffer, filename, mimeType);
      
      (logger as any).performance?.('Storage upload completed', Date.now() - startTime, {
        filename: result.filename,
        size: result.size,
        provider: config.storage.type
      });

      return result;
    } catch (error) {
      logger.error('Storage upload failed', {
        filename,
        size: buffer.length,
        provider: config.storage.type,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Upload a file from disk
   */
  async uploadFile(filePath: string, filename?: string, mimeType?: string): Promise<UploadResult> {
    const actualFilename = filename || path.basename(filePath);
    const actualMimeType = mimeType || this.getMimeTypeFromExtension(actualFilename);

    return this.provider.uploadFile(filePath, actualFilename, actualMimeType);
  }

  /**
   * Download a file as buffer
   */
  async downloadFile(filePath: string): Promise<Buffer> {
    const startTime = Date.now();

    try {
      const buffer = await this.provider.downloadFile(filePath);
      
      (logger as any).performance?.('Storage download completed', Date.now() - startTime, {
        path: filePath,
        size: buffer.length,
        provider: config.storage.type
      });

      return buffer;
    } catch (error) {
      logger.error('Storage download failed', {
        path: filePath,
        provider: config.storage.type,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await this.provider.deleteFile(filePath);
      
      (logger as any).storage?.('File deleted successfully', {
        path: filePath,
        provider: config.storage.type
      });
    } catch (error) {
      logger.error('Storage deletion failed', {
        path: filePath,
        provider: config.storage.type,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(filePath: string): string {
    return this.provider.getPublicUrl(filePath);
  }

  /**
   * Generate a signed URL for temporary access
   */
  async generateSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const signedUrl = await this.provider.generateSignedUrl(filePath, expiresIn);
      
      (logger as any).storage?.('Signed URL generated', {
        path: filePath,
        expiresIn,
        provider: config.storage.type
      });

      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate signed URL', {
        path: filePath,
        expiresIn,
        provider: config.storage.type,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.downloadFile(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata (size, type, etc.)
   */
  async getFileMetadata(filePath: string): Promise<{ size: number; mimeType?: string }> {
    if (config.storage.type === 'gcs') {
      const file = (this.provider as GCSStorageProvider)['storage']
        .bucket(config.gcp.storageBucket)
        .file(filePath);

      try {
        const [metadata] = await file.getMetadata();
        return {
          size: parseInt(metadata.size || '0'),
          mimeType: metadata.contentType,
        };
      } catch (error) {
        throw new Error(`Failed to get file metadata: ${error.message}`);
      }
    } else {
      // For local storage, read file stats
      const buffer = await this.downloadFile(filePath);
      return {
        size: buffer.length,
        mimeType: this.getMimeTypeFromExtension(filePath),
      };
    }
  }

  /**
   * Clean up temporary files older than specified age
   */
  async cleanupTempFiles(maxAgeHours: number = 24): Promise<number> {
    // This would be implemented based on your file naming conventions
    // and metadata storage. For now, return 0.
    logger.info('Cleanup temp files requested', { maxAgeHours });
    return 0;
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}

// Export singleton instance
export const storageService = new StorageService();

// Export types and classes for testing
export { StorageService, LocalStorageProvider, GCSStorageProvider };
