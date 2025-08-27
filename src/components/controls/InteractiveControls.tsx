"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { cn } from '~/lib/utils';
import { Minus, Plus, RotateCcw, Zap } from 'lucide-react';

interface NumberPickerProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  label?: string;
  unit?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'default' | 'gold' | 'blue' | 'emerald' | 'purple';
}

interface DialProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  unit?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'default' | 'gold' | 'blue' | 'emerald' | 'purple';
  showValue?: boolean;
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'default' | 'gold' | 'blue' | 'emerald' | 'purple';
}

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  unit?: string;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  theme?: 'default' | 'gold' | 'blue' | 'emerald' | 'purple';
  showTicks?: boolean;
  tickCount?: number;
}

// Glass Number Picker
export function GlassNumberPicker({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  precision = 0,
  label,
  unit,
  className,
  size = 'md',
  theme = 'default'
}: NumberPickerProps) {
  const [displayValue, setDisplayValue] = useState(value.toFixed(precision));
  const [isEditing, setIsEditing] = useState(false);

  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-3 py-2',
    lg: 'text-lg px-4 py-3'
  };

  const themeClasses = {
    default: 'border-[var(--color-border-primary)] focus-within:border-[var(--color-brand-primary)]',
    gold: 'border-amber-400/50 focus-within:border-amber-400',
    blue: 'border-blue-400/50 focus-within:border-blue-400',
    emerald: 'border-emerald-400/50 focus-within:border-emerald-400',
    purple: 'border-purple-400/50 focus-within:border-purple-400'
  };

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
    setDisplayValue(newValue.toFixed(precision));
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
    setDisplayValue(newValue.toFixed(precision));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
  };

  const handleInputBlur = () => {
    const numValue = parseFloat(displayValue);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(min, Math.min(max, numValue));
      onChange(clampedValue);
      setDisplayValue(clampedValue.toFixed(precision));
    } else {
      setDisplayValue(value.toFixed(precision));
    }
    setIsEditing(false);
  };

  const handleInputFocus = () => {
    setIsEditing(true);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
          {label}
        </label>
      )}
      <div className={cn(
        'flex items-center rounded-lg border backdrop-blur-sm',
        'bg-[var(--color-bg-secondary)]/50',
        themeClasses[theme],
        'transition-all duration-200'
      )}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleDecrement}
          disabled={value <= min}
          className={cn(
            'flex items-center justify-center w-8 h-8 text-[var(--color-text-secondary)]',
            'hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-200'
          )}
        >
          <Minus className="h-4 w-4" />
        </motion.button>

        <div className="flex-1 flex items-center justify-center px-2">
          <input
            type="text"
            value={displayValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleInputBlur();
              }
            }}
            className={cn(
              'w-full text-center bg-transparent text-[var(--color-text-primary)]',
              'focus:outline-none',
              sizeClasses[size]
            )}
          />
          {unit && (
            <span className="text-xs text-[var(--color-text-muted)] ml-1">
              {unit}
            </span>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleIncrement}
          disabled={value >= max}
          className={cn(
            'flex items-center justify-center w-8 h-8 text-[var(--color-text-secondary)]',
            'hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-200'
          )}
        >
          <Plus className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}

