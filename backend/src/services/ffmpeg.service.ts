import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { config } from '@/config';
import { logger, Timer } from '@/utils/logger';
import { storageService } from './storage.service';

/**
 * FFmpeg Service - Video processing functions for Vertical Veo 3 tool
 * 
 * Implements all export variants from the MVP plan:
 * 1. Metadata-only rotate (fast, no re-encode)
 * 2. Guaranteed upright 9:16 (transpose + crop + encode)
 * 3. Scale + pad alternative (no crop)
 * 4. Horizontal pass-through
 */

export interface VideoProcessingOptions {
  inputPath: string;
  outputPath: string;
  exportType: 'METADATA_ROTATE' | 'GUARANTEED_UPRIGHT' | 'SCALE_PAD' | 'HORIZONTAL';
  resolution?: string;
  fps?: number;
  crf?: number;
  preset?: string;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate?: string;
  hasAudio: boolean;
  format: string;
}

export interface ProcessingResult {
  success: boolean;
  outputPath: string;
  processingTime: number;
  command: string;
  videoInfo?: VideoInfo;
  error?: string;
  warnings?: string[];
}

class FFmpegService {
  private ffmpegPath: string;
  private defaultCrf: number;
  private defaultPreset: string;
  private maxThreads: number;
  private timeout: number;

  constructor() {
    this.ffmpegPath = config.ffmpeg.path;
    this.defaultCrf = config.export.crf;
    this.defaultPreset = config.export.preset;
    this.maxThreads = config.ffmpeg.threads;
    this.timeout = config.ffmpeg.timeout;

    // Set FFmpeg path
    ffmpeg.setFfmpegPath(this.ffmpegPath);

    logger.info('FFmpeg service initialized', {
      ffmpegPath: this.ffmpegPath,
      defaultCrf: this.defaultCrf,
      defaultPreset: this.defaultPreset,
      maxThreads: this.maxThreads
    });
  }

  /**
   * Process video based on export type
   */
  async processVideo(options: VideoProcessingOptions): Promise<ProcessingResult> {
    const timer = new Timer('video-processing', {
      exportType: options.exportType,
      inputPath: options.inputPath,
      outputPath: options.outputPath
    });

    try {
      logger.ffmpeg('Starting video processing', {
        exportType: options.exportType,
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        resolution: options.resolution
      });

      // Ensure output directory exists
      await this.ensureOutputDirectory(options.outputPath);

      // Get input video information
      const inputInfo = await this.getVideoInfo(options.inputPath);
      
      logger.ffmpeg('Input video analyzed', {
        duration: inputInfo.duration,
        resolution: `${inputInfo.width}x${inputInfo.height}`,
        fps: inputInfo.fps,
        codec: inputInfo.codec
      });

      let result: ProcessingResult;

      // Process based on export type
      switch (options.exportType) {
        case 'METADATA_ROTATE':
          result = await this.metadataOnlyRotate(options, inputInfo);
          break;
        
        case 'GUARANTEED_UPRIGHT':
          result = await this.guaranteedUprightExport(options, inputInfo);
          break;
        
        case 'SCALE_PAD':
          result = await this.scalePadExport(options, inputInfo);
          break;
        
        case 'HORIZONTAL':
          result = await this.horizontalPassthrough(options, inputInfo);
          break;
        
        default:
          throw new Error(`Unsupported export type: ${options.exportType}`);
      }

      const processingTime = timer.end('Video processing completed');
      result.processingTime = processingTime;

      logger.ffmpeg('Video processing completed', {
        exportType: options.exportType,
        success: result.success,
        processingTime,
        outputSize: result.videoInfo ? `${result.videoInfo.width}x${result.videoInfo.height}` : 'unknown'
      });

      return result;

    } catch (error) {
      const processingTime = timer.end('Video processing failed');

      logger.error('Video processing failed', {
        exportType: options.exportType,
        inputPath: options.inputPath,
        error: error.message,
        processingTime
      });

      return {
        success: false,
        outputPath: options.outputPath,
        processingTime,
        command: '',
        error: error.message
      };
    }
  }

