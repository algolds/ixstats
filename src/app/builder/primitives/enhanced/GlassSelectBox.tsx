"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '~/lib/utils';
import { useSectionTheme, getGlassClasses } from './theme-utils';
import type { EnhancedInputProps } from './types';

interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<any>;
  disabled?: boolean;
}

interface GlassSelectBoxProps extends Omit<EnhancedInputProps, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  multiSelect?: boolean;
  icon?: React.ComponentType<any>;
  maxHeight?: number;
}

export function GlassSelectBox({
  value,
  onChange,
  options,
  label,
  description,
  sectionId,
  theme,
  size = 'md',
  disabled = false,
  required = false,
  placeholder = 'Select an option...',
  searchable = false,
  multiSelect = false,
  icon: Icon,
  maxHeight = 200,
  className
}: GlassSelectBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { theme: resolvedTheme, colors, cssVars } = useSectionTheme(sectionId, theme);

  const sizeClasses = {
    sm: 'text-sm px-3 py-2 h-10',
    md: 'text-base px-4 py-3 h-12',
    lg: 'text-lg px-5 py-4 h-14'
  };

  // Filter options based on search
  const filteredOptions = searchable 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        option.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Get selected option
  const selectedOption = options.find(option => option.value === value);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0) {
          const option = filteredOptions[highlightedIndex];
          if (option && !option.disabled) {
            onChange(option.value);
            setIsOpen(false);
            setSearchQuery('');
            setHighlightedIndex(-1);
          }
        } else {
          setIsOpen(!isOpen);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
        }
        break;
    }
  };

  const handleOptionClick = (option: SelectOption) => {
    if (option.disabled) return;
    
    onChange(option.value);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  return (
    <div 
      ref={containerRef}
      className={cn('relative space-y-2', className)}
      style={cssVars as React.CSSProperties}
    >
      {/* Label and Description */}
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

      {/* Select Button */}
      <motion.button
        type="button"
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        whileHover={{ scale: disabled ? 1 : 1.01 }}
        whileTap={{ scale: disabled ? 1 : 0.99 }}
        className={cn(
          'relative w-full flex items-center justify-between text-left',
          getGlassClasses('elevated', resolvedTheme, sectionId),
          'bg-white/80 dark:bg-gray-800/90 border-2',
          'border-gray-200/50 dark:border-gray-600/50',
          'hover:border-gray-300/70 dark:hover:border-gray-500/70',
          'focus:border-[var(--primitive-primary)] focus:shadow-lg',
          'focus:shadow-[var(--primitive-primary)]/20',
          sizeClasses[size],
          isOpen && 'border-[var(--primitive-primary)] shadow-lg shadow-[var(--primitive-primary)]/20',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* Background Gradient */}
        <motion.div
          className="absolute inset-0 rounded-lg opacity-0 transition-opacity"
          style={{
            background: `linear-gradient(135deg, ${colors.background}, transparent)`
          }}
          animate={{ opacity: isOpen ? 1 : 0 }}
        />

        <div className="relative flex items-center gap-3 flex-1 min-w-0">
          {selectedOption?.icon && (
            <selectedOption.icon className="h-4 w-4 text-[var(--primitive-primary)] flex-shrink-0" />
          )}
          
          <div className="flex-1 min-w-0">
            {selectedOption ? (
              <div>
                <span className="text-foreground font-medium">
                  {selectedOption.label}
                </span>
                {selectedOption.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedOption.description}
                  </p>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-2 flex-shrink-0"
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              'absolute top-full left-0 right-0 z-50 mt-1',
              getGlassClasses('modal', resolvedTheme, sectionId),
              'bg-white/95 dark:bg-gray-800/95',
              'border border-gray-200/50 dark:border-gray-600/50',
              'shadow-xl rounded-lg overflow-hidden'
            )}
            style={{ maxHeight }}
          >
            {/* Search Input */}
            {searchable && (
              <div className="p-3 border-b border-gray-200/50 dark:border-gray-600/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search options..."
                    className="w-full pl-10 pr-3 py-2 bg-transparent border border-gray-200/50 dark:border-gray-600/50 rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--primitive-primary)] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    onClick={() => handleOptionClick(option)}
                    disabled={option.disabled}
                    whileHover={{ backgroundColor: `${colors.primary}10` }}
                    className={cn(
                      'w-full px-4 py-3 text-left flex items-center gap-3 transition-colors',
                      'hover:bg-[var(--primitive-primary)]/10',
                      index === highlightedIndex && 'bg-[var(--primitive-primary)]/10',
                      option.disabled && 'opacity-50 cursor-not-allowed',
                      option.value === value && 'bg-[var(--primitive-primary)]/20'
                    )}
                  >
                    {option.icon && (
                      <option.icon className="h-4 w-4 text-[var(--primitive-primary)] flex-shrink-0" />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">
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
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}