'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Settings, 
  Smartphone,
  Monitor,
  Zap,
  Shield,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface VideoPreviewProps {
  videoUrl: string;
  mode: 'VERTICAL' | 'HORIZONTAL';
  jobId: string;
  isProcessing?: boolean;
  onExport?: (exportType: string, options?: any) => void;
}

interface ExportOption {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  speed: 'Fast' | 'Medium' | 'Slow';
  compatibility: 'Universal' | 'Most Devices' | 'Limited';
  recommended?: boolean;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'GUARANTEED_UPRIGHT',
    name: 'Guaranteed Upright 9:16',
    description: 'Re-encode with rotation and crop. Works everywhere, best for social media.',
    icon: Shield,
    speed: 'Medium',
    compatibility: 'Universal',
    recommended: true
  },
  {
    id: 'METADATA_ROTATE',
    name: 'Fast Export (Metadata Only)',
    description: 'Quick rotation using metadata flags. May not work on all platforms.',
    icon: Zap,
    speed: 'Fast',
    compatibility: 'Limited'
  },
  {
    id: 'SCALE_PAD',
    name: 'Scale + Pad to 9:16',
    description: 'Scales video and adds padding. Preserves full content.',
    icon: Monitor,
    speed: 'Medium',
    compatibility: 'Universal'
  }
];

