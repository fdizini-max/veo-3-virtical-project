'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wand2, 
  Upload, 
  Settings,
  Loader2,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  Monitor,
  Smartphone
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PromptInput } from './PromptInput';
import { ImageUpload } from './ImageUpload';
import { ModeSelector } from './ModeSelector';
import { BackgroundSelector } from './BackgroundSelector';
import { GenerateButton } from './GenerateButton';
import { readJsonOrThrow } from '@/lib/http';

/**
 * Core Generation Form - Simplified version matching exact specifications
 * 
 * Components included:
 * 1. Text area for prompt input
 * 2. Image upload component  
 * 3. Mode selector (Vertical/Horizontal)
 * 4. Background options
 * 5. Generate button with loading states
 */

interface FormData {
  prompt: string;
  mode: 'VERTICAL' | 'HORIZONTAL';
  backgroundMode: 'SOLID_COLOR' | 'GREENSCREEN' | 'MINIMAL_GRADIENT' | 'CUSTOM';
  referenceImage: File | null;
  duration: number;
}

const BACKGROUND_OPTIONS = [
  { value: 'MINIMAL_GRADIENT', label: 'Minimal Gradient', description: 'Subtle gradient background' },
  { value: 'SOLID_COLOR', label: 'Solid Color', description: 'Clean solid color background' },
  { value: 'GREENSCREEN', label: 'Green Screen', description: 'For easy background replacement' },
  { value: 'CUSTOM', label: 'Custom', description: 'Custom background from prompt' }
];

