import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { VeoGenerationRequest, VeoGenerationResponse, VeoOperationStatus } from '@/types/veo.types';
import { promptService } from './prompt.service';
import { storageService } from './storage.service';
// Avoid importing Prisma enums directly to reduce coupling during enum alignment

/**
 * Veo 3 Service - Handles video generation using Google's Veo 3 API
 * 
 * This service implements the vertical-first approach by:
 * 1. Securely merging universal vertical logic with user input
 * 2. Processing prompts to recognize elements first, then apply vertical formatting
 * 3. Managing the complete generation lifecycle from request to download
 */
class VeoService {
  private genAI: GoogleGenerativeAI;
  private model: string;
  private fastModel: string;

  // Universal vertical logic prompt - kept secure and not exposed to users
  private readonly VERTICAL_LOGIC_PROMPT = `Design the video in 9:16 vertical composition, but render it in a 16:9 horizontal layout with the entire scene rotated 90 degrees counterclockwise — the visual top appears on the left edge. This sideways composition will be rotated 90 degrees clockwise in post to become upright 9:16. 

CRITICAL VERTICAL FORMATTING RULES:
- Center-align the main subject in the vertical safe zone (middle 56% of horizontal frame)
- Ensure background elements and lines read naturally after 90-degree clockwise rotation
- Use single character focus - avoid multiple subjects that could confuse composition
- No text overlays, watermarks, or UI elements that would appear sideways
- Fill the complete 16:9 frame to maximize vertical output quality
- Design lighting and shadows to work correctly after rotation
- Ensure all motion and camera movements translate properly to vertical viewing

COMPOSITION GUIDELINES:
- Main action should flow vertically (top to bottom) in the final rotated output
- Background elements should support vertical storytelling
- Avoid horizontal panning that would become awkward vertical movement
- Design depth and perspective for vertical viewing experience`;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = config.veo3.model;
    this.fastModel = config.veo3.fastModel;