// Glass Dial Control
export function GlassDial({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit,
  className,
  size = 'md',
  theme = 'default',
  showValue = true
}: DialProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const angle = useMotionValue(0);
  
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  const themeColors = {
    default: 'hsl(var(--color-brand-primary-hsl))',
    gold: 'hsl(var(--color-warning-hsl))',
    blue: 'hsl(var(--color-brand-secondary-hsl))',
    emerald: 'hsl(var(--color-success-hsl))',
    purple: 'hsl(var(--color-purple-hsl))'
  };

  // Convert value to angle (0-270 degrees for 3/4 circle)
  const valueToAngle = (val: number) => {
    const normalizedValue = (val - min) / (max - min);
    return normalizedValue * 270 - 135; // -135 to 135 degrees
  };

  // Convert angle to value
  const angleToValue = (ang: number) => {
    const normalizedAngle = (ang + 135) / 270; // Normalize to 0-1
    const val = min + normalizedAngle * (max - min);
    return Math.max(min, Math.min(max, Math.round(val / step) * step));
  };

  const currentAngle = valueToAngle(value);

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!constraintsRef.current) return;
    
    const rect = constraintsRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const clientX = 'clientX' in event ? event.clientX : ('touches' in event ? event.touches[0]?.clientX : 0);
    const clientY = 'clientY' in event ? event.clientY : ('touches' in event ? event.touches[0]?.clientY : 0);
    
    const deltaX = (clientX || 0) - centerX;
    const deltaY = (clientY || 0) - centerY;
    
    let newAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    
    // Constrain to 3/4 circle (-135 to 135 degrees)
    newAngle = Math.max(-135, Math.min(135, newAngle));
    
    const newValue = angleToValue(newAngle);
    onChange(newValue);
  };

  return (
    <div className={cn('space-y-2 text-center', className)}>
      {label && (
        <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
          {label}
        </label>
      )}
      
      <div className="flex justify-center">
        <div
          ref={constraintsRef}
          className={cn(
            'relative rounded-full border-2 border-[var(--color-border-primary)]',
            'bg-[var(--color-bg-secondary)]/30 backdrop-blur-sm',
            sizeClasses[size]
          )}
        >
          {/* Background arc */}
          <svg className="absolute inset-0 w-full h-full -rotate-45">
            <circle
              cx="50%"
              cy="50%"
              r="40%"
              fill="none"
              stroke="hsl(var(--color-border-primary-hsl))"
              strokeWidth="3"
              strokeDasharray="25 10"
              opacity="0.3"
            />
          </svg>
          
          {/* Value arc */}
          <svg className="absolute inset-0 w-full h-full -rotate-45">
            <circle
              cx="50%"
              cy="50%"
              r="40%"
              fill="none"
              stroke={themeColors[theme]}
              strokeWidth="3"
              strokeDasharray={`${(value - min) / (max - min) * 75} 100`}
              strokeLinecap="round"
            />
          </svg>
          
          {/* Draggable handle */}
          <motion.div
            drag
            dragConstraints={constraintsRef}
            dragElastic={0}
            onDrag={handleDrag}
            animate={{ rotate: currentAngle }}
            className="absolute top-1/2 left-1/2 w-4 h-4 -mt-2 -ml-2 cursor-grab active:cursor-grabbing"
            whileHover={{ scale: 1.1 }}
            whileDrag={{ scale: 1.2 }}
          >
            <div
              className="w-full h-full rounded-full border-2 border-white shadow-lg"
              style={{ backgroundColor: themeColors[theme] }}
            />
          </motion.div>
          
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 w-2 h-2 -mt-1 -ml-1 rounded-full bg-[var(--color-border-primary)]" />
        </div>
      </div>
      
      {showValue && (
        <div className="text-center">
          <span className="text-lg font-semibold text-[var(--color-text-primary)]">
            {value}
          </span>
          {unit && (
            <span className="text-sm text-[var(--color-text-muted)] ml-1">
              {unit}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Glass Toggle Switch
export function GlassToggle({
  checked,
  onChange,
  label,
  description,
  className,
  size = 'md',
  theme = 'default'
}: ToggleProps) {
  const sizeClasses = {
    sm: { switch: 'w-10 h-6', thumb: 'w-4 h-4', translate: 'translate-x-4' },
    md: { switch: 'w-12 h-7', thumb: 'w-5 h-5', translate: 'translate-x-5' },
    lg: { switch: 'w-14 h-8', thumb: 'w-6 h-6', translate: 'translate-x-6' }
  };

  const themeColors = {
    default: checked ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-bg-tertiary)]',
    gold: checked ? 'bg-amber-500' : 'bg-[var(--color-bg-tertiary)]',
    blue: checked ? 'bg-blue-500' : 'bg-[var(--color-bg-tertiary)]',
    emerald: checked ? 'bg-emerald-500' : 'bg-[var(--color-bg-tertiary)]',
    purple: checked ? 'bg-purple-500' : 'bg-[var(--color-bg-tertiary)]'
  };

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex-1">
        {label && (
          <label className="block text-sm font-medium text-[var(--color-text-primary)]">
            {label}
          </label>
        )}
        {description && (
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {description}
          </p>
        )}
      </div>
      
      <motion.button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex items-center rounded-full border border-[var(--color-border-primary)]',
          'backdrop-blur-sm transition-colors duration-200 focus:outline-none',
          sizeClasses[size].switch,
          themeColors[theme]
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          className={cn(
            'inline-block rounded-full bg-white shadow transform transition-transform duration-200',
            sizeClasses[size].thumb,
            checked ? sizeClasses[size].translate : 'translate-x-1'
          )}
          layout
        />
      </motion.button>
    </div>
  );
}

// Glass Slider
export function GlassSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit,
  className,
  orientation = 'horizontal',
  theme = 'default',
  showTicks = false,
  tickCount = 5
}: SliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  
  const themeColors = {
    default: 'hsl(var(--color-brand-primary-hsl))',
    gold: 'hsl(var(--color-warning-hsl))',
    blue: 'hsl(var(--color-brand-secondary-hsl))',
    emerald: 'hsl(var(--color-success-hsl))',
    purple: 'hsl(var(--color-purple-hsl))'
  };

  const percentage = ((value - min) / (max - min)) * 100;

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent) => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    let clientPos, trackSize;
    
    if (orientation === 'horizontal') {
      clientPos = 'clientX' in event ? event.clientX : ('touches' in event ? event.touches[0]?.clientX : 0);
      trackSize = rect.width;
      clientPos = (clientPos || 0) - rect.left;
    } else {
      clientPos = 'clientY' in event ? event.clientY : ('touches' in event ? event.touches[0]?.clientY : 0);
      trackSize = rect.height;
      clientPos = rect.bottom - (clientPos || 0); // Invert for vertical
    }
    
    const percentage = Math.max(0, Math.min(100, ((clientPos || 0) / trackSize) * 100));
    const newValue = min + (percentage / 100) * (max - min);
    const steppedValue = Math.round(newValue / step) * step;
    
    onChange(Math.max(min, Math.min(max, steppedValue)));
  };

  const ticks = useMemo(() => {
    if (!showTicks) return [];
    return Array.from({ length: tickCount }, (_, i) => {
      const tickValue = min + (i / (tickCount - 1)) * (max - min);
      const tickPercentage = ((tickValue - min) / (max - min)) * 100;
      return { value: tickValue, percentage: tickPercentage };
    });
  }, [showTicks, tickCount, min, max]);

  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            {label}
          </label>
          <span className="text-sm text-[var(--color-text-primary)]">
            {value}{unit}
          </span>
        </div>
      )}
      
      <div className="relative">
        <div
          ref={sliderRef}
          className={cn(
            'relative rounded-full bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm',
            'border border-[var(--color-border-primary)] cursor-pointer',
            orientation === 'horizontal' ? 'h-2 w-full' : 'w-2 h-32 mx-auto'
          )}
          onMouseDown={(e) => {
            setIsDragging(true);
            handleDrag(e.nativeEvent);
          }}
        >
          {/* Progress track */}
          <div
            className="absolute rounded-full transition-all duration-200"
            style={{
              backgroundColor: themeColors[theme],
              ...(orientation === 'horizontal' ? {
                top: 0,
                left: 0,
                height: '100%',
                width: `${percentage}%`
              } : {
                bottom: 0,
                left: 0,
                width: '100%',
                height: `${percentage}%`
              })
            }}
          />
          
          {/* Thumb */}
          <motion.div
            className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-grab active:cursor-grabbing"
            style={{
              backgroundColor: themeColors[theme],
              ...(orientation === 'horizontal' ? {
                top: '50%',
                left: `${percentage}%`,
                transform: 'translate(-50%, -50%)'
              } : {
                left: '50%',
                bottom: `${percentage}%`,
                transform: 'translate(-50%, 50%)'
              })
            }}
            whileHover={{ scale: 1.1 }}
            whileDrag={{ scale: 1.2 }}
            drag={orientation === 'horizontal' ? 'x' : 'y'}
            dragConstraints={sliderRef}
            dragElastic={0}
            onDrag={handleDrag}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
          />
          
          {/* Ticks */}
          {ticks.map((tick, index) => (
            <div
              key={index}
              className="absolute w-1 h-1 bg-[var(--color-text-muted)] rounded-full"
              style={{
                ...(orientation === 'horizontal' ? {
                  top: '50%',
                  left: `${tick.percentage}%`,
                  transform: 'translate(-50%, -50%)'
                } : {
                  left: '50%',
                  bottom: `${tick.percentage}%`,
                  transform: 'translate(-50%, 50%)'
                })
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}