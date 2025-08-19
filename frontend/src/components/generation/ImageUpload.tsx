'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  Image as ImageIcon, 
  X, 
  AlertCircle, 
  CheckCircle,
  FileImage,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ImageUploadProps {
  onImageSelect: (file: File | null) => void;
  currentImage?: File | null;
  disabled?: boolean;
  maxSize?: number; // in MB
}

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ImageUpload({ 
  onImageSelect, 
  currentImage, 
  disabled,
  maxSize = 10 
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle file drop/selection
  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    setUploadError(null);
    
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        setUploadError(`File is too large. Maximum size is ${maxSize}MB.`);
      } else if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        setUploadError('Invalid file type. Please upload JPG, PNG, WebP, or GIF images.');
      } else {
        setUploadError('Failed to upload file. Please try again.');
      }
      return;
    }

    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setIsProcessing(true);

    try {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      
      // Validate image dimensions and content
      await validateImage(file);
      
      // Call parent callback
      onImageSelect(file);
      
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to process image');
      setPreview(null);
      onImageSelect(null);
    } finally {
      setIsProcessing(false);
    }
  }, [onImageSelect, maxSize]);

  // Validate image
  const validateImage = useCallback((file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        // Check minimum dimensions
        if (img.width < 256 || img.height < 256) {
          reject(new Error('Image must be at least 256x256 pixels'));
          return;
        }
        
        // Check maximum dimensions
        if (img.width > 4096 || img.height > 4096) {
          reject(new Error('Image must be smaller than 4096x4096 pixels'));
          return;
        }
        
        // Check aspect ratio (should be reasonable)
        const aspectRatio = img.width / img.height;
        if (aspectRatio > 3 || aspectRatio < 0.33) {
          reject(new Error('Image aspect ratio should be between 1:3 and 3:1'));
          return;
        }
        
        resolve();
      };
      
      img.onerror = () => {
        reject(new Error('Invalid or corrupted image file'));
      };
      
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Setup dropzone
  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    disabled: disabled || isProcessing,
    multiple: false
  });

  // Remove current image
  const handleRemoveImage = useCallback(() => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    setUploadError(null);
    onImageSelect(null);
  }, [preview, onImageSelect]);

  // Get dropzone styling
  const getDropzoneClass = () => {
    let baseClass = "dropzone transition-all duration-200 ";
    
    if (disabled || isProcessing) {
      baseClass += "opacity-50 cursor-not-allowed ";
    } else if (isDragReject || uploadError) {
      baseClass += "border-destructive bg-destructive/5 ";
    } else if (isDragAccept) {
      baseClass += "border-green-500 bg-green-50 ";
    } else if (isDragActive) {
      baseClass += "border-primary bg-primary/5 ";
    }
    
    return baseClass;
  };

  // Clean up preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div {...getRootProps()} className={getDropzoneClass()}>
        <input {...getInputProps()} />
        
        <AnimatePresence mode="wait">
          {currentImage || preview ? (
            // Image Preview
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative"
            >
              <div className="flex items-center justify-center space-x-4">
                {/* Image thumbnail */}
                <div className="relative">
                  <img
                    src={preview || (currentImage ? URL.createObjectURL(currentImage) : '')}
                    alt="Reference image preview"
                    className="w-24 h-24 object-cover rounded-lg border"
                  />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                
                {/* Image info */}
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileImage className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-sm">
                      {currentImage?.name || 'Reference image uploaded'}
                    </span>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  
                  {currentImage && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Size: {(currentImage.size / 1024 / 1024).toFixed(2)} MB</div>
                      <div>Type: {currentImage.type}</div>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    Click to replace or drag a new image
                  </p>
                </div>
                
                {/* Remove button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage();
                  }}
                  disabled={disabled || isProcessing}
                  className="text-destructive hover:text-destructive"
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
              className="text-center py-8"
            >
              <div className="flex flex-col items-center space-y-4">
                {isProcessing ? (
                  <>
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-lg font-medium">Processing image...</p>
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-secondary rounded-full">
                      {isDragActive ? (
                        <Upload className="w-8 h-8 text-primary" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    
                    <div>
                      <p className="text-lg font-medium mb-1">
                        {isDragActive ? 'Drop image here' : 'Upload reference image'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Drag & drop or click to browse
                      </p>
                    </div>
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                    >
                      Choose File
                    </Button>
                  </>
                )}
              </div>
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
            className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
          >
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="text-sm text-destructive">
                <p className="font-medium">Upload failed</p>
                <p>{uploadError}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload guidelines */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Supported formats:</strong> JPG, PNG, WebP, GIF</p>
        <p><strong>Size limits:</strong> Maximum {maxSize}MB, 256×256 to 4096×4096 pixels</p>
        <p><strong>Best results:</strong> Clear, well-lit images with good contrast</p>
      </div>

      {/* Tips */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-1">Reference Image Tips</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Use high-quality images for better AI understanding</li>
          <li>• The AI will use this as inspiration for style, character, or composition</li>
          <li>• Works best with clear subjects and good lighting</li>
          <li>• The final video will be influenced by but not identical to this image</li>
        </ul>
      </div>
    </div>
  );
}
