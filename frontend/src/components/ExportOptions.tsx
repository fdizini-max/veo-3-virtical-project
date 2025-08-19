'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Settings2,
  Crop,
  Smartphone,
  Film,
  FileVideo,
  Loader2,
  Check,
  Info,
  AlertCircle,
  Maximize2,
  Move,
  RotateCw,
  Palette,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

interface ExportOptionsProps {
  videoUrl: string;
  jobId: string;
  mode: 'VERTICAL' | 'HORIZONTAL';
  originalDimensions?: { width: number; height: number };
  onExport: (options: ExportConfig) => Promise<void>;
}

interface ExportConfig {
  format: string;
  preset?: string;
  crop?: CropSettings;
  quality: string;
  encodingSpeed: string;
  outputFormat: 'mp4' | 'mov' | 'webm';
  customSettings?: {
    bitrate?: string;
    fps?: number;
    resolution?: string;
  };
}

interface CropSettings {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

type LucideIcon = (props: { className?: string }) => JSX.Element;

interface PlatformPreset {
  id: string;
  name: string;
  icon: any;
  resolution: string;
  aspectRatio: string;
  fps: number;
  maxBitrate: string;
  recommended: boolean;
  description: string;
  color: string;
}

const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: Smartphone,
    resolution: '1080x1920',
    aspectRatio: '9:16',
    fps: 30,
    maxBitrate: '12M',
    recommended: true,
    description: 'Optimized for TikTok feed & discovery',
    color: 'from-black to-pink-600'
  },
  {
    id: 'reels',
    name: 'Instagram Reels',
    icon: Film,
    resolution: '1080x1920',
    aspectRatio: '9:16',
    fps: 30,
    maxBitrate: '8M',
    recommended: true,
    description: 'Perfect for Instagram Reels',
    color: 'from-purple-600 to-pink-600'
  },
  {
    id: 'shorts',
    name: 'YouTube Shorts',
    icon: FileVideo,
    resolution: '1080x1920',
    aspectRatio: '9:16',
    fps: 30,
    maxBitrate: '15M',
    recommended: true,
    description: 'YouTube Shorts optimized',
    color: 'from-red-600 to-red-800'
  }
];

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  icon: any;
  speed: string;
  quality: string;
  fileSize: string;
}

const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'GUARANTEED_UPRIGHT',
    name: 'Guaranteed Upright 9:16',
    description: 'Re-encode with rotation and crop. Universal compatibility.',
    icon: Smartphone,
    speed: 'Medium',
    quality: 'High',
    fileSize: 'Medium'
  },
  {
    id: 'METADATA_ROTATE',
    name: 'Fast Metadata Rotation',
    description: 'Quick rotation using metadata flags. May not work everywhere.',
    icon: Zap,
    speed: 'Fast',
    quality: 'Original',
    fileSize: 'Small'
  },
  {
    id: 'SCALE_PAD',
    name: 'Scale with Padding',
    description: 'Scales and adds black bars to achieve 9:16.',
    icon: Maximize2,
    speed: 'Medium',
    quality: 'High',
    fileSize: 'Medium'
  },
  {
    id: 'CUSTOM_CROP',
    name: 'Custom Crop & Position',
    description: 'Manually adjust crop area and position.',
    icon: Crop,
    speed: 'Slow',
    quality: 'High',
    fileSize: 'Variable'
  }
];

