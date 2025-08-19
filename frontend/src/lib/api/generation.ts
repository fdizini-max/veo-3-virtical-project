/**
 * Generation API Client
 * Handles all video generation related API calls
 */

import { apiClient } from './client';

export interface GenerationResponse {
  id: string;
  userId: string;
  prompt: string;
  processedPrompt?: string;
  mode: 'VERTICAL_FIRST' | 'HORIZONTAL';
  duration: number;
  fps: number;
  resolution: string;
  backgroundMode: string;
  useFastModel: boolean;
  status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  jobId?: string;
  veoOperationId?: string;
  outputMediaId?: string;
  outputMedia?: {
    id: string;
    filename: string;
    publicUrl: string;
    thumbnailUrl?: string;
    duration?: number;
    width?: number;
    height?: number;
  };
  estimatedCost?: number;
  actualCost?: number;
  processingTime?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface GenerationListResponse {
  generations: GenerationResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserStatsResponse {
  totalGenerations: number;
  completedGenerations: number;
  failedGenerations: number;
  totalCost: number;
  averageProcessingTime: number;
  dailyGenerationsUsed: number;
  dailyGenerationsLimit: number;
  subscriptionTier: string;
  maxDuration: number;
}

export interface UserLimitsResponse {
  dailyGenerationsUsed: number;
  dailyGenerationsLimit: number;
  maxDuration: number;
  maxFileSize: number;
  canUseReferenceImages: boolean;
  canUseFastModel: boolean;
  subscriptionTier: string;
}

/**
 * Generation API methods
 */
export const generationAPI = {
  /**
   * Create a new video generation
   */
  async createGeneration(formData: FormData): Promise<GenerationResponse> {
    const response = await apiClient.post('/generate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Get a specific generation by ID
   */
  async getGeneration(id: string): Promise<GenerationResponse> {
    const response = await apiClient.get(`/generation/${id}`);
    return response.data;
  },

  /**
   * Get user's generations with pagination and filtering
   */
  async getGenerations(options: {
    page?: number;
    limit?: number;
    status?: string;
    mode?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'duration';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<GenerationListResponse> {
    const params = new URLSearchParams();
    
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.status) params.append('status', options.status);
    if (options.mode) params.append('mode', options.mode);
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);

    const response = await apiClient.get(`/generation/list?${params.toString()}`);
    return response.data;
  },

  /**
   * Cancel a generation
   */
  async cancelGeneration(id: string): Promise<GenerationResponse> {
    const response = await apiClient.post(`/generation/${id}/cancel`);
    return response.data;
  },

  /**
   * Retry a failed generation
   */
  async retryGeneration(id: string): Promise<GenerationResponse> {
    const response = await apiClient.post(`/generation/${id}/retry`);
    return response.data;
  },

  /**
   * Delete a generation and its associated files
   */
  async deleteGeneration(id: string): Promise<void> {
    await apiClient.delete(`/generation/${id}`);
  },

  /**
   * Get user's generation statistics
   */
  async getUserStats(): Promise<UserStatsResponse> {
    const response = await apiClient.get('/generation/stats');
    return response.data;
  },

  /**
   * Get user's current limits and usage
   */
  async getUserLimits(): Promise<UserLimitsResponse> {
    const response = await apiClient.get('/generation/limits');
    return response.data;
  },

  /**
   * Estimate generation cost
   */
  async estimateCost(params: {
    duration: number;
    useFastModel: boolean;
    hasReferenceImage: boolean;
  }): Promise<{ estimatedCost: number; breakdown: any }> {
    const response = await apiClient.post('/generation/estimate-cost', params);
    return response.data;
  },

  /**
   * Get generation templates/presets
   */
  async getTemplates(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    prompt: string;
    mode: string;
    settings: any;
    thumbnailUrl?: string;
  }>> {
    const response = await apiClient.get('/generation/templates');
    return response.data;
  },

  /**
   * Get popular/trending prompts
   */
  async getTrendingPrompts(mode?: 'VERTICAL_FIRST' | 'HORIZONTAL'): Promise<Array<{
    prompt: string;
    category: string;
    usageCount: number;
  }>> {
    const params = mode ? `?mode=${mode}` : '';
    const response = await apiClient.get(`/generation/trending-prompts${params}`);
    return response.data;
  },

  /**
   * Report generation issue
   */
  async reportIssue(generationId: string, issue: {
    type: 'quality' | 'content' | 'technical' | 'other';
    description: string;
    severity: 'low' | 'medium' | 'high';
  }): Promise<{ reportId: string }> {
    const response = await apiClient.post(`/generation/${generationId}/report`, issue);
    return response.data;
  },

  /**
   * Download generation result
   */
  async downloadGeneration(id: string, format?: 'original' | 'compressed'): Promise<Blob> {
    const params = format ? `?format=${format}` : '';
    const response = await apiClient.get(`/generation/${id}/download${params}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  /**
   * Get generation analytics for admin/pro users
   */
  async getGenerationAnalytics(timeRange: '7d' | '30d' | '90d' = '30d'): Promise<{
    totalGenerations: number;
    successRate: number;
    averageProcessingTime: number;
    costBreakdown: any;
    popularPrompts: any[];
    hourlyDistribution: any[];
  }> {
    const response = await apiClient.get(`/generation/analytics?timeRange=${timeRange}`);
    return response.data;
  },

  /**
   * Batch create generations (pro feature)
   */
  async createBatchGeneration(requests: Array<{
    prompt: string;
    mode: string;
    duration: number;
    settings?: any;
  }>): Promise<{
    batchId: string;
    generationIds: string[];
    estimatedCost: number;
  }> {
    const response = await apiClient.post('/generation/batch', { requests });
    return response.data;
  },

  /**
   * Get batch generation status
   */
  async getBatchStatus(batchId: string): Promise<{
    batchId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    completedCount: number;
    totalCount: number;
    generations: GenerationResponse[];
  }> {
    const response = await apiClient.get(`/generation/batch/${batchId}`);
    return response.data;
  },

  /**
   * Save generation as template
   */
  async saveAsTemplate(generationId: string, template: {
    name: string;
    description: string;
    isPublic: boolean;
    category?: string;
  }): Promise<{ templateId: string }> {
    const response = await apiClient.post(`/generation/${generationId}/save-template`, template);
    return response.data;
  },

  /**
   * Get generation history with advanced filtering
   */
  async getGenerationHistory(filters: {
    startDate?: string;
    endDate?: string;
    status?: string[];
    mode?: string[];
    minDuration?: number;
    maxDuration?: number;
    minCost?: number;
    maxCost?: number;
    search?: string;
  } = {}): Promise<GenerationListResponse> {
    const response = await apiClient.post('/generation/history', filters);
    return response.data;
  },

  /**
   * Export generation data (CSV/JSON)
   */
  async exportGenerationData(format: 'csv' | 'json', filters?: any): Promise<Blob> {
    const response = await apiClient.post('/generation/export', 
      { format, filters }, 
      { responseType: 'blob' }
    );
    return response.data;
  }
};
