"use client";

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { GlassCard, GlassCardContent } from './GlassCard';
import { NumberFlowDisplay } from '~/components/ui/number-flow';

// Base interface for all glass inputs
interface BaseGlassInputProps {
  className?: string;
  theme?: 'gold' | 'blue' | 'indigo' | 'red' | 'neutral';
  disabled?: boolean;
  error?: string;
  help?: string;
  label?: string;
  required?: boolean;
}

// Glass Slider Component
interface GlassSliderProps extends BaseGlassInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  showValue?: boolean;
  referenceValue?: number;
  referenceLabel?: string;
}

export function GlassSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  showValue = true,
  referenceValue,
  referenceLabel,
  label,
  help,
  error,
  theme = 'neutral',
  disabled = false,
  className
}: GlassSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  const percentage = ((value - min) / (max - min)) * 100;
  const referencePercentage = referenceValue ? ((referenceValue - min) / (max - min)) * 100 : undefined;

  const themeStyles = {
    gold: 'border-amber-400/30 bg-gradient-to-r from-amber-400/20 to-amber-600/20',
    blue: 'border-blue-400/30 bg-gradient-to-r from-blue-400/20 to-blue-600/20',
    indigo: 'border-indigo-400/30 bg-gradient-to-r from-indigo-400/20 to-indigo-600/20',
    red: 'border-red-400/30 bg-gradient-to-r from-red-400/20 to-red-600/20',
    neutral: 'border-slate-400/30 bg-gradient-to-r from-slate-400/20 to-slate-600/20'
  };

  const trackColors = {
    gold: 'bg-gradient-to-r from-amber-400 to-amber-600',
    blue: 'bg-gradient-to-r from-blue-400 to-blue-600',
    indigo: 'bg-gradient-to-r from-indigo-400 to-indigo-600',
    red: 'bg-gradient-to-r from-red-400 to-red-600',
    neutral: 'bg-gradient-to-r from-slate-400 to-slate-600'
  };


  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            {label}
            {help && (
              <div className="group relative">
                <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-popover-foreground bg-popover/90 border border-border rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {help}
                </div>
              </div>
            )}
          </label>
          {showValue && (
            <NumberFlowDisplay
              value={value}
              format={Math.abs(value) >= 1000000 ? 'population' : 'default'}
              suffix={Math.abs(value) < 1000000 ? unit : ''}
              className="text-sm font-semibold text-foreground"
              duration={600}
              decimalPlaces={step < 1 ? 1 : 0}
            />
          )}
        </div>
      )}
      
      <div className="relative">
        {/* Slider Track */}
        <div className="relative h-8 md:h-6 bg-white/10 rounded-full backdrop-blur-sm border border-white/20 overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-white/10" />
          
          {/* Reference marker */}
          {referencePercentage !== undefined && (
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-white/60 z-10"
              style={{ left: `${referencePercentage}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap">
                {referenceLabel && (
                  <span>
                    {referenceLabel}: <NumberFlowDisplay
                      value={referenceValue!}
                      format={Math.abs(referenceValue!) >= 1000000 ? 'population' : 'default'}
                      suffix={Math.abs(referenceValue!) < 1000000 ? unit : ''}
                      className="inline"
                      duration={400}
                      decimalPlaces={step < 1 ? 1 : 0}
                    />
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Progress fill */}
          <motion.div
            className={cn("absolute inset-y-0 left-0 rounded-full", trackColors[theme])}
            style={{ width: `${percentage}%` }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
          
          {/* Slider thumb */}
          <motion.div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-6 h-6 md:w-5 md:h-5 rounded-full border-2 border-white shadow-lg cursor-pointer",
              "bg-gradient-to-br from-white to-white/90 touch-manipulation",
              isDragging ? "scale-110" : "scale-100",
              disabled ? "cursor-not-allowed opacity-60" : "hover:scale-105"
            )}
            style={{ left: `calc(${percentage}% - 12px)` }}
            animate={{ 
              left: `calc(${percentage}% - 12px)`,
              scale: isDragging ? 1.1 : 1
            }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            whileHover={{ scale: disabled ? 1 : 1.05 }}
            whileTap={{ scale: disabled ? 1 : 1.1 }}
          />
          
          {/* Input overlay */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed touch-manipulation"
          />
        </div>
        
        {/* Min/Max labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <NumberFlowDisplay
            value={min}
            format={Math.abs(min) >= 1000000 ? 'population' : 'default'}
            suffix={Math.abs(min) < 1000000 ? unit : ''}
            className="text-xs text-muted-foreground"
            duration={400}
            decimalPlaces={step < 1 ? 1 : 0}
          />
          <NumberFlowDisplay
            value={max}
            format={Math.abs(max) >= 1000000 ? 'population' : 'default'}
            suffix={Math.abs(max) < 1000000 ? unit : ''}
            className="text-xs text-muted-foreground"
            duration={400}
            decimalPlaces={step < 1 ? 1 : 0}
          />
        </div>
      </div>
      
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <span className="w-1 h-1 bg-destructive rounded-full" />
          {error}
        </p>
      )}
    </div>
  );
}

// Glass Number Input Component
interface GlassNumberInputProps extends BaseGlassInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  precision?: number;
}

export function GlassNumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  placeholder,
  precision = 2,
  label,
  help,
  error,
  theme = 'neutral',
  disabled = false,
  className
}: GlassNumberInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value.toString());

  const themeStyles = {
    gold: 'border-amber-400/30 focus:border-amber-400/60',
    blue: 'border-blue-400/30 focus:border-blue-400/60',
    indigo: 'border-indigo-400/30 focus:border-indigo-400/60',
    red: 'border-red-400/30 focus:border-red-400/60',
    neutral: 'border-slate-400/30 focus:border-slate-400/60'
  };

  const handleValueChange = (newValue: string) => {
    setLocalValue(newValue);
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      const clampedValue = Math.min(Math.max(numValue, min || -Infinity), max || Infinity);
      onChange(clampedValue);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    setLocalValue(value.toFixed(precision));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          {label}
          {help && (
            <div className="group relative">
              <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-popover-foreground bg-popover/90 border border-border rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {help}
              </div>
            </div>
          )}
        </label>
      )}
      
      <div className="relative">
        <input
          type="number"
          value={isFocused ? localValue : value.toFixed(precision)}
          onChange={(e) => handleValueChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full px-3 py-3 md:py-2 bg-card/50 backdrop-blur-sm border rounded-lg",
            "text-foreground placeholder-muted-foreground transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-ring/20 touch-manipulation",
            "text-base md:text-sm", // Prevent zoom on mobile
            themeStyles[theme],
            disabled && "opacity-60 cursor-not-allowed",
            error ? "border-red-400/60 focus:border-red-400/80" : "",
            unit ? "pr-12" : ""
          )}
        />
        
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <span className="w-1 h-1 bg-destructive rounded-full" />
          {error}
        </p>
      )}
    </div>
  );
}

// Glass Toggle Switch Component
interface GlassToggleProps extends BaseGlassInputProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function GlassToggle({
  checked,
  onChange,
  size = 'md',
  label,
  help,
  theme = 'neutral',
  disabled = false,
  className
}: GlassToggleProps) {
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
    md: { track: 'w-10 h-5', thumb: 'w-4 h-4', translate: 'translate-x-5' },
    lg: { track: 'w-12 h-6', thumb: 'w-5 h-5', translate: 'translate-x-6' }
  };

  const themeStyles = {
    gold: checked ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-white/20',
    blue: checked ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 'bg-white/20',
    indigo: checked ? 'bg-gradient-to-r from-indigo-400 to-indigo-600' : 'bg-white/20',
    red: checked ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-white/20',
    neutral: checked ? 'bg-gradient-to-r from-slate-400 to-slate-600' : 'bg-white/20'
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={cn(
          "relative inline-flex items-center rounded-full border border-white/30 transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-white/20",
          sizes[size].track,
          themeStyles[theme],
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:scale-105"
        )}
      >
        <motion.span
          className={cn(
            "inline-block rounded-full bg-white shadow-sm transition-transform",
            sizes[size].thumb
          )}
          animate={{
            x: checked ? sizes[size].translate.replace('translate-x-', '') + 'px' : '2px'
          }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        />
      </button>
      
      {label && (
        <label className="text-sm font-medium text-foreground flex items-center gap-2 cursor-pointer"
               onClick={() => !disabled && onChange(!checked)}>
          {label}
          {help && (
            <div className="group relative">
              <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-popover-foreground bg-popover/90 border border-border rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {help}
              </div>
            </div>
          )}
        </label>
      )}
    </div>
  );
}

// Glass Progress Ring Component (for health metrics)
interface GlassProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  theme?: 'gold' | 'blue' | 'indigo' | 'red' | 'neutral';
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function GlassProgressRing({
  value,
  max = 100,
  size = 80,
  strokeWidth = 6,
  theme = 'neutral',
  label,
  showValue = true,
  className
}: GlassProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(Math.max(value, 0), max);
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / max) * circumference;

  const themeColors = {
    gold: 'stroke-amber-400',
    blue: 'stroke-blue-400',
    indigo: 'stroke-indigo-400',
    red: 'stroke-red-400',
    neutral: 'stroke-slate-400'
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted"
        />
        
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className={themeColors[theme]}
          strokeDasharray={strokeDasharray}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showValue && (
          <NumberFlowDisplay
            value={(progress / max) * 100}
            format="percentage"
            className="text-sm font-bold text-foreground"
            duration={800}
            decimalPlaces={0}
          />
        )}
        {label && (
          <span className="text-xs text-muted-foreground text-center">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// Glass Metric Card Component
interface GlassMetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  theme?: 'gold' | 'blue' | 'indigo' | 'red' | 'neutral';
  icon?: React.ElementType;
  className?: string;
}

export function GlassMetricCard({
  title,
  value,
  unit = '',
  change,
  trend = 'neutral',
  theme = 'neutral',
  icon: Icon,
  className
}: GlassMetricCardProps) {
  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-muted-foreground'
  };

  const trendIcons = {
    up: ChevronUp,
    down: ChevronDown,
    neutral: () => null
  };

  const TrendIcon = trendIcons[trend];

  return (
    <GlassCard depth="elevated" blur="medium" theme={theme} className={className}>
      <GlassCardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
              {typeof value === 'number' ? (
                <NumberFlowDisplay
                  value={value}
                  format={
                    unit === '%' ? 'percentage' :
                    unit === ' years' ? 'default' :
                    value >= 1000000 ? 'population' : 'default'
                  }
                  suffix={unit && unit !== '%' ? unit : ''}
                  className="text-2xl font-bold text-foreground"
                  duration={800}
                  decimalPlaces={unit === '%' || unit === ' years' ? 1 : 0}
                />
              ) : (
                <span className="text-2xl font-bold text-foreground">{value}</span>
              )}
            </div>
            {change !== undefined && (
              <div className={cn("flex items-center gap-1 mt-1", trendColors[trend])}>
                <TrendIcon className="h-3 w-3" />
                <NumberFlowDisplay
                  value={Math.abs(change)}
                  format="percentage"
                  className="text-xs"
                  duration={600}
                  decimalPlaces={1}
                />
              </div>
            )}
          </div>
          {Icon && (
            <Icon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}