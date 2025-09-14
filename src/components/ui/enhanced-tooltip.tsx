"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { cn } from '~/lib/utils';
import { Info, TrendingUp, TrendingDown, AlertTriangle, HelpCircle } from 'lucide-react';

interface EnhancedTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  title?: string;
  impact?: {
    metric: string;
    change: number;
    description: string;
  }[];
  warning?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  delay?: number;
  maxWidth?: string;
  className?: string;
  zIndex?: number;
  disabled?: boolean;
}

const themeStyles = {
  default: {
    bg: 'var(--tooltip-bg)',
    border: 'var(--tooltip-border)',
    text: 'var(--tooltip-text)',
    accent: 'var(--tooltip-accent)'
  }
};

export function EnhancedTooltip({
  children,
  content,
  title,
  impact,
  warning,
  position = 'auto',
  delay = 300,
  maxWidth = 'max-w-xs',
  className,
  zIndex = 9999,
  disabled = false
}: EnhancedTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(position);
  const [coordinates, setCoordinates] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const themeStyle = themeStyles.default;

  // Calculate optimal position
  const calculatePosition = (triggerRect: DOMRect) => {
    const tooltipElement = tooltipRef.current;
    if (!tooltipElement) return;

    const tooltipRect = tooltipElement.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let finalPosition = position;
    let x = 0;
    let y = 0;

    // Auto-position logic
    if (position === 'auto') {
      const spaceTop = triggerRect.top;
      const spaceBottom = viewport.height - triggerRect.bottom;
      const spaceLeft = triggerRect.left;
      const spaceRight = viewport.width - triggerRect.right;

      if (spaceTop > tooltipRect.height + 10) {
        finalPosition = 'top';
      } else if (spaceBottom > tooltipRect.height + 10) {
        finalPosition = 'bottom';
      } else if (spaceLeft > tooltipRect.width + 10) {
        finalPosition = 'left';
      } else {
        finalPosition = 'right';
      }
    }

    // Calculate coordinates based on final position
    switch (finalPosition) {
      case 'top':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - 8;
        break;
      case 'bottom':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + 8;
        break;
      case 'left':
        x = triggerRect.left - tooltipRect.width - 8;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        x = triggerRect.right + 8;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Constrain to viewport
    x = Math.max(8, Math.min(x, viewport.width - tooltipRect.width - 8));
    y = Math.max(8, Math.min(y, viewport.height - tooltipRect.height - 8));

    setTooltipPosition(finalPosition);
    setCoordinates({ x, y });
  };

  const showTooltip = () => {
    if (disabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      // Calculate position after tooltip is rendered
      requestAnimationFrame(() => {
        if (triggerRef.current) {
          calculatePosition(triggerRef.current.getBoundingClientRect());
        }
      });
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getArrowClasses = () => {
    const baseArrow = 'absolute w-3 h-3 transform rotate-45';
    const borderColor = themeStyle.border.replace('border-', 'bg-');
    
    switch (tooltipPosition) {
      case 'top':
        return `${baseArrow} ${borderColor} -bottom-1.5 left-1/2 -translate-x-1/2`;
      case 'bottom':
        return `${baseArrow} ${borderColor} -top-1.5 left-1/2 -translate-x-1/2`;
      case 'left':
        return `${baseArrow} ${borderColor} -right-1.5 top-1/2 -translate-y-1/2`;
      case 'right':
        return `${baseArrow} ${borderColor} -left-1.5 top-1/2 -translate-y-1/2`;
      default:
        return `${baseArrow} ${borderColor} -bottom-1.5 left-1/2 -translate-x-1/2`;
    }
  };

  const tooltipContent = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={cn(
            'fixed pointer-events-none',
            'rounded-lg border backdrop-blur-xl',
            'shadow-2xl shadow-black/20',
            themeStyle.bg,
            themeStyle.border,
            themeStyle.text,
            maxWidth,
            className
          )}
          style={{
            left: coordinates.x,
            top: coordinates.y,
            zIndex
          }}
        >
          {/* Arrow */}
          <div className={getArrowClasses()} />
          
          {/* Content */}
          <div className="p-4 space-y-3">
            {title && (
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Info className="h-4 w-4" />
                {title}
              </div>
            )}
            
            <div className="text-sm">
              {content}
            </div>
            
            {impact && impact.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-current/20">
                <div className={cn("text-xs font-medium flex items-center gap-1", themeStyle.accent)}>
                  <TrendingUp className="h-3 w-3" />
                  Impact Analysis
                </div>
                {impact.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="opacity-90">{item.metric}</span>
                    <div className="flex items-center gap-1">
                      {item.change > 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-400" />
                      ) : item.change < 0 ? (
                        <TrendingDown className="h-3 w-3 text-red-400" />
                      ) : null}
                      <span className={cn(
                        'font-medium',
                        item.change > 0 ? 'text-green-400' : 
                        item.change < 0 ? 'text-red-400' : 'opacity-60'
                      )}>
                        {item.change > 0 ? '+' : ''}{item.change}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {warning && (
              <div className="flex items-start gap-2 p-2 rounded bg-red-500/20 border border-red-400/30">
                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-red-200">{warning}</div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div 
        ref={triggerRef}
        className="inline-block"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      
      {typeof window !== 'undefined' && createPortal(tooltipContent, document.body)}
    </>
  );
}

export function InfoIcon({ 
  className,
  ...props 
}: React.ComponentProps<typeof HelpCircle>) {
  return (
    <HelpCircle 
      className={cn(
        'h-4 w-4 text-white/40 hover:text-amber-400 transition-colors cursor-help',
        className
      )} 
      {...props}
    />
  );
}