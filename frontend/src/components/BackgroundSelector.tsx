'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Palette, Square, Zap, Sparkles } from 'lucide-react';

interface BackgroundSelectorProps {
  value: 'SOLID_COLOR' | 'GREENSCREEN' | 'MINIMAL_GRADIENT' | 'CUSTOM';
  onChange: (background: 'SOLID_COLOR' | 'GREENSCREEN' | 'MINIMAL_GRADIENT' | 'CUSTOM') => void;
  disabled?: boolean;
}

const backgroundOptions = [
  {
    value: 'MINIMAL_GRADIENT' as const,
    label: 'Minimal Gradient',
    description: 'Subtle gradient that enhances the subject',
    icon: Sparkles,
    preview: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
    recommended: true
  },
  {
    value: 'SOLID_COLOR' as const,
    label: 'Solid Color',
    description: 'Clean solid background color',
    icon: Square,
    preview: '#f8f9fa',
    recommended: false
  },
  {
    value: 'GREENSCREEN' as const,
    label: 'Green Screen',
    description: 'For easy background replacement',
    icon: Zap,
    preview: '#00ff00',
    recommended: false
  },
  {
    value: 'CUSTOM' as const,
    label: 'Custom',
    description: 'Background described in your prompt',
    icon: Palette,
    preview: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
    recommended: false
  }
];

export function BackgroundSelector({ value, onChange, disabled }: BackgroundSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {backgroundOptions.map((option) => {
          const isSelected = value === option.value;
          const Icon = option.icon;
          
          return (
            <motion.button
              key={option.value}
              type="button"
              whileHover={!disabled ? { scale: 1.02 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              onClick={() => !disabled && onChange(option.value)}
              disabled={disabled}
              className={`
                relative p-4 rounded-lg border text-left transition-all
                ${isSelected 
                  ? 'border-primary bg-primary/5 shadow-md' 
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Recommended badge */}
              {option.recommended && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full"></div>
              )}

              {/* Preview */}
              <div className="flex items-center space-x-3 mb-3">
                <div
                  className="w-8 h-8 rounded border shadow-sm"
                  style={{ background: option.preview }}
                />
                <Icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-gray-500'}`} />
              </div>

              {/* Content */}
              <div>
                <h3 className={`font-medium text-sm ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                  {option.label}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {option.description}
                </p>
              </div>

              {/* Selection indicator */}
              <div className={`
                absolute bottom-2 right-2 w-4 h-4 rounded-full border-2
                ${isSelected ? 'border-primary bg-primary' : 'border-gray-300'}
              `}>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-1.5 h-1.5 rounded-full bg-white absolute top-0.5 left-0.5"
                  />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Selected option details */}
      <motion.div
        key={value}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-3 bg-gray-50 rounded-lg"
      >
        <div className="flex items-center space-x-2">
          {(() => {
            const selected = backgroundOptions.find(opt => opt.value === value);
            const Icon = selected?.icon || Palette;
            return (
              <>
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{selected?.label}</span>
                <span className="text-xs text-muted-foreground">- {selected?.description}</span>
              </>
            );
          })()}
        </div>
        
        {/* Usage tips */}
        <div className="mt-2 text-xs text-muted-foreground">
          {value === 'MINIMAL_GRADIENT' && (
            <p><strong>Tip:</strong> Works great for most content types, provides subtle depth without distraction</p>
          )}
          {value === 'SOLID_COLOR' && (
            <p><strong>Tip:</strong> Best for product demos, tutorials, or when you want maximum focus on the subject</p>
          )}
          {value === 'GREENSCREEN' && (
            <p><strong>Tip:</strong> Perfect if you plan to replace the background in post-production</p>
          )}
          {value === 'CUSTOM' && (
            <p><strong>Tip:</strong> Describe the background you want in your prompt (e.g., "in a cozy cafe", "on a beach at sunset")</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