export function VideoPreview({ 
  videoUrl, 
  mode, 
  jobId, 
  isProcessing = false,
  onExport 
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showRawView, setShowRawView] = useState(false);
  const [selectedExport, setSelectedExport] = useState<string>('GUARANTEED_UPRIGHT');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);

  // Video control handlers
  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Export handler
  const handleExport = useCallback(async (exportType: string) => {
    if (!onExport) return;
    
    setIsExporting(true);
    try {
      await onExport(exportType, {
        resolution: '1080x1920',
        fps: 30,
        preset: 'TikTok'
      });
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [onExport]);

  // Download original file
  const handleDownloadOriginal = useCallback(() => {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `original_${jobId}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [videoUrl, jobId]);

  const isVerticalMode = mode === 'VERTICAL';

  return (
    <div className="space-y-6">
      {/* Video Preview Container */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Video Preview</h2>
          
          {/* View toggle for vertical videos */}
          {isVerticalMode && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Preview mode:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRawView(!showRawView)}
                disabled={isProcessing}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {showRawView ? 'Vertical Preview' : 'Raw 16:9 View'}
              </Button>
            </div>
          )}
        </div>

        {/* 9:16 Container for Vertical Preview */}
        <div className="flex justify-center">
          {isVerticalMode ? (
            <div className="relative">
              {/* Vertical preview container (9:16 aspect ratio) */}
              <div 
                className={`
                  relative mx-auto bg-black rounded-lg overflow-hidden shadow-lg
                  ${showRawView ? 'w-full max-w-2xl' : 'w-80'} 
                  ${showRawView ? 'aspect-video' : 'aspect-[9/16]'}
                `}
              >
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className={`
                    w-full h-full object-cover transition-transform duration-300
                    ${!showRawView && !isProcessing ? 'transform rotate-90 scale-[1.78]' : ''}
                  `}
                  style={{
                    transformOrigin: 'center center'
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  loop
                  muted
                  playsInline
                />
                
                {/* Video controls overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handlePlayPause}
                      className="bg-white/90 text-black hover:bg-white"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Processing overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="text-center text-white space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                      <p className="text-sm">Processing video...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview mode indicator */}
              <div className="mt-3 text-center">
                <div className={`
                  inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                  ${showRawView 
                    ? 'bg-gray-100 text-gray-700' 
                    : 'bg-primary/10 text-primary'
                  }
                `}>
                  {showRawView ? (
                    <>
                      <Monitor className="w-3 h-3 mr-1" />
                      Raw 16:9 View
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-3 h-3 mr-1" />
                      Vertical Preview (9:16)
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Horizontal video preview
            <div className="w-full max-w-4xl">
              <div className="relative bg-black rounded-lg overflow-hidden shadow-lg aspect-video">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-cover"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  loop
                  muted
                  playsInline
                />
                
                {/* Video controls */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handlePlayPause}
                      className="bg-white/90 text-black hover:bg-white"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CSS Transform Info */}
        {isVerticalMode && !showRawView && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <h4 className="text-sm font-medium text-blue-900 mb-1">🔄 CSS Transform Preview</h4>
            <p className="text-xs text-blue-800">
              This preview uses CSS <code>transform: rotate(90deg) scale(1.78)</code> to show how your 
              video will look when rotated to vertical. The actual file remains 16:9 until export.
            </p>
          </motion.div>
        )}
      </Card>

      {/* Export Buttons */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Export Options</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportOptions(!showExportOptions)}
          >
            <Settings className="w-4 h-4 mr-2" />
            {showExportOptions ? 'Hide Options' : 'Show Options'}
          </Button>
        </div>

        {/* Quick export buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {EXPORT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedExport === option.id;
            
            return (
              <motion.button
                key={option.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedExport(option.id)}
                className={`
                  p-4 rounded-lg border-2 text-left transition-all
                  ${isSelected 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                {/* Recommended badge */}
                {option.recommended && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full"></div>
                )}

                <div className="flex items-start space-x-3">
                  <div className={`
                    p-2 rounded-lg
                    ${isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}
                  `}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-medium text-sm mb-1">{option.name}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{option.description}</p>
                    
                    <div className="flex items-center space-x-3 text-xs">
                      <span className={`
                        px-2 py-1 rounded-full
                        ${option.speed === 'Fast' ? 'bg-green-100 text-green-700' :
                          option.speed === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'}
                      `}>
                        {option.speed}
                      </span>
                      <span className="text-muted-foreground">{option.compatibility}</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Export actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="space-y-1">
            <div className="text-sm font-medium">
              Selected: {EXPORT_OPTIONS.find(opt => opt.id === selectedExport)?.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {isVerticalMode ? 'Output: 1080×1920 (9:16)' : 'Output: 1920×1080 (16:9)'}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={handleDownloadOriginal}
              disabled={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              Download 16:9 Master
            </Button>
            
            <Button
              onClick={() => handleExport(selectedExport)}
              disabled={isExporting}
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export {isVerticalMode ? '9:16' : '16:9'}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Export progress */}
        <AnimatePresence>
          {isExporting && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-3"
            >
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div
                  className="bg-primary h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: '60%' }}
                  transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse' }}
                />
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing export... This may take 1-2 minutes</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Advanced Export Options */}
      <AnimatePresence>
        {showExportOptions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Advanced Export Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Platform presets */}
                <div>
                  <h4 className="font-medium mb-3">Platform Presets</h4>
                  <div className="space-y-2">
                    {['TikTok', 'Instagram Reels', 'YouTube Shorts'].map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => handleExport('GUARANTEED_UPRIGHT')}
                        disabled={isExporting}
                        className="w-full p-3 text-left border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                      >
                        <div className="font-medium text-sm">{platform}</div>
                        <div className="text-xs text-muted-foreground">1080×1920, 30fps, optimized</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quality settings */}
                <div>
                  <h4 className="font-medium mb-3">Quality Settings</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Video Quality</label>
                      <select className="w-full p-2 border rounded-lg">
                        <option value="18">High Quality (CRF 18)</option>
                        <option value="23">Balanced (CRF 23)</option>
                        <option value="28">Smaller File (CRF 28)</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Encoding Speed</label>
                      <select className="w-full p-2 border rounded-lg">
                        <option value="medium">Medium (Recommended)</option>
                        <option value="fast">Fast</option>
                        <option value="slow">Slow (Best Quality)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export explanation */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h4 className="font-medium text-amber-800 mb-2">📤 Export Information</h4>
        <div className="text-sm text-amber-700 space-y-1">
          {isVerticalMode ? (
            <>
              <p><strong>Vertical Export:</strong> Your 16:9 video will be rotated and cropped to perfect 9:16 format</p>
              <p><strong>Recommended:</strong> "Guaranteed Upright" works on all social media platforms</p>
              <p><strong>Fast Option:</strong> "Metadata Only" is quicker but may not work everywhere</p>
            </>
          ) : (
            <>
              <p><strong>Horizontal Export:</strong> Standard 16:9 format, ready for YouTube and presentations</p>
              <p><strong>Quality:</strong> Professional encoding with optimized settings</p>
            </>
          )}
        </div>
      </div>

      {/* Fallback info for vertical */}
      {isVerticalMode && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">🔄 Preview Technology</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>CSS Transform:</strong> {showRawView ? 'Showing original 16:9 file' : 'Rotated preview using CSS transforms'}</p>
            <p><strong>File Status:</strong> Original file remains 16:9 until export</p>
            <p><strong>Toggle:</strong> Use "Raw 16:9 View" if preview has display issues</p>
          </div>
        </div>
      )}
    </div>
  );
}
