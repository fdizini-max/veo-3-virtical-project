'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

const EXAMPLE_PROMPTS = {
  VERTICAL: [
    "A chef preparing fresh pasta in a modern kitchen, close-up shots of hands kneading dough",
    "A dancer performing contemporary moves in a sunlit studio, flowing fabric, graceful movements",
    "A barista creating latte art, coffee beans grinding, milk steaming, precise pouring technique",
    "A artist painting a landscape on canvas, brush strokes, color mixing, concentrated expression"
  ],
  HORIZONTAL: [
    "A sweeping drone shot of mountain range at golden hour, clouds drifting through valleys",
    "A time-lapse of bustling city street from above, cars flowing like rivers of light",
    "A serene lake reflecting autumn trees, gentle ripples, colorful foliage",
    "A wide shot of concert stage with dramatic lighting, crowd silhouettes, energetic atmosphere"
  ]
};

export function PromptInput({ 
  value, 
  onChange, 
  placeholder = "Describe your video...", 
  disabled = false,
  maxLength = 500 
}: PromptInputProps) {
  const [showExamples, setShowExamples] = useState(false);
  const [copiedExample, setCopiedExample] = useState<string | null>(null);

  const handleExampleClick = useCallback((example: string) => {
    onChange(example);
    setShowExamples(false);
    setCopiedExample(example);
    setTimeout(() => setCopiedExample(null), 2000);
  }, [onChange]);

  const handleCopyExample = useCallback(async (example: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(example);
      setCopiedExample(example);
      setTimeout(() => setCopiedExample(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  const characterCount = value.length;
  const isNearLimit = characterCount > maxLength * 0.8;
  const isOverLimit = characterCount > maxLength;

  return (
    <div className="space-y-4">
      {/* Main textarea */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className={`
            w-full h-32 p-3 border rounded-lg resize-y transition-colors
            focus:ring-2 focus:ring-primary focus:border-transparent
            ${isOverLimit ? 'border-red-500' : 'border-gray-300'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        
        {/* Character counter */}
        <div className="absolute bottom-3 right-3">
          <span className={`
            text-xs px-2 py-1 rounded
            ${isOverLimit ? 'text-red-600 bg-red-100' : 
              isNearLimit ? 'text-yellow-600 bg-yellow-100' : 
              'text-gray-500 bg-gray-100'}
          `}>
            {characterCount}/{maxLength}
          </span>
        </div>
      </div>

      {/* Example prompts */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowExamples(!showExamples)}
          disabled={disabled}
        >
          <Lightbulb className="w-4 h-4 mr-2" />
          {showExamples ? 'Hide Examples' : 'Show Examples'}
        </Button>

        <div className="text-sm text-muted-foreground">
          Be specific about actions, setting, and mood
        </div>
      </div>

      {/* Examples panel */}
      {showExamples && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border rounded-lg p-4 bg-gray-50"
        >
          <h3 className="font-medium mb-3">Example Prompts</h3>
          <div className="space-y-2">
            {[...EXAMPLE_PROMPTS.VERTICAL, ...EXAMPLE_PROMPTS.HORIZONTAL].map((example, index) => (
              <div
                key={index}
                className={`
                  group p-3 rounded-lg border cursor-pointer transition-all
                  hover:border-primary hover:bg-white
                  ${copiedExample === example ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}
                `}
                onClick={() => handleExampleClick(example)}
              >
                <div className="flex items-start justify-between">
                  <p className="text-sm text-gray-700 group-hover:text-gray-900 flex-1 pr-2">
                    {example}
                  </p>
                  <button
                    onClick={(e) => handleCopyExample(example, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
                  >
                    {copiedExample === example ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