  /**
   * Export Variant 1: Metadata-only rotate (fastest, may not work everywhere)
   * Command: ffmpeg -i input.mp4 -metadata:s:v rotate="90" -codec copy output_flagged.mp4
   */
  private async metadataOnlyRotate(
    options: VideoProcessingOptions,
    inputInfo: VideoInfo
  ): Promise<ProcessingResult> {
    return new Promise((resolve) => {
      const command = ffmpeg(options.inputPath)
        .outputOptions([
          '-metadata:s:v', 'rotate=90',
          '-codec', 'copy'
        ])
        .output(options.outputPath)
        .on('start', (commandLine) => {
          logger.ffmpeg('Metadata rotate started', {
            command: commandLine,
            inputPath: options.inputPath
          });
        })
        .on('progress', (progress) => {
          logger.debug('Metadata rotate progress', {
            percent: progress.percent,
            timemark: progress.timemark
          });
        })
        .on('end', async () => {
          try {
            const outputInfo = await this.getVideoInfo(options.outputPath);
            resolve({
              success: true,
              outputPath: options.outputPath,
              processingTime: 0, // Will be set by caller
              command: 'ffmpeg -i input.mp4 -metadata:s:v rotate="90" -codec copy output.mp4',
              videoInfo: outputInfo,
              warnings: ['Metadata-only rotation may not be honored by all players']
            });
          } catch (error) {
            resolve({
              success: false,
              outputPath: options.outputPath,
              processingTime: 0,
              command: 'ffmpeg -i input.mp4 -metadata:s:v rotate="90" -codec copy output.mp4',
              error: `Failed to get output info: ${error.message}`
            });
          }
        })
        .on('error', (error) => {
          logger.error('Metadata rotate failed', {
            error: error.message,
            inputPath: options.inputPath
          });
          
          resolve({
            success: false,
            outputPath: options.outputPath,
            processingTime: 0,
            command: 'ffmpeg -i input.mp4 -metadata:s:v rotate="90" -codec copy output.mp4',
            error: error.message
          });
        });

      // Set timeout
      setTimeout(() => {
        command.kill('SIGKILL');
        resolve({
          success: false,
          outputPath: options.outputPath,
          processingTime: 0,
          command: 'ffmpeg -i input.mp4 -metadata:s:v rotate="90" -codec copy output.mp4',
          error: 'Processing timeout'
        });
      }, this.timeout);

      command.run();
    });
  }

