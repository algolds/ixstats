"use client";

import React, { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { cn } from '~/lib/utils';
import { useSectionTheme, getGlassClasses } from './theme-utils';
import { useAnimatedPercentage, DEFAULT_ANIMATIONS } from './animation-utils';
import type { EnhancedInputProps } from './types';

interface EnhancedDialProps extends EnhancedInputProps {
  showValue?: boolean;
  dialSize?: number;
  showTicks?: boolean;
  startAngle?: number;
  endAngle?: number;
  icon?: React.ComponentType<any>;
}

export function EnhancedDial({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  precision = 1,
  label,
  description,
  unit = '%',
  sectionId,
  theme,
  size = 'md',
  disabled = false,
  required = false,
  referenceValue,
  referenceLabel,
  showComparison = false,
  animationDuration = 800,
  className,
  showValue = true,
  dialSize,
  showTicks = true,
  startAngle = -135,
  endAngle = 135,
  icon: Icon
}: EnhancedDialProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);
  
  const { theme: resolvedTheme, colors, cssVars } = useSectionTheme(sectionId, theme);
  
  // Size configurations
  const sizeConfigs = {
    sm: { dial: dialSize || 100, stroke: 8, thumb: 16 },
    md: { dial: dialSize || 140, stroke: 10, thumb: 20 },
    lg: { dial: dialSize || 180, stroke: 12, thumb: 24 }
  };
  
  const config = sizeConfigs[size];
  const radius = (config.dial - config.stroke) / 2;
  const center = config.dial / 2;
  
  // Calculate angles and positions
  const angleRange = endAngle - startAngle;
  const valuePercentage = ((value - min) / (max - min));
  const currentAngle = startAngle + (valuePercentage * angleRange);
  
  // Animated value for smooth transitions
  const animatedValue = useAnimatedPercentage(
    value,
    precision,
    { ...DEFAULT_ANIMATIONS.numberFlow, duration: animationDuration }
  );

  // Convert angle to radians for positioning
  const angleToRadians = (angle: number) => (angle * Math.PI) / 180;
  
  // Calculate thumb position
  const thumbX = center + Math.cos(angleToRadians(currentAngle - 90)) * radius;
  const thumbY = center + Math.sin(angleToRadians(currentAngle - 90)) * radius;

  // Handle drag events
  const handlePanStart = () => {
    setIsDragging(true);
  };

  const handlePan = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!dialRef.current || disabled) return;

    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const clientX = (event as MouseEvent).clientX;
    const clientY = (event as MouseEvent).clientY;
    
    // Calculate angle from center to mouse position
    let angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90;
    
    // Normalize angle to our range
    if (angle < startAngle) angle += 360;
    if (angle > endAngle + 360) angle -= 360;
    
    // Clamp angle to our defined range
    angle = Math.max(startAngle, Math.min(endAngle, angle));
    
    // Convert angle back to value
    const anglePercentage = (angle - startAngle) / angleRange;
    const rawValue = min + anglePercentage * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    const clampedValue = Math.max(min, Math.min(max, steppedValue));
    
    onChange(clampedValue);
  }, [min, max, step, onChange, startAngle, endAngle, angleRange, disabled]);

  const handlePanEnd = () => {
    setIsDragging(false);
  };

  // Generate tick marks
  const generateTicks = () => {
    if (!showTicks) return [];
    
    const tickCount = 9; // Including start and end
    return Array.from({ length: tickCount }, (_, i) => {
      const tickPercentage = i / (tickCount - 1);
      const tickAngle = startAngle + tickPercentage * angleRange;
      const tickValue = min + tickPercentage * (max - min);
      
      const tickRadius = radius - config.stroke / 4;
      const tickX = center + Math.cos(angleToRadians(tickAngle - 90)) * tickRadius;
      const tickY = center + Math.sin(angleToRadians(tickAngle - 90)) * tickRadius;
      
      return {
        x: tickX,
        y: tickY,
        angle: tickAngle,
        value: tickValue,
        isActive: Math.abs(value - tickValue) <= step * 2
      };
    });
  };

  const ticks = generateTicks();
  
  // SVG path for the arc
  const createArcPath = (startAngle: number, endAngle: number, r: number) => {
    const start = angleToRadians(startAngle - 90);
    const end = angleToRadians(endAngle - 90);
    
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    const x1 = center + Math.cos(start) * r;
    const y1 = center + Math.sin(start) * r;
    const x2 = center + Math.cos(end) * r;
    const y2 = center + Math.sin(end) * r;
    
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
  };

  const backgroundPath = createArcPath(startAngle, endAngle, radius);
  const progressPath = createArcPath(startAngle, currentAngle, radius);

  // Reference value indicator
  const referenceAngle = referenceValue !== undefined ? 
    startAngle + (((referenceValue - min) / (max - min)) * angleRange) : null;
  
  const referenceX = referenceAngle !== null ? 
    center + Math.cos(angleToRadians(referenceAngle - 90)) * radius : 0;
  const referenceY = referenceAngle !== null ? 
    center + Math.sin(angleToRadians(referenceAngle - 90)) * radius : 0;

  return (
    <div 
      className={cn('space-y-4', className)}
      style={cssVars as React.CSSProperties}
    >
      {/* Label */}
      {(label || description) && (
        <div className="space-y-1 text-center">
          {label && (
            <label className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
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

      {/* Dial Container */}
      <div className="flex justify-center">
        <div 
          ref={dialRef}
          className={cn(
            'relative select-none',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          style={{ width: config.dial, height: config.dial }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Background Glass Effect */}
          <div className={cn(
            'absolute inset-0 rounded-full transition-all duration-200',
            getGlassClasses('base', resolvedTheme, sectionId),
            isHovered && 'shadow-lg'
          )} />

          {/* SVG Dial */}
          <svg
            width={config.dial}
            height={config.dial}
            className="absolute inset-0"
          >
            {/* Background Arc */}
            <path
              d={backgroundPath}
              stroke={colors.border}
              strokeWidth={config.stroke}
              fill="none"
              strokeLinecap="round"
              opacity={0.3}
            />
            
            {/* Progress Arc */}
            <motion.path
              d={progressPath}
              stroke={colors.primary}
              strokeWidth={config.stroke}
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: animationDuration / 1000 }}
              style={{
                filter: `drop-shadow(0 0 8px ${colors.primary}40)`
              }}
            />
            
            {/* Reference Value Indicator */}
            {referenceAngle !== null && showComparison && (
              <circle
                cx={referenceX}
                cy={referenceY}
                r={3}
                fill="white"
                stroke={colors.primary}
                strokeWidth={2}
                opacity={0.8}
              />
            )}
            
            {/* Tick Marks */}
            {ticks.map((tick, index) => (
              <circle
                key={index}
                cx={tick.x}
                cy={tick.y}
                r={tick.isActive ? 3 : 2}
                fill={tick.isActive ? colors.primary : colors.muted}
                className="transition-all duration-200"
              />
            ))}
          </svg>
          
          {/* Center Value Display */}
          {showValue && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <motion.div className="text-2xl font-bold text-foreground">
                  {!isNaN(value) ? Number(value).toFixed(precision) : '0'}
                </motion.div>
                {unit && (
                  <div className="text-sm text-muted-foreground">{unit}</div>
                )}
              </div>
            </div>
          )}
          
          {/* Draggable Thumb */}
          <motion.div
            drag
            dragMomentum={false}
            onPanStart={handlePanStart}
            onPan={handlePan}
            onPanEnd={handlePanEnd}
            whileHover={{ scale: 1.1 }}
            whileDrag={{ scale: 1.2 }}
            className={cn(
              'absolute rounded-full cursor-grab transition-all duration-200',
              getGlassClasses('elevated', resolvedTheme, sectionId),
              isDragging && 'cursor-grabbing shadow-2xl'
            )}
            style={{
              width: config.thumb,
              height: config.thumb,
              left: thumbX - config.thumb / 2,
              top: thumbY - config.thumb / 2,
              background: colors.primary,
              border: `2px solid ${colors.accent}`,
              boxShadow: `0 0 12px ${colors.primary}60`
            }}
          >
            {/* Thumb Inner Glow */}
            <div
              className="absolute inset-1 rounded-full opacity-60"
              style={{ background: colors.accent }}
            />
          </motion.div>
        </div>
      </div>

      {/* Reference Comparison */}
      {referenceLabel && showComparison && referenceValue !== undefined && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-xs text-muted-foreground"
        >
          Reference ({referenceLabel}): {referenceValue.toFixed(precision)}{unit}
        </motion.div>
      )}
    </div>
  );
}