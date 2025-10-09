"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '~/lib/utils';
import { useSectionTheme, getGlassClasses } from './theme-utils';
import { MOTION_VARIANTS } from './animation-utils';
import type { SectionId } from './types';

interface Option {
  value: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<any>;
}

interface EnhancedSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  label?: string;
  description?: string;
  placeholder?: string;
  sectionId?: SectionId;
  theme?: 'gold' | 'blue' | 'emerald' | 'purple' | 'red' | 'default';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  className?: string;
  icon?: React.ComponentType<any>;
}

export function EnhancedSelector({
  value,
  onChange,
  options,
  label,
  description,
  placeholder = 'Select an option...',
  sectionId,
  theme,
  size = 'md',
  disabled = false,
  required = false,
  searchable = false,
  className,
  icon: Icon
}: EnhancedSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { theme: resolvedTheme, colors, cssVars } = useSectionTheme(sectionId, theme);

  const sizeClasses = {
    sm: { trigger: 'text-sm px-3 py-2 h-10', option: 'px-3 py-2 text-sm' },
    md: { trigger: 'text-base px-4 py-3 h-12', option: 'px-4 py-3 text-base' },
    lg: { trigger: 'text-lg px-5 py-4 h-14', option: 'px-5 py-4 text-lg' }
  };

  const config = sizeClasses[size];
  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = searchable && searchQuery
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        option.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  // TODO: Implement full selector functionality
  // This is a placeholder implementation
  return (
    <div 
      className={cn('space-y-2 relative', className)}
      style={cssVars as React.CSSProperties}
    >
      {/* Label */}
      {(label || description) && (
        <div className="space-y-1">
          {label && (
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              {Icon && <Icon className="h-4 w-4" />}
              {label}
              {required && <span className="text-red-400">*</span>}
            </label>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      {/* Selector Trigger */}
      <div className="relative">
        <motion.button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          whileHover={{ scale: disabled ? 1 : 1.01 }}
          whileTap={{ scale: disabled ? 1 : 0.99 }}
          className={cn(
            'w-full flex items-center justify-between rounded-lg border transition-all duration-200',
            config.trigger,
            getGlassClasses('base', resolvedTheme, sectionId),
            disabled && 'opacity-50 cursor-not-allowed',
            isOpen && `border-[${colors.primary}] shadow-[0_0_0_3px_${colors.primary}20]`
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {selectedOption?.icon && (
              <selectedOption.icon className="h-4 w-4 flex-shrink-0" />
            )}
            <span className={cn(
              'truncate',
              selectedOption ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {selectedOption?.label || placeholder}
            </span>
          </div>
          
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </motion.button>

        {/* Dropdown Options */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              {...MOTION_VARIANTS.slideInFromLeft}
              className={cn(
                'absolute top-full left-0 right-0 z-50 mt-1 rounded-lg shadow-2xl',
                'max-h-60 overflow-y-auto',
                getGlassClasses('modal', resolvedTheme, sectionId)
              )}
            >
              {/* Search Input */}
              {searchable && (
                <div className="p-2 border-b border-[var(--primitive-border)]">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search options..."
                    className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--primitive-border)] rounded focus:outline-none focus:border-[var(--primitive-primary)]"
                  />
                </div>
              )}

              {/* Options List */}
              <div className="py-1">
                {filteredOptions.map((option, index) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'w-full flex items-center gap-2 transition-colors',
                      config.option,
                      'hover:bg-[var(--primitive-background)]/70',
                      option.value === value && 'bg-[var(--primitive-background)]'
                    )}
                  >
                    {option.icon && <option.icon className="h-4 w-4 flex-shrink-0" />}
                    
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-foreground truncate">
                        {option.label}
                      </div>
                      {option.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {option.description}
                        </div>
                      )}
                    </div>
                    
                    {option.value === value && (
                      <Check className="h-4 w-4 text-[var(--primitive-primary)] flex-shrink-0" />
                    )}
                  </motion.button>
                ))}
                
                {filteredOptions.length === 0 && (
                  <div className={cn(
                    'text-center text-muted-foreground py-8',
                    config.option
                  )}>
                    No options found
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Click overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}