  /**
   * Export Variant 2: Guaranteed upright 9:16 (transpose + crop + encode)
   * Command: ffmpeg -i input.mp4 -vf "transpose=1,crop=1080:1920:(in_w-1080)/2:(in_h-1920)/2" 
   *          -c:v libx264 -crf 18 -preset medium -c:a copy output_1080x1920.mp4
   */
  private async guaranteedUprightExport(
    options: VideoProcessingOptions,
    inputInfo: VideoInfo
  ): Promise<ProcessingResult> {
    return new Promise((resolve) => {
      // Parse target resolution
      const [targetWidth, targetHeight] = (options.resolution || '1080x1920').split('x').map(Number);
      
      // Calculate crop coordinates
      const cropX = options.cropX || Math.floor((inputInfo.height - targetWidth) / 2); // Note: swapped due to rotation
      const cropY = options.cropY || Math.floor((inputInfo.width - targetHeight) / 2);
      
      // Build video filter
      const videoFilter = [
        'transpose=1', // Rotate 90 degrees clockwise
        `crop=${targetWidth}:${targetHeight}:${cropX}:${cropY}`
      ].join(',');

      const command = ffmpeg(options.inputPath)
        .videoFilters(videoFilter)
        .videoCodec('libx264')
        .outputOptions([
          '-crf', (options.crf || this.defaultCrf).toString(),
          '-preset', options.preset || this.defaultPreset,
          '-threads', this.maxThreads.toString(),
          '-c:a', 'copy' // Copy audio without re-encoding
        ])
        .fps(options.fps || 30)
        .output(options.outputPath)
        .on('start', (commandLine) => {
          logger.ffmpeg('Guaranteed upright export started', {
            command: commandLine,
            videoFilter,
            targetResolution: `${targetWidth}x${targetHeight}`,
            cropCoords: `${cropX},${cropY}`
          });
        })
        .on('progress', (progress) => {
          if (progress.percent && progress.percent % 10 === 0) {
            logger.debug('Guaranteed upright progress', {
              percent: progress.percent,
              timemark: progress.timemark,
              fps: progress.currentFps
            });
          }
        })
        .on('end', async () => {
          try {
            const outputInfo = await this.getVideoInfo(options.outputPath);
            const actualCommand = `ffmpeg -i input.mp4 -vf "${videoFilter}" -c:v libx264 -crf ${options.crf || this.defaultCrf} -preset ${options.preset || this.defaultPreset} -c:a copy output.mp4`;
            
            resolve({
              success: true,
              outputPath: options.outputPath,
              processingTime: 0,
              command: actualCommand,
              videoInfo: outputInfo
            });
          } catch (error) {
            resolve({
              success: false,
              outputPath: options.outputPath,
              processingTime: 0,
              command: `ffmpeg -i input.mp4 -vf "${videoFilter}" -c:v libx264 -crf ${options.crf || this.defaultCrf} -preset ${options.preset || this.defaultPreset} -c:a copy output.mp4`,
              error: `Failed to get output info: ${error.message}`
            });
          }
        })
        .on('error', (error) => {
          logger.error('Guaranteed upright export failed', {
            error: error.message,
            videoFilter,
            inputPath: options.inputPath
          });
          
          resolve({
            success: false,
            outputPath: options.outputPath,
            processingTime: 0,
            command: `ffmpeg -i input.mp4 -vf "${videoFilter}" -c:v libx264 -crf ${options.crf || this.defaultCrf} -preset ${options.preset || this.defaultPreset} -c:a copy output.mp4`,
            error: error.message
          });
        });

      // Set timeout
      setTimeout(() => {
        command.kill('SIGKILL');
        resolve({
          success: false,
          outputPath: options.outputPath,
          processingTime: 0,
          command: 'timeout',
          error: 'Processing timeout'
        });
      }, this.timeout);

      command.run();
    });
  }

  /**
   * Export Variant 3: Scale + pad alternative (no crop)
   * Command: ffmpeg -i input.mp4 -vf "scale=w=1080:h=1920:force_original_aspect_ratio=decrease,
   *          pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1:1" 
   *          -c:v libx264 -crf 18 -preset medium -c:a copy output_pad_1080x1920.mp4
   */
  private async scalePadExport(
    options: VideoProcessingOptions,
    inputInfo: VideoInfo
  ): Promise<ProcessingResult> {
    return new Promise((resolve) => {
      const [targetWidth, targetHeight] = (options.resolution || '1080x1920').split('x').map(Number);
      
      // Build video filter for scale + pad
      const videoFilter = [
        'transpose=1', // Rotate 90 degrees clockwise first
        `scale=w=${targetWidth}:h=${targetHeight}:force_original_aspect_ratio=decrease`,
        `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=black`,
        'setsar=1:1' // Set square aspect ratio
      ].join(',');

      const command = ffmpeg(options.inputPath)
        .videoFilters(videoFilter)
        .videoCodec('libx264')
        .outputOptions([
          '-crf', (options.crf || this.defaultCrf).toString(),
          '-preset', options.preset || this.defaultPreset,
          '-threads', this.maxThreads.toString(),
          '-c:a', 'copy'
        ])
        .fps(options.fps || 30)
        .output(options.outputPath)
        .on('start', (commandLine) => {
          logger.ffmpeg('Scale + pad export started', {
            command: commandLine,
            videoFilter,
            targetResolution: `${targetWidth}x${targetHeight}`
          });
        })
        .on('progress', (progress) => {
          if (progress.percent && progress.percent % 10 === 0) {
            logger.debug('Scale + pad progress', {
              percent: progress.percent,
              timemark: progress.timemark
            });
          }
        })
        .on('end', async () => {
          try {
            const outputInfo = await this.getVideoInfo(options.outputPath);
            const actualCommand = `ffmpeg -i input.mp4 -vf "${videoFilter}" -c:v libx264 -crf ${options.crf || this.defaultCrf} -preset ${options.preset || this.defaultPreset} -c:a copy output.mp4`;
            
            resolve({
              success: true,
              outputPath: options.outputPath,
              processingTime: 0,
              command: actualCommand,
              videoInfo: outputInfo
            });
          } catch (error) {
            resolve({
              success: false,
              outputPath: options.outputPath,
              processingTime: 0,
              command: `ffmpeg scale+pad export`,
              error: `Failed to get output info: ${error.message}`
            });
          }
        })
        .on('error', (error) => {
          logger.error('Scale + pad export failed', {
            error: error.message,
            videoFilter
          });
          
          resolve({
            success: false,
            outputPath: options.outputPath,
            processingTime: 0,
            command: `ffmpeg scale+pad export`,
            error: error.message
          });
        });

      setTimeout(() => {
        command.kill('SIGKILL');
        resolve({
          success: false,
          outputPath: options.outputPath,
          processingTime: 0,
          command: 'timeout',
          error: 'Processing timeout'
        });
      }, this.timeout);

      command.run();
    });
  }

