'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  Upload, 
  Wand2, 
  Clock, 
  Settings, 
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
  Sparkles
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { PromptInput } from './PromptInput';
import { ImageUpload } from './ImageUpload';
import { ModeSelector } from './ModeSelector';
import { GenerationStatus } from './GenerationStatus';

import { useGeneration } from '@/lib/hooks/useGeneration';
import { useAuth } from '@/lib/hooks/useAuth';
import { generationAPI } from '@/lib/api/generation';
import { validatePrompt } from '@/lib/utils/validation';

interface GenerationFormData {
  prompt: string;
  mode: 'VERTICAL_FIRST' | 'HORIZONTAL';
  duration: number;
  fps: number;
  resolution: string;
  backgroundMode: 'SOLID_COLOR' | 'GREENSCREEN' | 'MINIMAL_GRADIENT' | 'CUSTOM';
  referenceImage?: File;
  useFastModel: boolean;
}

const DEFAULT_FORM_DATA: GenerationFormData = {
  prompt: '',
  mode: 'VERTICAL_FIRST',
  duration: 5,
  fps: 30,
  resolution: '1920x1080',
  backgroundMode: 'MINIMAL_GRADIENT',
  useFastModel: false,
};

export function GenerationForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { createGeneration } = useGeneration();

  // Form state
  const [formData, setFormData] = useState<GenerationFormData>(DEFAULT_FORM_DATA);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);

  // Get user's generation limits
  const { data: userLimits } = useQuery({
    queryKey: ['user-limits', user?.id],
    queryFn: () => generationAPI.getUserLimits(),
    enabled: !!user,
  });

  // Generation mutation
  const generateMutation = useMutation({
    mutationFn: generationAPI.createGeneration,
    onSuccess: (response) => {
      router.push(`/results/${response.id}`);
    },
    onError: (error: any) => {
      console.error('Generation failed:', error);
      setValidationErrors([error.message || 'Generation failed. Please try again.']);
    },
  });

  // Update form data
  const updateFormData = useCallback((updates: Partial<GenerationFormData>) => {
    setFormData(prev => {
      const newData = { ...prev, ...updates };
      
      // Clear validation errors when form changes
      if (validationErrors.length > 0) {
        setValidationErrors([]);
      }
      
      // Update cost estimation
      updateCostEstimate(newData);
      
      return newData;
    });
  }, [validationErrors.length]);

  // Update cost estimation
  const updateCostEstimate = useCallback((data: GenerationFormData) => {
    // Base cost calculation (this would come from your pricing API)
    let baseCost = 0.10; // $0.10 per generation
    
    // Adjust for duration
    baseCost += data.duration * 0.02; // $0.02 per second
    
    // Adjust for model type
    if (!data.useFastModel) {
      baseCost *= 1.5; // Premium model costs more
    }
    
    // Adjust for reference image
    if (formData.referenceImage) {
      baseCost += 0.05; // Image-to-video costs more
    }
    
    setEstimatedCost(baseCost);
  }, [formData.referenceImage]);

  // Validate form before submission
  const validateForm = useCallback((): boolean => {
    const errors: string[] = [];
    
    // Validate prompt
    const promptValidation = validatePrompt(formData.prompt);
    if (!promptValidation.isValid) {
      errors.push(...promptValidation.errors);
    }
    
    // Check user limits
    if (userLimits) {
      if (userLimits.dailyGenerationsUsed >= userLimits.dailyGenerationsLimit) {
        errors.push('Daily generation limit reached. Upgrade your plan for more generations.');
      }
      
      if (formData.duration > userLimits.maxDuration) {
        errors.push(`Duration cannot exceed ${userLimits.maxDuration} seconds for your plan.`);
      }
    }
    
    // Validate file size if reference image is provided
    if (formData.referenceImage && formData.referenceImage.size > 10 * 1024 * 1024) {
      errors.push('Reference image must be smaller than 10MB.');
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  }, [formData, userLimits]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      // Prepare generation request
      const generationRequest = {
        prompt: formData.prompt,
        mode: formData.mode,
        duration: formData.duration,
        fps: formData.fps,
        resolution: formData.resolution,
        backgroundMode: formData.backgroundMode,
        useFastModel: formData.useFastModel,
        referenceImage: formData.referenceImage,
      };
      
      await generateMutation.mutateAsync(generationRequest);
    } catch (error) {
      console.error('Generation submission failed:', error);
    }
  }, [formData, validateForm, generateMutation]);

  // Handle example prompt selection
  const handleExamplePrompt = useCallback((prompt: string) => {
    updateFormData({ prompt });
  }, [updateFormData]);

  const isGenerating = generateMutation.isPending;
  const canGenerate = !isGenerating && formData.prompt.trim().length > 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center space-x-2"
        >
          <Sparkles className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Generate Vertical Video</h1>
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-muted-foreground max-w-2xl mx-auto"
        >
          Create stunning vertical videos optimized for TikTok, Instagram Reels, and YouTube Shorts. 
          Our AI automatically composes your video for perfect vertical viewing.
        </motion.p>

        {/* User limits display */}
        {userLimits && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-secondary rounded-full text-sm"
          >
            <Clock className="w-4 h-4" />
            <span>
              {userLimits.dailyGenerationsUsed} / {userLimits.dailyGenerationsLimit} generations used today
            </span>
          </motion.div>
        )}
      </div>

      {/* Main Form */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        onSubmit={handleSubmit}
        className="space-y-8"
      >
        {/* Generation Mode */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Camera className="w-5 h-5 mr-2" />
            Generation Mode
          </h2>
          
          <ModeSelector
            value={formData.mode}
            onChange={(mode) => updateFormData({ mode })}
            disabled={isGenerating}
          />
          
          {/* Mode explanation */}
          <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="w-5 h-5 text-primary mt-0.5" />
              <div className="text-sm">
                {formData.mode === 'VERTICAL_FIRST' ? (
                  <div>
                    <p className="font-medium">Vertical-First Mode</p>
                    <p className="text-muted-foreground mt-1">
                      Automatically composes your video for vertical viewing. The AI creates a sideways 16:9 video 
                      that becomes perfect 9:16 when rotated. Best for social media content.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">Horizontal Mode</p>
                    <p className="text-muted-foreground mt-1">
                      Standard horizontal video generation. Creates traditional 16:9 landscape videos 
                      suitable for YouTube, presentations, or desktop viewing.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Prompt Input */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Wand2 className="w-5 h-5 mr-2" />
            Describe Your Video
          </h2>
          
          <PromptInput
            value={formData.prompt}
            onChange={(prompt) => updateFormData({ prompt })}
            placeholder={
              formData.mode === 'VERTICAL_FIRST'
                ? "Describe your vertical video scene... (e.g., 'A chef cooking pasta in a modern kitchen, close-up shots of hands kneading dough')"
                : "Describe your horizontal video scene... (e.g., 'A wide landscape shot of mountains at sunset with clouds moving across the sky')"
            }
            disabled={isGenerating}
            onExampleSelect={handleExamplePrompt}
            mode={formData.mode}
          />
        </Card>

        {/* Reference Image Upload */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Reference Image (Optional)
          </h2>
          
          <ImageUpload
            onImageSelect={(file) => updateFormData({ referenceImage: file })}
            currentImage={formData.referenceImage}
            disabled={isGenerating}
          />
          
          <p className="text-sm text-muted-foreground mt-2">
            Upload a reference image to guide the video generation. The AI will use this as a starting point 
            for character appearance, style, or composition.
          </p>
        </Card>

        {/* Basic Settings */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Video Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Duration */}
            <div>
              <label className="block text-sm font-medium mb-2">Duration</label>
              <Select
                value={formData.duration.toString()}
                onValueChange={(value) => updateFormData({ duration: parseInt(value) })}
                disabled={isGenerating}
              >
                <option value="3">3 seconds</option>
                <option value="5">5 seconds</option>
                <option value="8">8 seconds</option>
                <option value="10">10 seconds</option>
              </Select>
            </div>

            {/* Background Mode */}
            <div>
              <label className="block text-sm font-medium mb-2">Background</label>
              <Select
                value={formData.backgroundMode}
                onValueChange={(value) => updateFormData({ 
                  backgroundMode: value as GenerationFormData['backgroundMode']
                })}
                disabled={isGenerating}
              >
                <option value="MINIMAL_GRADIENT">Minimal Gradient</option>
                <option value="SOLID_COLOR">Solid Color</option>
                <option value="GREENSCREEN">Green Screen</option>
                <option value="CUSTOM">Custom</option>
              </Select>
            </div>

            {/* Model Speed */}
            <div>
              <label className="block text-sm font-medium mb-2">Generation Speed</label>
              <Select
                value={formData.useFastModel ? 'fast' : 'quality'}
                onValueChange={(value) => updateFormData({ useFastModel: value === 'fast' })}
                disabled={isGenerating}
              >
                <option value="quality">High Quality (Slower)</option>
                <option value="fast">Fast Generation</option>
              </Select>
            </div>
          </div>
        </Card>

        {/* Advanced Settings */}
        <Card className="p-6">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-left"
            disabled={isGenerating}
          >
            <h2 className="text-xl font-semibold flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Advanced Settings
            </h2>
            <motion.div
              animate={{ rotate: showAdvanced ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              ▼
            </motion.div>
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* FPS */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Frame Rate</label>
                    <Select
                      value={formData.fps.toString()}
                      onValueChange={(value) => updateFormData({ fps: parseInt(value) })}
                      disabled={isGenerating}
                    >
                      <option value="24">24 FPS (Cinematic)</option>
                      <option value="30">30 FPS (Standard)</option>
                    </Select>
                  </div>

                  {/* Resolution */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Resolution</label>
                    <Select
                      value={formData.resolution}
                      onValueChange={(value) => updateFormData({ resolution: value })}
                      disabled={isGenerating}
                    >
                      <option value="1920x1080">1920×1080 (Full HD)</option>
                      <option value="1280x720">1280×720 (HD)</option>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Validation Errors */}
        <AnimatePresence>
          {validationErrors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
            >
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                <div>
                  <h3 className="font-medium text-destructive">Please fix the following issues:</h3>
                  <ul className="mt-2 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index} className="text-sm text-destructive">
                        • {error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cost Estimation & Submit */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">Estimated Cost</h3>
              <p className="text-2xl font-bold text-primary">
                ${estimatedCost.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                {formData.useFastModel ? 'Fast generation' : 'High quality'} • {formData.duration}s duration
                {formData.referenceImage && ' • With reference image'}
              </p>
            </div>
            
            <Button
              type="submit"
              size="lg"
              disabled={!canGenerate}
              className="min-w-[140px]"
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

          {/* Generation Status */}
          {isGenerating && (
            <GenerationStatus 
              status="PROCESSING"
              progress={0}
              message="Preparing your video generation..."
            />
          )}
        </Card>
      </motion.form>
    </div>
  );
}
