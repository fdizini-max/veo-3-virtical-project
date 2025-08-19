'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generationAPI } from '@/lib/api/generation';
import { useAuth } from './useAuth';

export interface GenerationRequest {
  prompt: string;
  mode: 'VERTICAL_FIRST' | 'HORIZONTAL';
  duration: number;
  fps: number;
  resolution: string;
  backgroundMode: 'SOLID_COLOR' | 'GREENSCREEN' | 'MINIMAL_GRADIENT' | 'CUSTOM';
  useFastModel: boolean;
  referenceImage?: File;
}

export interface Generation {
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

export interface GenerationStats {
  totalGenerations: number;
  completedGenerations: number;
  failedGenerations: number;
  totalCost: number;
  averageProcessingTime: number;
  dailyGenerationsUsed: number;
  dailyGenerationsLimit: number;
}

/**
 * Custom hook for managing video generation
 */
export function useGeneration() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pollingGenerations, setPollingGenerations] = useState<Set<string>>(new Set());

  // Create generation mutation
  const createGeneration = useMutation({
    mutationFn: async (request: GenerationRequest) => {
      const formData = new FormData();
      
      // Add basic fields
      formData.append('prompt', request.prompt);
      formData.append('mode', request.mode);
      formData.append('duration', request.duration.toString());
      formData.append('fps', request.fps.toString());
      formData.append('resolution', request.resolution);
      formData.append('backgroundMode', request.backgroundMode);
      formData.append('useFastModel', request.useFastModel.toString());
      
      // Add reference image if provided
      if (request.referenceImage) {
        formData.append('referenceImage', request.referenceImage);
      }
      
      return generationAPI.createGeneration(formData);
    },
    onSuccess: (generation) => {
      // Invalidate generations list
      queryClient.invalidateQueries({ queryKey: ['generations'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      
      // Start polling for this generation
      startPolling(generation.id);
    },
    onError: (error) => {
      console.error('Generation creation failed:', error);
    }
  });

  // Get user's generations
  const useGenerations = (options: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}) => {
    return useQuery({
      queryKey: ['generations', user?.id, options],
      queryFn: () => generationAPI.getGenerations(options),
      enabled: !!user,
      staleTime: 30000, // 30 seconds
    });
  };

  // Get single generation
  const useGenerationById = (id: string | null) => {
    return useQuery({
      queryKey: ['generation', id],
      queryFn: () => generationAPI.getGeneration(id!),
      enabled: !!id,
      staleTime: 5000, // 5 seconds for active generations
      refetchInterval: (data) => {
        // Poll active generations every 2 seconds
        if (data?.status === 'PROCESSING' || data?.status === 'QUEUED') {
          return 2000;
        }
        return false;
      },
    });
  };

  // Get user statistics
  const useGenerationStats = () => {
    return useQuery({
      queryKey: ['user-stats', user?.id],
      queryFn: () => generationAPI.getUserStats(),
      enabled: !!user,
      staleTime: 60000, // 1 minute
    });
  };

  // Cancel generation mutation
  const cancelGeneration = useMutation({
    mutationFn: generationAPI.cancelGeneration,
    onSuccess: (_, generationId) => {
      // Update the specific generation
      queryClient.invalidateQueries({ queryKey: ['generation', generationId] });
      queryClient.invalidateQueries({ queryKey: ['generations'] });
      
      // Stop polling
      stopPolling(generationId);
    }
  });

  // Retry failed generation
  const retryGeneration = useMutation({
    mutationFn: generationAPI.retryGeneration,
    onSuccess: (generation) => {
      queryClient.invalidateQueries({ queryKey: ['generation', generation.id] });
      queryClient.invalidateQueries({ queryKey: ['generations'] });
      
      // Start polling for the retried generation
      startPolling(generation.id);
    }
  });

  // Delete generation
  const deleteGeneration = useMutation({
    mutationFn: generationAPI.deleteGeneration,
    onSuccess: (_, generationId) => {
      queryClient.invalidateQueries({ queryKey: ['generations'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['generation', generationId] });
      
      // Stop polling
      stopPolling(generationId);
    }
  });

  // Polling management
  const startPolling = useCallback((generationId: string) => {
    setPollingGenerations(prev => new Set([...prev, generationId]));
    
    // Set up polling with exponential backoff
    let pollCount = 0;
    const maxPolls = 180; // 6 minutes max polling
    
    const poll = async () => {
      try {
        const generation = await generationAPI.getGeneration(generationId);
        
        // Update cache
        queryClient.setQueryData(['generation', generationId], generation);
        
        // Stop polling if completed, failed, or cancelled
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(generation.status)) {
          stopPolling(generationId);
          
          // Invalidate related queries
          queryClient.invalidateQueries({ queryKey: ['generations'] });
          queryClient.invalidateQueries({ queryKey: ['user-stats'] });
          
          return;
        }
        
        pollCount++;
        if (pollCount >= maxPolls) {
          console.warn(`Polling timeout for generation ${generationId}`);
          stopPolling(generationId);
          return;
        }
        
        // Continue polling with increasing intervals
        const interval = Math.min(2000 + (pollCount * 100), 10000); // 2-10 seconds
        setTimeout(poll, interval);
        
      } catch (error) {
        console.error(`Polling error for generation ${generationId}:`, error);
        
        // Stop polling on repeated errors
        if (pollCount > 5) {
          stopPolling(generationId);
        } else {
          setTimeout(poll, 5000); // Retry in 5 seconds
        }
      }
    };
    
    // Start polling after a short delay
    setTimeout(poll, 1000);
  }, [queryClient]);

  const stopPolling = useCallback((generationId: string) => {
    setPollingGenerations(prev => {
      const newSet = new Set(prev);
      newSet.delete(generationId);
      return newSet;
    });
  }, []);

  // Estimate generation cost
  const estimateGenerationCost = useCallback((request: Partial<GenerationRequest>): number => {
    let baseCost = 0.10; // Base cost
    
    // Duration multiplier
    if (request.duration) {
      baseCost += request.duration * 0.02;
    }
    
    // Model type multiplier
    if (!request.useFastModel) {
      baseCost *= 1.5;
    }
    
    // Reference image cost
    if (request.referenceImage) {
      baseCost += 0.05;
    }
    
    return Math.round(baseCost * 100) / 100; // Round to 2 decimals
  }, []);

  // Get generation by status
  const getGenerationsByStatus = useCallback((
    generations: Generation[] | undefined,
    status: Generation['status']
  ): Generation[] => {
    return generations?.filter(g => g.status === status) || [];
  }, []);

  // Check if user can generate more videos
  const canGenerateMore = useCallback((stats: GenerationStats | undefined): boolean => {
    if (!stats) return true;
    return stats.dailyGenerationsUsed < stats.dailyGenerationsLimit;
  }, []);

  // Get active generations (processing or queued)
  const getActiveGenerations = useCallback((generations: Generation[] | undefined): Generation[] => {
    return generations?.filter(g => 
      g.status === 'PROCESSING' || g.status === 'QUEUED' || g.status === 'PENDING'
    ) || [];
  }, []);

  return {
    // Mutations
    createGeneration,
    cancelGeneration,
    retryGeneration,
    deleteGeneration,
    
    // Queries (hooks)
    useGenerations,
    useGenerationById,
    useGenerationStats,
    
    // Utilities
    estimateGenerationCost,
    getGenerationsByStatus,
    canGenerateMore,
    getActiveGenerations,
    startPolling,
    stopPolling,
    
    // State
    pollingGenerations,
    
    // Loading states
    isCreating: createGeneration.isPending,
    isCancelling: cancelGeneration.isPending,
    isRetrying: retryGeneration.isPending,
    isDeleting: deleteGeneration.isPending,
  };
}
