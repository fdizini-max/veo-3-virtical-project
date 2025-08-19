'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, 
  Copy, 
  CheckCircle, 
  AlertTriangle,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { validatePrompt } from '@/lib/utils/validation';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onExampleSelect?: (prompt: string) => void;
  mode: 'VERTICAL_FIRST' | 'HORIZONTAL';
}

// Example prompts for different modes
const VERTICAL_EXAMPLES = [
  "A young chef preparing fresh pasta in a modern kitchen, close-up shots of hands kneading dough, steam rising from boiling water",
  "A dancer performing contemporary moves in a sunlit studio, flowing fabric, graceful arm movements, emotional expression",
  "A barista creating latte art, coffee beans grinding, milk steaming, precise pouring technique, cozy cafe atmosphere",
  "A artist painting a landscape on canvas, brush strokes, color mixing on palette, concentrated facial expression, natural lighting",
  "A guitarist playing acoustic music by a campfire, fingers on strings, warm firelight, peaceful forest setting at dusk",
  "A baker decorating a wedding cake, piping intricate designs, steady hands, pastel colors, professional kitchen background",
  "A yoga instructor demonstrating poses on a beach, sunrise lighting, flowing movements, calm ocean waves in background",
  "A craftsman working with wood, carving details, wood shavings, focused concentration, traditional workshop setting"
];

const HORIZONTAL_EXAMPLES = [
  "A sweeping drone shot of a mountain range at golden hour, clouds drifting through valleys, vast landscape panorama",
  "A time-lapse of a bustling city street from above, cars flowing like rivers of light, urban architecture, dynamic movement",
  "A serene lake reflecting autumn trees, gentle ripples on water surface, colorful foliage, peaceful natural setting",
  "A wide shot of a concert stage with dramatic lighting, crowd silhouettes, performer in spotlight, energetic atmosphere",
  "A cinematic view of a train traveling through countryside, rolling hills, farmland, nostalgic journey feeling",
  "An establishing shot of a cozy cabin in snowy mountains, smoke from chimney, winter landscape, warm interior glow",
  "A panoramic view of ocean waves crashing against rocky cliffs, seabirds flying, dramatic coastal scenery",
  "A wide angle shot of a field of sunflowers swaying in the breeze, blue sky with white clouds, rural beauty"
];

export function PromptInput({ 
  value, 
  onChange, 
  placeholder, 
  disabled, 
  onExampleSelect,
  mode 
}: PromptInputProps) {
  const [showExamples, setShowExamples] = useState(false);
  const [copiedExample, setCopiedExample] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validatePrompt> | null>(null);

  // Get examples based on mode
  const examples = useMemo(() => {
    return mode === 'VERTICAL_FIRST' ? VERTICAL_EXAMPLES : HORIZONTAL_EXAMPLES;
  }, [mode]);

  // Validate prompt in real-time
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Validate if there's content
    if (newValue.trim()) {
      const result = validatePrompt(newValue);
      setValidationResult(result);
    } else {
      setValidationResult(null);
    }
  }, [onChange]);

  // Handle example selection
  const handleExampleSelect = useCallback((example: string) => {
    onChange(example);
    onExampleSelect?.(example);
    setShowExamples(false);
    
    // Show copied feedback
    setCopiedExample(example);
    setTimeout(() => setCopiedExample(null), 2000);
  }, [onChange, onExampleSelect]);

  // Copy example to clipboard
  const handleCopyExample = useCallback(async (example: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(example);
      setCopiedExample(example);
      setTimeout(() => setCopiedExample(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  // Generate random example
  const handleRandomExample = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * examples.length);
    const randomExample = examples[randomIndex];
    handleExampleSelect(randomExample);
  }, [examples, handleExampleSelect]);

  const characterCount = value.length;
  const maxLength = 500;
  const isNearLimit = characterCount > maxLength * 0.8;
  const isOverLimit = characterCount > maxLength;

  return (
    <div className="space-y-4">
      {/* Main textarea */}
      <div className="relative">
        <textarea
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            prompt-textarea
            ${isOverLimit ? 'border-destructive focus:border-destructive' : ''}
            ${validationResult?.isValid === false ? 'border-yellow-500' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          rows={6}
          maxLength={maxLength}
        />
        
        {/* Character counter */}
        <div className="absolute bottom-3 right-3 flex items-center space-x-2">
          <span className={`
            text-xs px-2 py-1 rounded
            ${isOverLimit ? 'text-destructive bg-destructive/10' : 
              isNearLimit ? 'text-yellow-600 bg-yellow-100' : 
              'text-muted-foreground bg-secondary'}
          `}>
            {characterCount} / {maxLength}
          </span>
        </div>
      </div>

      {/* Validation feedback */}
      <AnimatePresence>
        {validationResult && !validationResult.isValid && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
          >
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">Suggestions for better results:</p>
                <ul className="mt-1 space-y-1 text-yellow-700">
                  {validationResult.suggestions.map((suggestion, index) => (
                    <li key={index}>• {suggestion}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
        
        {validationResult?.isValid && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-green-50 border border-green-200 rounded-lg"
          >
            <div className="flex items-center space-x-2 text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Great prompt! Ready for generation.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowExamples(!showExamples)}
            disabled={disabled}
            className="text-xs"
          >
            <Lightbulb className="w-3 h-3 mr-1" />
            {showExamples ? 'Hide Examples' : 'Show Examples'}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRandomExample}
            disabled={disabled}
            className="text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Random Example
          </Button>
        </div>

        {/* Mode indicator */}
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <Sparkles className="w-3 h-3" />
          <span>
            {mode === 'VERTICAL_FIRST' ? 'Vertical-First Mode' : 'Horizontal Mode'}
          </span>
        </div>
      </div>

      {/* Examples panel */}
      <AnimatePresence>
        {showExamples && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border rounded-lg p-4 bg-secondary/30"
          >
            <h3 className="font-medium mb-3 flex items-center">
              <Lightbulb className="w-4 h-4 mr-2" />
              Example Prompts for {mode === 'VERTICAL_FIRST' ? 'Vertical' : 'Horizontal'} Videos
            </h3>
            
            <div className="grid gap-2">
              {examples.map((example, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    group relative p-3 rounded-lg border cursor-pointer transition-all
                    hover:border-primary hover:bg-primary/5
                    ${copiedExample === example ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}
                  `}
                  onClick={() => handleExampleSelect(example)}
                >
                  <p className="text-sm text-gray-700 group-hover:text-gray-900 pr-8">
                    {example}
                  </p>
                  
                  {/* Copy button */}
                  <button
                    onClick={(e) => handleCopyExample(example, e)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
                    title="Copy to clipboard"
                  >
                    {copiedExample === example ? (
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-gray-400" />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> {mode === 'VERTICAL_FIRST' 
                  ? 'For vertical videos, focus on close-up actions and single subjects. Avoid wide landscapes or multiple characters.'
                  : 'For horizontal videos, you can include wider shots, landscapes, and multiple subjects in the same frame.'
                }
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