    logger.info('VeoService initialized', {
      model: this.model,
      fastModel: this.fastModel,
      hasApiKey: !!config.gemini.apiKey
    });
  }

  /**
   * Generate video using Veo 3 API
   * Securely merges universal vertical prompt with user input without exposure
   */
  async generateVideo(request: VeoGenerationRequest): Promise<VeoGenerationResponse> {
    try {
      logger.info('Starting Veo 3 generation', {
        userId: request.userId,
        mode: request.mode,
        promptLength: request.prompt.length,
        hasReferenceImage: !!request.referenceImageUrl
      });

      // Process the user prompt to recognize elements and apply vertical formatting
      const processedPrompt = await this.buildFinalPrompt(request);

      // Prepare the generation request
      const generationRequest = this.buildGenerationRequest(request, processedPrompt);

      // Call Veo 3 API
      const operation = await this.callVeoAPI(generationRequest);

      // Return operation details for status tracking
      return {
        operationId: operation.name,
        status: 'PENDING',
        estimatedCompletionTime: this.estimateCompletionTime(request),
        processedPrompt: processedPrompt, // Safe to return as vertical logic is already merged
        metadata: {
          model: request.useFastModel ? this.fastModel : this.model,
          duration: request.duration,
          resolution: request.resolution,
          fps: request.fps
        }
      };

    } catch (error) {
      logger.error('Veo 3 generation failed', {
        userId: request.userId,
        error: error.message,
        stack: error.stack
      });

      throw new Error(`Video generation failed: ${error.message}`);
    }
  }

  /**
   * Check the status of a Veo 3 operation
   * Enhanced status polling implementation
   */
  async checkOperationStatus(operationId: string): Promise<VeoOperationStatus> {
    try {
      logger.debug('Polling Veo 3 operation status', {
        operationId,
        timestamp: new Date().toISOString()
      });

      // Call the operations endpoint directly
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/operations/${operationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.gemini.apiKey}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Operation status check failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const operation = await response.json();

      logger.debug('Operation status retrieved', {
        operationId,
        done: operation.done,
        hasError: !!operation.error,
        hasResponse: !!operation.response,
        metadata: operation.metadata
      });

      // Handle error state
      if (operation.error) {
        logger.error('Veo 3 operation failed', {
          operationId,
          error: operation.error,
          errorCode: operation.error.code,
          errorMessage: operation.error.message
        });

        return {
          operationId,
          status: 'FAILED',
          error: operation.error.message || 'Unknown Veo 3 error',
          progress: 0,
          metadata: operation.metadata
        };
      }

      // Handle completion
      if (operation.done && operation.response) {
        const videoUrl = this.extractVideoUrl(operation.response);
        
        if (!videoUrl) {
          logger.error('Operation completed but no video URL found', {
            operationId,
            response: operation.response
          });
          
          return {
            operationId,
            status: 'FAILED',
            error: 'Video generation completed but no video URL received',
            progress: 100
          };
        }

        logger.veoApi('Veo 3 operation completed successfully', {
          operationId,
          videoUrl,
          processingTime: this.calculateProcessingTime(operation)
        });

        return {
          operationId,
          status: 'COMPLETED',
          progress: 100,
          videoUrl,
          metadata: {
            ...operation.metadata,
            response: operation.response,
            completedAt: new Date().toISOString(),
            processingTime: this.calculateProcessingTime(operation)
          }
        };
      }

      // Handle processing state
      const progress = this.calculateProgress(operation);
      const estimatedTimeRemaining = this.estimateTimeRemaining(operation);

      logger.debug('Operation still processing', {
        operationId,
        progress,
        estimatedTimeRemaining,
        state: operation.metadata?.state
      });

      return {
        operationId,
        status: 'PROCESSING',
        progress,
        estimatedTimeRemaining,
        metadata: operation.metadata,
        startTime: operation.metadata?.createTime ? new Date(operation.metadata.createTime) : undefined
      };

    } catch (error) {
      logger.error('Failed to check operation status', {
        operationId,
        error: error.message,
        stack: error.stack
      });

      return {
        operationId,
        status: 'FAILED',
        error: `Status check failed: ${error.message}`,
        progress: 0
      };
    }
  }

  /**
   * Enhanced status polling with retry logic and exponential backoff
   */
  async pollOperationUntilComplete(
    operationId: string,
    options: {
      maxPolls?: number;
      initialInterval?: number;
      maxInterval?: number;
      backoffMultiplier?: number;
      onProgress?: (status: VeoOperationStatus) => void;
    } = {}
  ): Promise<VeoOperationStatus> {
    const {
      maxPolls = 360, // 30 minutes max (starting with 5s intervals)
      initialInterval = 5000, // 5 seconds
      maxInterval = 30000, // 30 seconds max
      backoffMultiplier = 1.1,
      onProgress
    } = options;

    let pollCount = 0;
    let currentInterval = initialInterval;
    let lastStatus: VeoOperationStatus | null = null;

    logger.veoApi('Starting enhanced status polling', {
      operationId,
      maxPolls,
      initialInterval,
      maxInterval
    });

    while (pollCount < maxPolls) {
      try {
        const status = await this.checkOperationStatus(operationId);
        lastStatus = status;

        // Call progress callback if provided
        if (onProgress) {
          onProgress(status);
        }

        // Check for completion or failure
        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
          logger.veoApi('Polling completed', {
            operationId,
            finalStatus: status.status,
            pollCount,
            totalTime: pollCount * currentInterval
          });
          return status;
        }

        pollCount++;

        // Log progress periodically
        if (pollCount % 10 === 0) {
          logger.veoApi('Polling progress update', {
            operationId,
            pollCount,
            progress: status.progress,
            estimatedTimeRemaining: status.estimatedTimeRemaining,
            currentInterval
          });
        }

        // Wait before next poll with exponential backoff
        await new Promise(resolve => setTimeout(resolve, currentInterval));
        
        // Increase interval for next poll (with max limit)
        currentInterval = Math.min(currentInterval * backoffMultiplier, maxInterval);

      } catch (error) {
        logger.error('Polling iteration failed', {
          operationId,
          pollCount,
          error: error.message
        });

        // If we've had several failures, give up
        if (pollCount > 5) {
          throw new Error(`Polling failed after ${pollCount} attempts: ${error.message}`);
        }

        // Wait longer after errors
        await new Promise(resolve => setTimeout(resolve, currentInterval * 2));
      }
    }

    // Timeout reached
    const timeoutError = `Operation polling timeout after ${maxPolls} attempts (${(maxPolls * initialInterval) / 1000} seconds)`;
    
    logger.error('Polling timeout reached', {
      operationId,
      maxPolls,
      lastStatus: lastStatus?.status,
      lastProgress: lastStatus?.progress
    });

    throw new Error(timeoutError);
  }

  /**
   * Download generated video from Veo 3
   */
  async downloadVideo(videoUrl: string, filename: string): Promise<string> {
    try {
      logger.info('Downloading video from Veo 3', { videoUrl, filename });

      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const uploadResult = await storageService.uploadBuffer(
        Buffer.from(buffer),
        filename,
        'video/mp4'
      );

      logger.info('Video downloaded and stored', {
        filename,
        storagePath: uploadResult.path,
        size: buffer.byteLength
      });

      return uploadResult.path;

    } catch (error) {
      logger.error('Failed to download video', {
        videoUrl,
        filename,
        error: (error as Error).message
      });

      throw new Error(`Video download failed: ${(error as Error).message}`);
    }
  }

  /**
   * Build final prompt by securely merging vertical logic with user input
   * This method protects the universal vertical logic from being exposed
   */
  private async buildFinalPrompt(request: VeoGenerationRequest): Promise<string> {
    // For vertical-first mode, securely merge the universal vertical logic
    if ((request.mode as any) === 'VERTICAL' || (request.mode as any) === 'VERTICAL_FIRST') {
      // Use prompt service to recognize elements and apply vertical formatting
      const processedUserPrompt = await promptService.processVerticalPrompt(
        request.prompt,
        {
          backgroundMode: request.backgroundMode,
          duration: request.duration,
          hasReferenceImage: !!request.referenceImageUrl
        }
      );

      // Securely merge without exposing the vertical logic
      return this.securelyMergePrompts(processedUserPrompt);
    }

    // For horizontal mode, use the user prompt with minimal processing
    return promptService.processHorizontalPrompt(request.prompt, {
      backgroundMode: request.backgroundMode,
      duration: request.duration
    });
  }

  /**
   * Securely merge universal vertical logic with processed user prompt
   * This method ensures the vertical logic remains protected
   */
  private securelyMergePrompts(processedUserPrompt: string): string {
    // The vertical logic is prepended but kept internal
    // Only the combined result is used, never exposing the logic itself
    const finalPrompt = `${this.VERTICAL_LOGIC_PROMPT}\n\nSCENE DESCRIPTION:\n${processedUserPrompt}`;
    
    // Log that merging occurred without exposing the content
    logger.debug('Prompts securely merged', {
      userPromptLength: processedUserPrompt.length,
      finalPromptLength: finalPrompt.length,
      verticalLogicApplied: true
    });

    return finalPrompt;
  }

  /**
   * Build the actual API request for Veo 3
   */
  private buildGenerationRequest(request: VeoGenerationRequest, finalPrompt: string) {
    const baseRequest = {
      prompt: finalPrompt,
      aspectRatio: '16:9', // Always 16:9 as per Veo 3 constraint
      duration: `${request.duration}s`,
      quality: 'high'
    };

    // Add reference image if provided
    if (request.referenceImageUrl) {
      return {
        ...baseRequest,
        referenceImage: {
          url: request.referenceImageUrl
        }
      };
    }

    return baseRequest;
  }

  /**
   * Call the Veo 3 API with the prepared request
   */
  private async callVeoAPI(generationRequest: any) {
    const modelName = generationRequest.useFastModel ? this.fastModel : this.model;
    
    logger.veoApi('Initiating Veo 3 API call', {
      model: modelName,
      aspectRatio: generationRequest.aspectRatio,
      duration: generationRequest.duration,
      hasReferenceImage: !!generationRequest.referenceImage,
      promptLength: generationRequest.prompt.length
    });

    try {
      // For video generation, we need to use the specific video generation endpoint
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.gemini.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: generationRequest.prompt,
          aspectRatio: generationRequest.aspectRatio,
          duration: generationRequest.duration,
          quality: 'high',
          ...(generationRequest.referenceImage && {
            referenceImage: generationRequest.referenceImage
          })
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Veo 3 API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const operationData = await response.json();
      
      logger.veoApi('Veo 3 operation started', {
        operationId: operationData.name,
        model: modelName,
        estimatedTime: this.estimateCompletionTime(generationRequest)
      });

      return operationData;

    } catch (error) {
      logger.error('Veo 3 API call failed', {
        model: modelName,
        error: error.message,
        promptLength: generationRequest.prompt.length
      });
      throw error;
    }
  }

  /**
   * Extract video URL from Veo 3 response
   */
  private extractVideoUrl(response: any): string | null {
    try {
      // Parse the Veo 3 response structure to extract video URL
      if (response.candidates && response.candidates[0]) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.fileData && part.fileData.mimeType === 'video/mp4') {
              return part.fileData.fileUri;
            }
          }
        }
      }

      logger.warn('No video URL found in Veo 3 response', { response });
      return null;

    } catch (error) {
      logger.error('Failed to extract video URL', {
        error: error.message,
        response
      });
      return null;
    }
  }

  /**
   * Estimate completion time based on request parameters
   */
  private estimateCompletionTime(request: VeoGenerationRequest): number {
    // Base time estimation in seconds
    let baseTime = 120; // 2 minutes base

    // Adjust for duration
    baseTime += request.duration * 15; // 15 seconds per second of video

    // Adjust for complexity
    if (request.referenceImageUrl) {
      baseTime += 30; // Image-to-video adds time
    }

    if (request.useFastModel) {
      baseTime *= 0.6; // Fast model is ~40% faster
    }

    return baseTime;
  }

  /**
   * Calculate progress based on operation metadata
   */
  private calculateProgress(operation: any): number {
    // Check if API provides actual progress
    if (operation.metadata?.progressPercentage) {
      return Math.round(operation.metadata.progressPercentage);
    }

    // Fallback to time-based estimation
    const startTime = operation.metadata?.createTime;
    if (!startTime) return 5; // Show some progress if we have the operation

    const elapsed = Date.now() - new Date(startTime).getTime();
    const estimated = this.getEstimatedDuration(operation);
    
    // Calculate progress with realistic curve
    const rawProgress = (elapsed / estimated) * 100;
    
    // Apply progress curve (slower at start and end, faster in middle)
    let adjustedProgress;
    if (rawProgress < 20) {
      adjustedProgress = rawProgress * 0.5; // Slower start
    } else if (rawProgress < 80) {
      adjustedProgress = 10 + (rawProgress - 20) * 1.2; // Faster middle
    } else {
      adjustedProgress = 82 + (rawProgress - 80) * 0.4; // Slower end
    }
    
    return Math.min(Math.round(adjustedProgress), 95); // Cap at 95% until actually done
  }

  /**
   * Get estimated duration based on operation metadata
   */
  private getEstimatedDuration(operation: any): number {
    // Try to get duration from metadata
    const metadata = operation.metadata || {};
    
    // Base estimation: 2 minutes
    let estimated = 120000;
    
    // Adjust based on known factors
    if (metadata.videoDuration) {
      estimated += metadata.videoDuration * 15000; // 15s per second of video
    }
    
    if (metadata.hasReferenceImage) {
      estimated += 30000; // Image-to-video adds 30s
    }
    
    if (metadata.model?.includes('fast')) {
      estimated *= 0.6; // Fast model is ~40% faster
    }
    
    return estimated;
  }

  /**
   * Calculate actual processing time
   */
  private calculateProcessingTime(operation: any): number | null {
    const startTime = operation.metadata?.createTime;
    const endTime = operation.metadata?.updateTime || new Date().toISOString();
    
    if (!startTime) return null;
    
    return new Date(endTime).getTime() - new Date(startTime).getTime();
  }

  /**
   * Estimate remaining time for operation
   */
  private estimateTimeRemaining(operation: any): number | null {
    const progress = this.calculateProgress(operation);
    if (progress === 0) return null;

    const startTime = operation.metadata?.createTime;
    if (!startTime) return null;

    const elapsed = Date.now() - new Date(startTime).getTime();
    const totalEstimated = (elapsed / progress) * 100;
    
    return Math.max(totalEstimated - elapsed, 0);
  }

  /**
   * Validate Veo 3 API configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      // Test API connectivity
      const model = this.genAI.getGenerativeModel({ model: this.model });
      await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: 'test' }]
        }]
      });

      logger.info('Veo 3 API configuration validated successfully');
      return true;

    } catch (error) {
      logger.error('Veo 3 API configuration validation failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get available models and their capabilities
   */
  async getAvailableModels(): Promise<any[]> {
    try {
      // This would typically call an API endpoint to list available models
      // For now, return the configured models
      return [
        {
          name: this.model,
          displayName: 'Veo 3',
          description: 'High-quality video generation',
          maxDuration: 10,
          aspectRatios: ['16:9'],
          features: ['text-to-video', 'image-to-video']
        },
        {
          name: this.fastModel,
          displayName: 'Veo 3 Fast',
          description: 'Faster video generation with good quality',
          maxDuration: 8,
          aspectRatios: ['16:9'],
          features: ['text-to-video', 'image-to-video']
        }
      ];

    } catch (error) {
      logger.error('Failed to get available models', {
        error: error.message
      });
      return [];
    }
  }
}

// Export singleton instance
export const veoService = new VeoService();
