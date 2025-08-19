'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Monitor, TrendingUp } from 'lucide-react';

interface ModeSelectorProps {
  value: 'VERTICAL' | 'HORIZONTAL';
  onChange: (mode: 'VERTICAL' | 'HORIZONTAL') => void;
  disabled?: boolean;
}

const modes = [
  {
    id: 'VERTICAL' as const,
    title: 'Vertical',
    subtitle: '9:16 Aspect Ratio',
    description: 'Perfect for TikTok, Instagram Reels, and YouTube Shorts. AI optimizes composition for mobile viewing.',
    icon: Smartphone,
    platforms: ['TikTok', 'Instagram Reels', 'YouTube Shorts'],
    recommended: true
  },
  {
    id: 'HORIZONTAL' as const,
    title: 'Horizontal',
    subtitle: '16:9 Aspect Ratio',
    description: 'Standard format for YouTube, presentations, and desktop viewing. Traditional cinematic composition.',
    icon: Monitor,
    platforms: ['YouTube', 'Vimeo', 'Presentations'],
    recommended: false
  }
];

export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {modes.map((mode) => {
          const isSelected = value === mode.id;
          const Icon = mode.icon;
          
          return (
            <motion.button
              key={mode.id}
              type="button"
              whileHover={!disabled ? { scale: 1.02 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              onClick={() => !disabled && onChange(mode.id)}
              disabled={disabled}
              className={`
                relative p-6 rounded-xl border-2 text-left transition-all duration-200
                ${isSelected 
                  ? 'border-primary bg-primary/5 shadow-lg' 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
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
                    ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600'}
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

              {/* Platforms */}
              <div>
                <h4 className="text-sm font-medium mb-2">Best For:</h4>
                <div className="flex flex-wrap gap-1">
                  {mode.platforms.map((platform, index) => (
                    <span
                      key={index}
                      className={`
                        text-xs px-2 py-1 rounded-full
                        ${isSelected 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-gray-100 text-gray-600'
                        }
                      `}
                    >
                      {platform}
                    </span>
                  ))}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Mode-specific info */}
      <motion.div
        key={value}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
      >
        <h4 className="font-medium text-blue-900 mb-2">
          {value === 'VERTICAL' ? 'Vertical Mode Info' : 'Horizontal Mode Info'}
        </h4>
        <p className="text-sm text-blue-800">
          {value === 'VERTICAL' 
            ? 'Our AI creates a special sideways composition that becomes perfect when rotated to 9:16 vertical format.'
            : 'Traditional 16:9 format with wide compositions, perfect for landscapes and professional content.'
          }
        </p>
      </motion.div>
    </div>
  );
}
