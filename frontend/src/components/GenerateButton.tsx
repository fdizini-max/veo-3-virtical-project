'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface GenerateButtonProps {
  isGenerating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  estimatedCost?: number;
  estimatedTime?: number;
  progress?: number;
  disabled?: boolean;
}

export function GenerateButton({ 
  isGenerating, 
  canGenerate, 
  onGenerate,
  estimatedCost = 0.15,
  estimatedTime = 180, // 3 minutes
  progress = 0,
  disabled = false
}: GenerateButtonProps) {
  
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const getProgressMessage = (progress: number): string => {
    if (progress < 10) return 'Initializing generation...';
    if (progress < 30) return 'Processing your prompt...';
    if (progress < 60) return 'AI is creating your video...';
    if (progress < 90) return 'Applying final touches...';
    return 'Almost ready...';
  };

  return (
    <div className="space-y-4">
      {/* Cost and time estimation */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="space-y-1">
          <div className="text-sm font-medium">Estimated Cost</div>
          <div className="text-2xl font-bold text-primary">${estimatedCost.toFixed(2)}</div>
        </div>
        <div className="space-y-1 text-right">
          <div className="text-sm font-medium">Estimated Time</div>
          <div className="text-lg font-semibold text-gray-700">
            {formatTime(estimatedTime)}
          </div>
        </div>
      </div>

      {/* Generate button */}
      <Button
        type="submit"
        size="lg"
        onClick={onGenerate}
        disabled={!canGenerate || disabled}
        className="w-full h-12 text-lg font-semibold"
      >
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="generating"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center"
            >
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              Generating Video...
            </motion.div>
          ) : canGenerate ? (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center"
            >
              <Wand2 className="w-5 h-5 mr-3" />
              Generate Video
            </motion.div>
          ) : (
            <motion.div
              key="disabled"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center"
            >
              <AlertCircle className="w-5 h-5 mr-3" />
              Enter Prompt to Generate
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

      {/* Progress indicator */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <motion.div
                className="bg-primary h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(progress, 5)}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            {/* Progress details */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{getProgressMessage(progress)}</span>
              </div>
              <div className="text-gray-500">
                {progress > 0 ? `${Math.round(progress)}%` : 'Starting...'}
              </div>
            </div>

            {/* Status indicators */}
            <div className="grid grid-cols-3 gap-4 pt-2 border-t">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  {progress > 10 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="text-xs text-gray-500">Prompt Processing</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  {progress > 30 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : progress > 10 ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="text-xs text-gray-500">AI Generation</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  {progress > 80 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : progress > 30 ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="text-xs text-gray-500">Finalizing</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generation tips */}
      {!isGenerating && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <h4 className="text-sm font-medium text-amber-800 mb-1">💡 Generation Tips</h4>
          <ul className="text-xs text-amber-700 space-y-1">
            <li>• Be specific about actions and settings for better results</li>
            <li>• Single subjects work better than multiple characters</li>
            <li>• Reference images help maintain consistent style and appearance</li>
            <li>• Generation typically takes 2-3 minutes depending on complexity</li>
          </ul>
        </div>
      )}
    </div>
  );
}