export function ExportOptions({
  videoUrl,
  jobId,
  mode,
  originalDimensions = { width: 1920, height: 1080 },
  onExport
}: ExportOptionsProps) {
  const [selectedFormat, setSelectedFormat] = useState('GUARANTEED_UPRIGHT');
  const [selectedPreset, setSelectedPreset] = useState<string | null>('tiktok');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [outputFormat, setOutputFormat] = useState<'mp4' | 'mov' | 'webm'>('mp4');
  const [quality, setQuality] = useState('23'); // CRF value
  const [encodingSpeed, setEncodingSpeed] = useState('medium');
  
  // Crop adjustment states
  const [cropSettings, setCropSettings] = useState<CropSettings>({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0
  });

  // Handle export
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const config: ExportConfig = {
        format: selectedFormat,
        preset: selectedPreset || undefined,
        crop: selectedFormat === 'CUSTOM_CROP' ? cropSettings : undefined,
        quality,
        encodingSpeed,
        outputFormat,
        customSettings: showAdvanced ? {
          bitrate: selectedPreset ? 
            PLATFORM_PRESETS.find(p => p.id === selectedPreset)?.maxBitrate : 
            '10M',
          fps: selectedPreset ? 
            PLATFORM_PRESETS.find(p => p.id === selectedPreset)?.fps : 
            30,
          resolution: selectedPreset ? 
            PLATFORM_PRESETS.find(p => p.id === selectedPreset)?.resolution : 
            '1080x1920'
        } : undefined
      };

      await onExport(config);
      
      clearInterval(progressInterval);
      setExportProgress(100);
      
      // Reset after a delay
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 2000);
      
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [selectedFormat, selectedPreset, cropSettings, quality, encodingSpeed, outputFormat, showAdvanced, onExport]);

  // Calculate crop preview dimensions
  const getCropPreviewStyle = () => {
    if (selectedFormat !== 'CUSTOM_CROP') return {};
    
    return {
      left: `${cropSettings.x}%`,
      top: `${cropSettings.y}%`,
      width: `${cropSettings.width}%`,
      height: `${cropSettings.height}%`,
      transform: `rotate(${cropSettings.rotation}deg)`
    };
  };

  return (
    <div className="space-y-6">
      {/* Export Format Selection */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Settings2 className="w-5 h-5 mr-2" />
          Export Format Selection
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXPORT_FORMATS.map((format) => {
            const Icon = format.icon;
            const isSelected = selectedFormat === format.id;
            
            return (
              <motion.button
                key={format.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedFormat(format.id)}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  isSelected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-start space-x-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isSelected ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-medium text-sm mb-1">{format.name}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{format.description}</p>
                    
                    <div className="flex items-center space-x-2 text-xs">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full",
                        format.speed === 'Fast' ? 'bg-green-100 text-green-700' :
                        format.speed === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      )}>
                        {format.speed}
                      </span>
                      <span className="text-muted-foreground">Quality: {format.quality}</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </Card>

      {/* Crop Adjustment Sliders */}
      <AnimatePresence>
        {selectedFormat === 'CUSTOM_CROP' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Crop className="w-5 h-5 mr-2" />
                Crop Adjustment
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Crop Preview */}
                <div>
                  <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
                    {/* Video preview (simplified) */}
                    <div className="absolute inset-0 bg-gray-200">
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <Film className="w-12 h-12" />
                      </div>
                    </div>
                    
                    {/* Crop overlay */}
                    <div 
                      className="absolute border-2 border-primary bg-primary/10"
                      style={getCropPreviewStyle()}
                    >
                      <div className="absolute inset-0 border border-white/50"></div>
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <Move className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                    
                    {/* Grid overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="h-full w-full grid grid-cols-3 grid-rows-3">
                        {[...Array(9)].map((_, i) => (
                          <div key={i} className="border border-white/20"></div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    Adjust the sliders to position and size your crop area
                  </p>
                </div>
                
                {/* Crop Controls */}
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center justify-between text-sm font-medium mb-2">
                      <span className="flex items-center">
                        <Move className="w-4 h-4 mr-1" />
                        Horizontal Position
                      </span>
                      <span className="text-muted-foreground">{cropSettings.x}%</span>
                    </label>
                      {/* @ts-expect-error Relaxed typing for Radix Slider */}
                      <Slider
                        defaultValue={[cropSettings.x] as any}
                        onValueChange={(value: any) => setCropSettings(prev => ({ ...prev, x: value[0] }))}
                        max={100 - cropSettings.width as any}
                        step={1}
                        className="w-full"
                      />
                  </div>
                  
                  <div>
                    <label className="flex items-center justify-between text-sm font-medium mb-2">
                      <span className="flex items-center">
                        <Move className="w-4 h-4 mr-1" />
                        Vertical Position
                      </span>
                      <span className="text-muted-foreground">{cropSettings.y}%</span>
                    </label>
                      {/* @ts-expect-error Relaxed typing for Radix Slider */}
                      <Slider
                        defaultValue={[cropSettings.y] as any}
                        onValueChange={(value: any) => setCropSettings(prev => ({ ...prev, y: value[0] }))}
                        max={100 - cropSettings.height as any}
                        step={1}
                        className="w-full"
                      />
                  </div>
                  
                  <div>
                    <label className="flex items-center justify-between text-sm font-medium mb-2">
                      <span className="flex items-center">
                        <Maximize2 className="w-4 h-4 mr-1" />
                        Width
                      </span>
                      <span className="text-muted-foreground">{cropSettings.width}%</span>
                    </label>
                      {/* @ts-expect-error Relaxed typing for Radix Slider */}
                      <Slider
                        defaultValue={[cropSettings.width] as any}
                        onValueChange={(value: any) => setCropSettings(prev => ({ ...prev, width: value[0] }))}
                        min={10}
                        max={100 - cropSettings.x as any}
                        step={1}
                        className="w-full"
                      />
                  </div>
                  
                  <div>
                    <label className="flex items-center justify-between text-sm font-medium mb-2">
                      <span className="flex items-center">
                        <Maximize2 className="w-4 h-4 mr-1" />
                        Height
                      </span>
                      <span className="text-muted-foreground">{cropSettings.height}%</span>
                    </label>
                      {/* @ts-expect-error Relaxed typing for Radix Slider */}
                      <Slider
                        defaultValue={[cropSettings.height] as any}
                        onValueChange={(value: any) => setCropSettings(prev => ({ ...prev, height: value[0] }))}
                        min={10}
                        max={100 - cropSettings.y as any}
                        step={1}
                        className="w-full"
                      />
                  </div>
                  
                  <div>
                    <label className="flex items-center justify-between text-sm font-medium mb-2">
                      <span className="flex items-center">
                        <RotateCw className="w-4 h-4 mr-1" />
                        Rotation
                      </span>
                      <span className="text-muted-foreground">{cropSettings.rotation}°</span>
                    </label>
                      {/* @ts-expect-error Relaxed typing for Radix Slider */}
                      <Slider
                        defaultValue={[cropSettings.rotation] as any}
                        onValueChange={(value: any) => setCropSettings(prev => ({ ...prev, rotation: value[0] }))}
                        min={-180}
                        max={180}
                        step={1}
                        className="w-full"
                      />
                  </div>
                  
                  {/* Quick presets */}
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-2">Quick Presets</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCropSettings({ x: 21, y: 0, width: 58, height: 100, rotation: 0 })}
                      >
                        Center 9:16
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCropSettings({ x: 0, y: 0, width: 56, height: 100, rotation: 0 })}
                      >
                        Left 9:16
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCropSettings({ x: 44, y: 0, width: 56, height: 100, rotation: 0 })}
                      >
                        Right 9:16
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Platform Presets */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Smartphone className="w-5 h-5 mr-2" />
          Platform Presets
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLATFORM_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = selectedPreset === preset.id;
            
            return (
              <motion.button
                key={preset.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedPreset(preset.id)}
                className={cn(
                  "relative p-4 rounded-lg border-2 text-left transition-all overflow-hidden",
                  isSelected ? "border-primary" : "border-gray-200 hover:border-gray-300"
                )}
              >
                {/* Background gradient */}
                <div 
                  className={cn(
                    "absolute inset-0 opacity-10 bg-gradient-to-br",
                    preset.color
                  )}
                />
                
                {/* Content */}
                <div className="relative">
                  {preset.recommended && (
                    <div className="absolute -top-2 -right-2">
                      <div className="bg-primary text-white text-xs px-2 py-1 rounded-full">
                        Recommended
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-start space-x-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      isSelected ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-medium">{preset.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
                      
                      <div className="mt-3 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Resolution:</span>
                          <span className="font-medium">{preset.resolution}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>FPS:</span>
                          <span className="font-medium">{preset.fps}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Max Bitrate:</span>
                          <span className="font-medium">{preset.maxBitrate}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
        
        {/* Platform tips */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Platform Tips:</p>
              <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                <li>TikTok: Keep videos under 60 seconds for best reach</li>
                <li>Instagram Reels: 90 seconds max, square thumbnails work best</li>
                <li>YouTube Shorts: Up to 60 seconds, optimize for mobile viewing</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      {/* Advanced Settings */}
      <Card className="p-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mb-4"
        >
          <Settings2 className="w-4 h-4 mr-2" />
          {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
        </Button>
        
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Output Format</label>
                  <Select
                    value={outputFormat}
                    onValueChange={(value) => setOutputFormat(value as 'mp4' | 'mov' | 'webm')}
                  >
                    <option value="mp4">MP4 (H.264)</option>
                    <option value="mov">MOV (ProRes)</option>
                    <option value="webm">WebM (VP9)</option>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Quality (CRF)</label>
                  <Select
                    value={quality}
                    onValueChange={setQuality}
                  >
                    <option value="18">High Quality (CRF 18)</option>
                    <option value="23">Balanced (CRF 23)</option>
                    <option value="28">Smaller File (CRF 28)</option>
                    <option value="32">Low Quality (CRF 32)</option>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Encoding Speed</label>
                  <Select
                    value={encodingSpeed}
                    onValueChange={setEncodingSpeed}
                  >
                    <option value="ultrafast">Ultra Fast</option>
                    <option value="fast">Fast</option>
                    <option value="medium">Medium (Balanced)</option>
                    <option value="slow">Slow (Better Quality)</option>
                    <option value="veryslow">Very Slow (Best Quality)</option>
                  </Select>
                </div>
              </div>
              
              {/* Encoding info */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  <strong>Encoding Speed vs Quality:</strong> Slower encoding produces better quality at the same file size. 
                  For social media, 'Fast' or 'Medium' is usually sufficient.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Download Buttons */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Export & Download</h3>
        
        {/* Export summary */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Export Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Format:</span>
              <p className="font-medium">{EXPORT_FORMATS.find(f => f.id === selectedFormat)?.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Platform:</span>
              <p className="font-medium">{selectedPreset ? PLATFORM_PRESETS.find(p => p.id === selectedPreset)?.name : 'Custom'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Output:</span>
              <p className="font-medium">{outputFormat.toUpperCase()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Quality:</span>
              <p className="font-medium">CRF {quality}</p>
            </div>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            size="lg"
            className="flex-1"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting... {exportProgress}%
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export with Selected Settings
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              // Direct download of original
              const link = document.createElement('a');
              link.href = videoUrl;
              link.download = `original_${jobId}.mp4`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            disabled={isExporting}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Original (16:9)
          </Button>
        </div>
        
        {/* Export progress */}
        <AnimatePresence>
          {isExporting && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <div className="space-y-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="bg-primary h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${exportProgress}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {exportProgress < 30 && "Analyzing video..."}
                    {exportProgress >= 30 && exportProgress < 60 && "Processing frames..."}
                    {exportProgress >= 60 && exportProgress < 90 && "Encoding output..."}
                    {exportProgress >= 90 && "Finalizing export..."}
                  </span>
                  <span className="font-medium">{exportProgress}%</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Success message */}
        <AnimatePresence>
          {exportProgress === 100 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <Check className="w-5 h-5 text-green-600" />
                <p className="text-green-800 font-medium">Export completed successfully!</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Export tips */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h4 className="font-medium text-amber-800 mb-2 flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          Export Tips
        </h4>
        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
          <li><strong>File Size:</strong> Higher quality (lower CRF) = larger files</li>
          <li><strong>Compatibility:</strong> MP4 with H.264 works everywhere</li>
          <li><strong>Social Media:</strong> Most platforms re-encode uploads anyway</li>
          <li><strong>Best Practice:</strong> Keep a high-quality master and export platform-specific versions</li>
        </ul>
      </div>
    </div>
  );
}