  /**
   * Export Variant 4: Horizontal pass-through (no rotation)
   */
  private async horizontalPassthrough(
    options: VideoProcessingOptions,
    inputInfo: VideoInfo
  ): Promise<ProcessingResult> {
    return new Promise((resolve) => {
      const command = ffmpeg(options.inputPath)
        .videoCodec('libx264')
        .outputOptions([
          '-crf', (options.crf || this.defaultCrf).toString(),
          '-preset', options.preset || this.defaultPreset,
          '-threads', this.maxThreads.toString(),
          '-c:a', 'copy'
        ])
        .fps(options.fps || inputInfo.fps)
        .output(options.outputPath)
        .on('start', (commandLine) => {
          logger.ffmpeg('Horizontal passthrough started', {
            command: commandLine
          });
        })
        .on('progress', (progress) => {
          if (progress.percent && progress.percent % 10 === 0) {
            logger.debug('Horizontal passthrough progress', {
              percent: progress.percent,
              timemark: progress.timemark
            });
          }
        })
        .on('end', async () => {
          try {
            const outputInfo = await this.getVideoInfo(options.outputPath);
            const actualCommand = `ffmpeg -i input.mp4 -c:v libx264 -crf ${options.crf || this.defaultCrf} -preset ${options.preset || this.defaultPreset} -c:a copy output.mp4`;
            
            resolve({
              success: true,
              outputPath: options.outputPath,
              processingTime: 0,
              command: actualCommand,
              videoInfo: outputInfo
            });
          } catch (error) {
            resolve({
              success: false,
              outputPath: options.outputPath,
              processingTime: 0,
              command: 'ffmpeg horizontal passthrough',
              error: `Failed to get output info: ${error.message}`
            });
          }
        })
        .on('error', (error) => {
          logger.error('Horizontal passthrough failed', {
            error: error.message
          });
          
          resolve({
            success: false,
            outputPath: options.outputPath,
            processingTime: 0,
            command: 'ffmpeg horizontal passthrough',
            error: error.message
          });
        });

      setTimeout(() => {
        command.kill('SIGKILL');
        resolve({
          success: false,
          outputPath: options.outputPath,
          processingTime: 0,
          command: 'timeout',
          error: 'Processing timeout'
        });
      }, this.timeout);

      command.run();
    });
  }

