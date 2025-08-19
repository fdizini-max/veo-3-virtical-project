import { GenerationMode, BackgroundMode } from '@prisma/client';

/**
 * Veo 3 API Integration Types
 * Defines all types used for video generation with Google's Veo 3 API
 */

export interface VeoGenerationRequest {
  userId: string;
  prompt: string;
  mode: GenerationMode;
  
  // Video settings
  duration: number; // seconds
  fps: number;
  resolution: string;
  
  // Optional settings
  backgroundMode?: BackgroundMode;
  referenceImageUrl?: string;
  useFastModel?: boolean;
  
  // Metadata
  requestId?: string;
  clientMetadata?: Record<string, any>;
}

export interface VeoGenerationResponse {
  operationId: string;
  status: VeoJobStatus;
  estimatedCompletionTime: number; // seconds
  processedPrompt: string;
  
  metadata: {
    model: string;
    duration: number;
    resolution: string;
    fps: number;
    requestTimestamp?: number;
  };
  
  error?: string;
}

export interface VeoOperationStatus {
  operationId: string;
  status: VeoJobStatus;
  progress: number; // 0-100
  
  // Success data
  videoUrl?: string;
  metadata?: any;
  
  // Error data
  error?: string;
  
  // Timing
  estimatedTimeRemaining?: number; // seconds
  startTime?: Date;
  completionTime?: Date;
}

export type VeoJobStatus = 
  | 'PENDING'
  | 'QUEUED' 
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/**
 * Veo 3 API Response Types
 * Based on Google's Gemini API structure for video generation
 */

export interface VeoApiResponse {
  name: string; // Operation ID
  metadata?: VeoApiMetadata;
  done: boolean;
  result?: VeoApiResult;
  error?: VeoApiError;
}

export interface VeoApiMetadata {
  '@type': string;
  createTime: string;
  updateTime: string;
  state: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  progressPercentage?: number;
}

export interface VeoApiResult {
  '@type': string;
  response: {
    candidates: VeoApiCandidate[];
    usageMetadata?: {
      promptTokenCount: number;
      totalTokenCount: number;
    };
  };
}

export interface VeoApiCandidate {
  content: {
    parts: VeoApiPart[];
    role: string;
  };
  finishReason: string;
  safetyRatings?: VeoApiSafetyRating[];
}

export interface VeoApiPart {
  text?: string;
  fileData?: {
    mimeType: string;
    fileUri: string;
  };
}

export interface VeoApiSafetyRating {
  category: string;
  probability: string;
  blocked?: boolean;
}

export interface VeoApiError {
  code: number;
  message: string;
  details?: any[];
}

/**
 * Internal Processing Types
 */

export interface VeoProcessingOptions {
  priority?: 'low' | 'normal' | 'high';
  retryAttempts?: number;
  webhookUrl?: string;
  tags?: string[];
}

export interface VeoModelInfo {
  name: string;
  displayName: string;
  description: string;
  maxDuration: number;
  aspectRatios: string[];
  features: string[];
  pricing?: {
    costPerSecond: number;
    currency: string;
  };
}

export interface VeoUsageMetrics {
  totalGenerations: number;
  totalDuration: number; // seconds
  totalCost: number;
  averageProcessingTime: number; // seconds
  successRate: number; // 0-1
  errorBreakdown: Record<string, number>;
}

/**
 * Validation and Error Types
 */

export interface VeoValidationError {
  field: string;
  message: string;
  code: string;
}

export interface VeoValidationResult {
  isValid: boolean;
  errors: VeoValidationError[];
  warnings: string[];
}

export class VeoApiError extends Error {
  public readonly code: number;
  public readonly details?: any;
  
  constructor(message: string, code: number = 500, details?: any) {
    super(message);
    this.name = 'VeoApiError';
    this.code = code;
    this.details = details;
  }
}

export class VeoValidationError extends Error {
  public readonly errors: VeoValidationError[];
  
  constructor(message: string, errors: VeoValidationError[] = []) {
    super(message);
    this.name = 'VeoValidationError';
    this.errors = errors;
  }
}

export class VeoTimeoutError extends Error {
  public readonly operationId: string;
  public readonly timeoutSeconds: number;
  
  constructor(operationId: string, timeoutSeconds: number) {
    super(`Operation ${operationId} timed out after ${timeoutSeconds} seconds`);
    this.name = 'VeoTimeoutError';
    this.operationId = operationId;
    this.timeoutSeconds = timeoutSeconds;
  }
}

/**
 * Webhook Types for Status Updates
 */

export interface VeoWebhookPayload {
  operationId: string;
  status: VeoJobStatus;
  progress: number;
  videoUrl?: string;
  error?: string;
  metadata?: any;
  timestamp: number;
}

export interface VeoWebhookConfig {
  url: string;
  secret?: string;
  events: VeoJobStatus[];
  retryAttempts: number;
}

/**
 * Batch Processing Types
 */

export interface VeoBatchRequest {
  requests: VeoGenerationRequest[];
  batchId: string;
  priority?: 'low' | 'normal' | 'high';
  webhookUrl?: string;
}

export interface VeoBatchStatus {
  batchId: string;
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  progress: number; // 0-100
  estimatedTimeRemaining?: number;
  results: VeoGenerationResponse[];
}
