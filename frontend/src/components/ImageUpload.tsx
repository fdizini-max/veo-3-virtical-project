'use client';

import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image as ImageIcon, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ImageUploadProps {
  onImageSelect: (file: File | null) => void;
  currentImage?: File | null;
  disabled?: boolean;
  maxSize?: number; // in MB
}

export function ImageUpload({ 
  onImageSelect, 
  currentImage, 
  disabled = false,
  maxSize = 10 
}: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    setUploadError(null);
    setIsProcessing(true);

    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      if (file.size > maxSize * 1024 * 1024) {
        throw new Error(`Image must be smaller than ${maxSize}MB`);
      }

      // Validate image dimensions
      await validateImageDimensions(file);
      
      onImageSelect(file);
      
    } catch (error) {
      setUploadError(error.message);
      onImageSelect(null);
    } finally {
      setIsProcessing(false);
    }
  }, [onImageSelect, maxSize]);

  // Validate image dimensions
  const validateImageDimensions = useCallback((file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < 256 || img.height < 256) {
          reject(new Error('Image must be at least 256x256 pixels'));
        } else if (img.width > 4096 || img.height > 4096) {
          reject(new Error('Image must be smaller than 4096x4096 pixels'));
        } else {
          resolve();
        }
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragActive(true);
  }, [disabled]);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  }, [disabled, handleFileSelect]);

  // File input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Remove image
  const handleRemove = useCallback(() => {
    onImageSelect(null);
    setUploadError(null);
  }, [onImageSelect]);

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        className={`
          border-2 border-dashed rounded-lg transition-all
          ${dragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
          ${uploadError ? 'border-red-300 bg-red-50' : ''}
        `}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && document.getElementById('image-input')?.click()}
      >
        <input
          id="image-input"
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        <AnimatePresence mode="wait">
          {currentImage ? (
            // Image preview
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="p-6"
            >
              <div className="flex items-center space-x-4">
                <img
                  src={URL.createObjectURL(currentImage)}
                  alt="Reference preview"
                  className="w-20 h-20 object-cover rounded-lg border"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-sm">{currentImage.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(currentImage.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Click to replace or drag a new image
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                  disabled={disabled}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ) : (
            // Upload prompt
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8 text-center"
            >
              {isProcessing ? (
                <div className="space-y-4">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                  <p className="text-lg font-medium">Processing image...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    {dragActive ? (
                      <Upload className="w-6 h-6 text-primary" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-medium">
                      {dragActive ? 'Drop image here' : 'Upload Reference Image'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Drag & drop or click to browse
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={disabled}>
                    Choose File
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-red-50 border border-red-200 rounded-lg"
          >
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
              <div className="text-sm text-red-700">
                <p className="font-medium">Upload failed</p>
                <p>{uploadError}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guidelines */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Supported:</strong> JPG, PNG, WebP, GIF</p>
        <p><strong>Size:</strong> Max {maxSize}MB, 256×256 to 4096×4096 pixels</p>
        <p><strong>Best results:</strong> Clear, well-lit images with good contrast</p>
      </div>
    </div>
  );
}
