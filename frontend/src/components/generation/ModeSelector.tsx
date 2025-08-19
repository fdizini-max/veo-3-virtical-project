'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Smartphone, 
  Monitor, 
  TrendingUp, 
  Users, 
  Clock,
  Zap
} from 'lucide-react';

interface ModeSelectorProps {
  value: 'VERTICAL_FIRST' | 'HORIZONTAL';
  onChange: (mode: 'VERTICAL_FIRST' | 'HORIZONTAL') => void;
  disabled?: boolean;
}

const modes = [
  {
    id: 'VERTICAL_FIRST' as const,
    title: 'Vertical-First',
    subtitle: 'Perfect for Social Media',
    description: 'AI automatically composes videos for vertical viewing (9:16). Ideal for TikTok, Instagram Reels, and YouTube Shorts.',
    icon: Smartphone,
    features: [
      'Optimized for mobile viewing',
      'Perfect 9:16 aspect ratio',
      'Smart vertical composition',
      'Social media ready'
    ],
    platforms: ['TikTok', 'Instagram Reels', 'YouTube Shorts'],
    color: 'primary',
    recommended: true
  },
  {
    id: 'HORIZONTAL' as const,
    title: 'Horizontal',
    subtitle: 'Traditional Video Format',
    description: 'Standard horizontal video generation (16:9). Best for YouTube, presentations, and desktop viewing.',
    icon: Monitor,
    features: [
      'Classic 16:9 format',
      'Wide-angle compositions',
      'Desktop optimized',
      'Professional presentations'
    ],
    platforms: ['YouTube', 'Vimeo', 'Presentations'],
    color: 'secondary',
    recommended: false
  }
];

export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Mode Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {modes.map((mode) => {
          const isSelected = value === mode.id;
          const Icon = mode.icon;
          
          return (
            <motion.div
              key={mode.id}
              whileHover={!disabled ? { scale: 1.02 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              className={`
                relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200
                ${isSelected 
                  ? 'border-primary bg-primary/5 shadow-lg' 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onClick={() => !disabled && onChange(mode.id)}
            >
              {/* Recommended badge */}
              {mode.recommended && (
                <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Recommended
                </div>
              )}

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`
                    p-3 rounded-lg
                    ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}
                  `}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg">{mode.title}</h3>
                    <p className="text-sm text-muted-foreground">{mode.subtitle}</p>
                  </div>
                </div>

                {/* Selection indicator */}
                <div className={`
                  w-6 h-6 rounded-full border-2 flex items-center justify-center
                  ${isSelected 
                    ? 'border-primary bg-primary' 
                    : 'border-gray-300'
                  }
                `}>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2 h-2 rounded-full bg-white"
                    />
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4">
                {mode.description}
              </p>

              {/* Features */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-1" />
                    Key Features
                  </h4>
                  <ul className="space-y-1">
                    {mode.features.map((feature, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Platforms */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    Best For
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {mode.platforms.map((platform, index) => (
                      <span
                        key={index}
                        className={`
                          text-xs px-2 py-1 rounded-full
                          ${isSelected 
                            ? 'bg-primary/20 text-primary' 
                            : 'bg-secondary text-secondary-foreground'
                          }
                        `}
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {/* Vertical-First Benefits */}
        {value === 'VERTICAL_FIRST' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <h4 className="font-medium text-blue-900 mb-2">How Vertical-First Works</h4>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                Our AI creates a special sideways composition in 16:9 format that becomes 
                perfect when rotated to 9:16 vertical.
              </p>
              <div className="flex items-center space-x-2 text-xs">
                <Clock className="w-3 h-3" />
                <span>Generation: ~2-3 minutes</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Horizontal Benefits */}
        {value === 'HORIZONTAL' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-green-50 border border-green-200 rounded-lg"
          >
            <h4 className="font-medium text-green-900 mb-2">Horizontal Video Benefits</h4>
            <div className="text-sm text-green-800 space-y-2">
              <p>
                Traditional 16:9 format with wide compositions, perfect for landscapes, 
                multiple subjects, and professional content.
              </p>
              <div className="flex items-center space-x-2 text-xs">
                <Clock className="w-3 h-3" />
                <span>Generation: ~2-3 minutes</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pro Tip */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h4 className="font-medium text-amber-900 mb-2">💡 Pro Tip</h4>
          <p className="text-sm text-amber-800">
            {value === 'VERTICAL_FIRST' 
              ? 'Focus on single subjects and close-up actions for best vertical results. Avoid wide landscapes or multiple characters.'
              : 'Take advantage of the wide format for establishing shots, group scenes, and panoramic views.'
            }
          </p>
        </div>
      </div>

      {/* Technical Details */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium mb-2">Technical Specifications</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Generation Format:</span>
            <p className="font-medium">16:9 (1920×1080)</p>
          </div>
          <div>
            <span className="text-muted-foreground">Final Output:</span>
            <p className="font-medium">
              {value === 'VERTICAL_FIRST' ? '9:16 (1080×1920)' : '16:9 (1920×1080)'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Frame Rate:</span>
            <p className="font-medium">24/30 FPS</p>
          </div>
          <div>
            <span className="text-muted-foreground">Duration:</span>
            <p className="font-medium">3-10 seconds</p>
          </div>
        </div>
      </div>
    </div>
  );
}
