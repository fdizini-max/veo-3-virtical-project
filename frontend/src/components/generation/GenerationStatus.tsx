'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Zap,
  Timer,
  Activity
} from 'lucide-react';

interface GenerationStatusProps {
  status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress?: number; // 0-100
  message?: string;
  estimatedTimeRemaining?: number; // seconds
  showDetails?: boolean;
}

const statusConfig = {
  PENDING: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    title: 'Pending',
    description: 'Your generation request is being prepared'
  },
  QUEUED: {
    icon: Timer,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    title: 'Queued',
    description: 'Waiting in queue for processing'
  },
  PROCESSING: {
    icon: Loader2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
    title: 'Generating',
    description: 'AI is creating your video'
  },
  COMPLETED: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    title: 'Completed',
    description: 'Your video is ready!'
  },
  FAILED: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    title: 'Failed',
    description: 'Generation encountered an error'
  },
  CANCELLED: {
    icon: AlertCircle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    title: 'Cancelled',
    description: 'Generation was cancelled'
  }
};

export function GenerationStatus({ 
  status, 
  progress = 0, 
  message, 
  estimatedTimeRemaining,
  showDetails = true 
}: GenerationStatusProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  // Get progress bar color
  const getProgressColor = () => {
    if (status === 'FAILED') return 'bg-red-500';
    if (status === 'COMPLETED') return 'bg-green-500';
    return 'bg-primary';
  };

  // Get processing stage message
  const getStageMessage = (progress: number): string => {
    if (progress < 10) return 'Initializing generation...';
    if (progress < 30) return 'Processing prompt and settings...';
    if (progress < 60) return 'AI is creating your video...';
    if (progress < 90) return 'Applying final enhancements...';
    if (progress < 100) return 'Preparing download...';
    return 'Complete!';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        p-4 rounded-lg border
        ${config.bgColor} ${config.borderColor}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full bg-white ${config.color}`}>
            <Icon 
              className={`w-5 h-5 ${status === 'PROCESSING' ? 'animate-spin' : ''}`} 
            />
          </div>
          
          <div>
            <h3 className={`font-medium ${config.color}`}>
              {config.title}
            </h3>
            <p className="text-sm text-gray-600">
              {message || config.description}
            </p>
          </div>
        </div>

        {/* Time remaining */}
        {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
          <div className="text-right">
            <div className="text-sm font-medium text-gray-700">
              ~{formatTimeRemaining(estimatedTimeRemaining)}
            </div>
            <div className="text-xs text-gray-500">remaining</div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {(status === 'PROCESSING' || status === 'QUEUED') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {status === 'PROCESSING' ? getStageMessage(progress) : 'Waiting in queue...'}
            </span>
            {status === 'PROCESSING' && (
              <span className="font-medium text-gray-700">
                {Math.round(progress)}%
              </span>
            )}
          </div>
          
          <div className="progress-bar">
            <motion.div
              className={`progress-bar-fill ${getProgressColor()}`}
              initial={{ width: 0 }}
              animate={{ 
                width: status === 'QUEUED' ? '100%' : `${progress}%` 
              }}
              transition={{ 
                duration: status === 'QUEUED' ? 2 : 0.5,
                repeat: status === 'QUEUED' ? Infinity : 0,
                repeatType: status === 'QUEUED' ? 'reverse' : undefined
              }}
            />
          </div>
        </div>
      )}

      {/* Completed progress */}
      {status === 'COMPLETED' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-700 font-medium">
              Generation completed successfully!
            </span>
            <span className="text-green-700 font-medium">100%</span>
          </div>
          
          <div className="progress-bar">
            <motion.div
              className="progress-bar-fill bg-green-500"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Failed state */}
      {status === 'FAILED' && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            {message || 'An error occurred during generation. Please try again or contact support if the problem persists.'}
          </p>
        </div>
      )}

      {/* Additional details */}
      {showDetails && status === 'PROCESSING' && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center mb-1">
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <div className="text-xs text-gray-500">AI Processing</div>
              <div className="text-sm font-medium">Active</div>
            </div>
            
            <div>
              <div className="flex items-center justify-center mb-1">
                <Zap className="w-4 h-4 text-yellow-500" />
              </div>
              <div className="text-xs text-gray-500">Quality</div>
              <div className="text-sm font-medium">High</div>
            </div>
            
            <div>
              <div className="flex items-center justify-center mb-1">
                <Timer className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xs text-gray-500">Progress</div>
              <div className="text-sm font-medium">{Math.round(progress)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Queue position indicator */}
      {status === 'QUEUED' && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-800">
              Your video is in the generation queue
            </span>
            <div className="flex items-center space-x-1 text-blue-600">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="font-medium">Waiting</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