  /**
   * Get video information using ffprobe
   */
  async getVideoInfo(videoPath: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (error, metadata) => {
        if (error) {
          logger.error('Failed to get video info', {
            videoPath,
            error: error.message
          });
          reject(new Error(`Failed to analyze video: ${error.message}`));
          return;
        }

        try {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

          if (!videoStream) {
            throw new Error('No video stream found');
          }

          const info: VideoInfo = {
            duration: metadata.format.duration || 0,
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            fps: this.parseFps(videoStream.r_frame_rate || videoStream.avg_frame_rate || '30/1'),
            codec: videoStream.codec_name || 'unknown',
            bitrate: metadata.format.bit_rate ? `${Math.round(parseInt(metadata.format.bit_rate) / 1000)}k` : undefined,
            hasAudio: !!audioStream,
            format: metadata.format.format_name || 'unknown'
          };

          logger.debug('Video info extracted', info);
          resolve(info);

        } catch (parseError) {
          logger.error('Failed to parse video metadata', {
            videoPath,
            error: parseError.message,
            metadata
          });
          reject(new Error(`Failed to parse video metadata: ${parseError.message}`));
        }
      });
    });
  }

  /**
   * Generate video thumbnail
   */
  async generateThumbnail(
    videoPath: string,
    outputPath: string,
    options: {
      timeOffset?: string; // e.g., '00:00:01'
      width?: number;
      height?: number;
      quality?: number; // 1-31, lower is better
    } = {}
  ): Promise<ProcessingResult> {
    const timer = new Timer('thumbnail-generation', { videoPath, outputPath });

    return new Promise((resolve) => {
      const {
        timeOffset = '00:00:01',
        width = 320,
        height = 180,
        quality = 2
      } = options;

      const command = ffmpeg(videoPath)
        .screenshots({
          timestamps: [timeOffset],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: `${width}x${height}`
        })
        .outputOptions([
          '-q:v', quality.toString()
        ])
        .on('start', (commandLine) => {
          logger.ffmpeg('Thumbnail generation started', {
            command: commandLine,
            timeOffset,
            size: `${width}x${height}`
          });
        })
        .on('end', () => {
          const processingTime = timer.end('Thumbnail generated');
          
          resolve({
            success: true,
            outputPath,
            processingTime,
            command: `ffmpeg -i input.mp4 -ss ${timeOffset} -vframes 1 -s ${width}x${height} -q:v ${quality} output.jpg`
          });
        })
        .on('error', (error) => {
          const processingTime = timer.end('Thumbnail generation failed');
          
          logger.error('Thumbnail generation failed', {
            error: error.message,
            videoPath,
            outputPath
          });
          
          resolve({
            success: false,
            outputPath,
            processingTime,
            command: `ffmpeg thumbnail generation`,
            error: error.message
          });
        });

      setTimeout(() => {
        command.kill('SIGKILL');
        const processingTime = timer.end('Thumbnail generation timeout');
        resolve({
          success: false,
          outputPath,
          processingTime,
          command: 'timeout',
          error: 'Thumbnail generation timeout'
        });
      }, 30000); // 30 second timeout for thumbnails

      command.run();
    });
  }

  /**
   * Advanced crop and rotation logic
   */
  async cropAndRotateVideo(
    inputPath: string,
    outputPath: string,
    options: {
      rotation: 0 | 90 | 180 | 270;
      cropX: number;
      cropY: number;
      cropWidth: number;
      cropHeight: number;
      targetFps?: number;
      quality?: number;
    }
  ): Promise<ProcessingResult> {
    const timer = new Timer('crop-and-rotate', { inputPath, outputPath });

    return new Promise((resolve) => {
      const filters = [];

      // Add rotation filter
      if (options.rotation === 90) {
        filters.push('transpose=1'); // 90 degrees clockwise
      } else if (options.rotation === 180) {
        filters.push('transpose=1,transpose=1'); // 180 degrees
      } else if (options.rotation === 270) {
        filters.push('transpose=2'); // 90 degrees counter-clockwise
      }

      // Add crop filter
      filters.push(`crop=${options.cropWidth}:${options.cropHeight}:${options.cropX}:${options.cropY}`);

      const videoFilter = filters.join(',');

      const command = ffmpeg(inputPath)
        .videoFilters(videoFilter)
        .videoCodec('libx264')
        .outputOptions([
          '-crf', (options.quality || this.defaultCrf).toString(),
          '-preset', this.defaultPreset,
          '-threads', this.maxThreads.toString(),
          '-c:a', 'copy'
        ])
        .fps(options.targetFps || 30)
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.ffmpeg('Crop and rotate started', {
            command: commandLine,
            rotation: options.rotation,
            crop: `${options.cropWidth}x${options.cropHeight}+${options.cropX}+${options.cropY}`
          });
        })
        .on('end', async () => {
          const processingTime = timer.end('Crop and rotate completed');
          
          try {
            const outputInfo = await this.getVideoInfo(outputPath);
            resolve({
              success: true,
              outputPath,
              processingTime,
              command: `ffmpeg -i input.mp4 -vf "${videoFilter}" -c:v libx264 output.mp4`,
              videoInfo: outputInfo
            });
          } catch (error) {
            resolve({
              success: false,
              outputPath,
              processingTime,
              command: `ffmpeg crop and rotate`,
              error: `Failed to get output info: ${error.message}`
            });
          }
        })
        .on('error', (error) => {
          const processingTime = timer.end('Crop and rotate failed');
          
          resolve({
            success: false,
            outputPath,
            processingTime,
            command: `ffmpeg crop and rotate`,
            error: error.message
          });
        });

      setTimeout(() => {
        command.kill('SIGKILL');
        resolve({
          success: false,
          outputPath,
          processingTime: timer.end('Crop and rotate timeout'),
          command: 'timeout',
          error: 'Processing timeout'
        });
      }, this.timeout);

      command.run();
    });
  }

  /**
   * Platform-specific export presets
   */
  async exportForPlatform(
    inputPath: string,
    outputPath: string,
    platform: 'TIKTOK' | 'REELS' | 'SHORTS' | 'YOUTUBE' | 'CUSTOM',
    customOptions?: Partial<VideoProcessingOptions>
  ): Promise<ProcessingResult> {
    const presets = {
      TIKTOK: {
        exportType: 'GUARANTEED_UPRIGHT' as const,
        resolution: '1080x1920',
        fps: 30,
        crf: 18,
        preset: 'medium'
      },
      REELS: {
        exportType: 'GUARANTEED_UPRIGHT' as const,
        resolution: '1080x1920',
        fps: 30,
        crf: 18,
        preset: 'medium'
      },
      SHORTS: {
        exportType: 'GUARANTEED_UPRIGHT' as const,
        resolution: '1080x1920',
        fps: 30,
        crf: 18,
        preset: 'medium'
      },
      YOUTUBE: {
        exportType: 'HORIZONTAL' as const,
        resolution: '1920x1080',
        fps: 30,
        crf: 18,
        preset: 'medium'
      },
      CUSTOM: customOptions || {}
    };

    const platformOptions = presets[platform];
    
    logger.info('Platform-specific export started', {
      platform,
      inputPath,
      outputPath,
      options: platformOptions
    });

    return this.processVideo({
      inputPath,
      outputPath,
      ...platformOptions,
      ...customOptions
    });
  }

  /**
   * Validate FFmpeg installation
   */
  async validateInstallation(): Promise<{ isValid: boolean; version?: string; error?: string }> {
    try {
      return new Promise((resolve) => {
        ffmpeg()
          .getAvailableFormats((error, formats) => {
            if (error) {
              resolve({
                isValid: false,
                error: error.message
              });
              return;
            }

            // Try to get version
            ffmpeg.getAvailableCodecs((codecError, codecs) => {
              if (codecError) {
                resolve({
                  isValid: true,
                  error: 'FFmpeg available but codec info unavailable'
                });
                return;
              }

              resolve({
                isValid: true,
                version: 'Available with codecs'
              });
            });
          });
      });
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Helper methods
   */

  private async ensureOutputDirectory(outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create output directory', {
        directory: dir,
        error: error.message
      });
      throw error;
    }
  }

  private parseFps(fpsString: string): number {
    try {
      if (fpsString.includes('/')) {
        const [num, den] = fpsString.split('/').map(Number);
        return Math.round(num / den);
      }
      return Math.round(parseFloat(fpsString));
    } catch {
      return 30; // Default FPS
    }
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      ffmpegPath: this.ffmpegPath,
      defaultCrf: this.defaultCrf,
      defaultPreset: this.defaultPreset,
      maxThreads: this.maxThreads,
      timeout: this.timeout,
      supportedFormats: ['mp4', 'mov', 'avi', 'webm'],
      supportedCodecs: ['libx264', 'libx265', 'vp9'],
    };
  }
}

// Export singleton instance
export const ffmpegService = new FFmpegService();

// Export class for testing
export { FFmpegService };