export function GenerationForm() {
  const router = useRouter();
  
  // Form state
  const [formData, setFormData] = useState<FormData>({
    prompt: '',
    mode: 'VERTICAL',
    backgroundMode: 'MINIMAL_GRADIENT',
    referenceImage: null,
    duration: 5
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Update form data
  const updateForm = useCallback((updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setErrors([]); // Clear errors on change
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((file: File | null) => {
    updateForm({ referenceImage: file });
  }, [updateForm]);

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        handleFileUpload(file);
      } else {
        setErrors(['Please upload an image file (JPG, PNG, WebP, GIF)']);
      }
    }
  }, [handleFileUpload]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: string[] = [];

    if (!formData.prompt.trim()) {
      newErrors.push('Prompt is required');
    } else if (formData.prompt.length < 10) {
      newErrors.push('Prompt must be at least 10 characters');
    } else if (formData.prompt.length > 500) {
      newErrors.push('Prompt must be less than 500 characters');
    }

    if (formData.referenceImage && formData.referenceImage.size > 10 * 1024 * 1024) {
      newErrors.push('Reference image must be smaller than 10MB');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsGenerating(true);

    try {
      // Prepare form data for API
      const apiFormData = new FormData();
      apiFormData.append('prompt', formData.prompt);
      // Backend expects 'VERTICAL_FIRST' or 'HORIZONTAL'
      apiFormData.append('mode', formData.mode === 'VERTICAL' ? 'VERTICAL_FIRST' : 'HORIZONTAL');
      apiFormData.append('backgroundMode', formData.backgroundMode);
      apiFormData.append('duration', formData.duration.toString());
      
      if (formData.referenceImage) {
        apiFormData.append('referenceImage', formData.referenceImage);
      }

      // Call API (backend server)
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiBase}/generate`, {
        method: 'POST',
        body: apiFormData,
      });

      const result = await readJsonOrThrow(response);
      console.log('Generation result:', result);
      
      // Redirect to status page
      router.push(`/generate/${result.id}`);

    } catch (error) {
      console.error('Generation failed:', error);
      setErrors([error.message || 'Generation failed. Please try again.']);
    } finally {
      setIsGenerating(false);
    }
  }, [formData, validateForm, router]);

  const canGenerate = formData.prompt.trim().length > 0 && !isGenerating;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold flex items-center justify-center">
          <Wand2 className="w-8 h-8 mr-3 text-primary" />
          Generate Vertical Video
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Create stunning vertical videos optimized for social media platforms using AI
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Text Area for Prompt Input */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Describe Your Video</h2>
          <div className="space-y-3">
            <textarea
              value={formData.prompt}
              onChange={(e) => updateForm({ prompt: e.target.value })}
              placeholder="Describe what you want to see in your video... (e.g., 'A chef cooking pasta in a modern kitchen, close-up shots of hands kneading dough')"
              className="w-full h-32 p-3 border rounded-lg resize-y focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={isGenerating}
              maxLength={500}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Be specific about actions, setting, and mood</span>
              <span>{formData.prompt.length}/500</span>
            </div>
          </div>
        </Card>

        {/* 2. Mode Selector (Vertical/Horizontal) */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Video Mode</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => updateForm({ mode: 'VERTICAL' })}
              disabled={isGenerating}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.mode === 'VERTICAL'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Smartphone className={`w-6 h-6 ${formData.mode === 'VERTICAL' ? 'text-primary' : 'text-gray-400'}`} />
                <div className="text-left">
                  <div className="font-medium">Vertical (9:16)</div>
                  <div className="text-sm text-muted-foreground">Perfect for TikTok, Reels, Shorts</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => updateForm({ mode: 'HORIZONTAL' })}
              disabled={isGenerating}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.mode === 'HORIZONTAL'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Monitor className={`w-6 h-6 ${formData.mode === 'HORIZONTAL' ? 'text-primary' : 'text-gray-400'}`} />
                <div className="text-left">
                  <div className="font-medium">Horizontal (16:9)</div>
                  <div className="text-sm text-muted-foreground">Standard for YouTube, presentations</div>
                </div>
              </div>
            </button>
          </div>
        </Card>

        {/* 3. Image Upload Component */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Reference Image (Optional)</h2>
          
          {formData.referenceImage ? (
            // Image preview
            <div className="space-y-4">
              <div className="flex items-center space-x-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <img
                  src={URL.createObjectURL(formData.referenceImage)}
                  alt="Reference preview"
                  className="w-16 h-16 object-cover rounded"
                />
                <div className="flex-1">
                  <div className="font-medium text-green-800">{formData.referenceImage.name}</div>
                  <div className="text-sm text-green-600">
                    {(formData.referenceImage.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleFileUpload(null)}
                  disabled={isGenerating}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            // Upload area
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-gray-300 hover:border-gray-400'
              } ${isGenerating ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
              onDragEnter={handleDragIn}
              onDragLeave={handleDragOut}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
                disabled={isGenerating}
              />
              
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <p className="text-lg font-medium">Upload Reference Image</p>
                  <p className="text-sm text-muted-foreground">
                    Drag & drop or click to browse (JPG, PNG, WebP, GIF)
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* 4. Background Options */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Background Style</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {BACKGROUND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateForm({ backgroundMode: option.value as any })}
                disabled={isGenerating}
                className={`p-3 rounded-lg border text-left transition-all ${
                  formData.backgroundMode === option.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Duration Setting */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Video Duration</h2>
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium">Duration:</label>
            <select
              value={formData.duration}
              onChange={(e) => updateForm({ duration: parseInt(e.target.value) })}
              disabled={isGenerating}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
              <option value={8}>8 seconds</option>
              <option value={10}>10 seconds</option>
            </select>
          </div>
        </Card>

        {/* Error Display */}
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800">Please fix the following issues:</h3>
                  <ul className="mt-2 space-y-1">
                    {errors.map((error, index) => (
                      <li key={index} className="text-sm text-red-700">• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 5. Generate Button with Loading States */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Ready to Generate</h3>
              <p className="text-sm text-muted-foreground">
                {formData.mode === 'VERTICAL' ? 'Vertical' : 'Horizontal'} video • {formData.duration}s duration
                {formData.referenceImage && ' • With reference image'}
              </p>
            </div>
            
            <Button
              type="submit"
              size="lg"
              disabled={!canGenerate}
              className="min-w-[160px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Video
                </>
              )}
            </Button>
          </div>

          {/* Loading Progress */}
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 space-y-3"
            >
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div
                  className="bg-primary h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: '30%' }}
                  transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                />
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI is creating your video... This may take 2-3 minutes</span>
              </div>
            </motion.div>
          )}
        </Card>
      </form>

      {/* Success State */}
      {!isGenerating && formData.prompt && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-50 border border-green-200 rounded-lg"
        >
          <div className="flex items-center space-x-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Form looks good! Ready to generate.</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
