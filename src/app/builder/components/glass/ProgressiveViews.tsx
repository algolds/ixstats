"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { ChevronDown, ChevronUp, Zap, Settings } from 'lucide-react';
import { GlassToggle } from './GlassInputs';
import { NumberFlowDisplay } from '~/components/ui/number-flow';

// Basic/Advanced View Components for Progressive Disclosure
interface ViewProps {
  children: React.ReactNode;
  visible?: boolean;
  className?: string;
}

// Basic View - Always visible essential controls
export function BasicView({ children, visible = true, className }: ViewProps) {
  if (!visible) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("space-y-4", className)}
    >
      {children}
    </motion.div>
  );
}

// Advanced View - Collapsible detailed controls
export function AdvancedView({ children, visible = false, className }: ViewProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -20 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -20 }}
          transition={{ 
            duration: 0.4, 
            ease: "easeOut",
            height: { duration: 0.5 }
          }}
          className={cn("overflow-hidden", className)}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="space-y-4 pt-4 border-t border-border"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// View Toggle Button Component
interface ViewToggleProps {
  showAdvanced: boolean;
  onToggle: () => void;
  basicLabel?: string;
  advancedLabel?: string;
  className?: string;
  theme?: 'gold' | 'blue' | 'indigo' | 'red' | 'neutral';
}

export function ViewToggle({
  showAdvanced,
  onToggle,
  basicLabel = "Basic",
  advancedLabel = "Advanced",
  className,
  theme = 'neutral'
}: ViewToggleProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-3">
        <motion.button
          onClick={onToggle}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "flex items-center gap-2 px-3 py-2 md:py-1.5 rounded-lg transition-all duration-200",
            "bg-card/50 hover:bg-card/70 border border-border hover:border-accent",
            "text-sm font-medium text-foreground touch-manipulation",
            "min-h-[44px] md:min-h-[auto]" // iOS minimum touch target
          )}
        >
          {showAdvanced ? (
            <>
              <Settings className="h-4 w-4" />
              {advancedLabel}
              <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              {basicLabel}
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </motion.button>
        
        <span className="text-xs text-muted-foreground">
          {showAdvanced ? "Showing detailed controls" : "Click for advanced options"}
        </span>
      </div>
      
      {/* Alternative toggle style */}
      <GlassToggle
        checked={showAdvanced}
        onChange={onToggle}
        theme={theme}
        size="sm"
      />
    </div>
  );
}

// Section Container - Unified wrapper for all builder sections
interface SectionContainerProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  children: React.ReactNode;
  theme?: 'gold' | 'blue' | 'indigo' | 'red' | 'neutral';
  className?: string;
  headerActions?: React.ReactNode;
}

export function SectionContainer({
  title,
  subtitle,
  icon: Icon,
  showAdvanced,
  onToggleAdvanced,
  children,
  theme = 'neutral',
  className,
  headerActions
}: SectionContainerProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Section Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={cn(
                "p-2 rounded-lg bg-card/50 border border-border",
                "flex items-center justify-center"
              )}>
                {React.createElement(Icon, { className: "h-5 w-5 text-muted-foreground" })}
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          {headerActions}
        </div>
        
        {/* View Toggle */}
        <ViewToggle
          showAdvanced={showAdvanced}
          onToggle={onToggleAdvanced}
          theme={theme}
        />
      </div>
      
      {/* Section Content */}
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}

// Responsive Grid Container for form elements
interface FormGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function FormGrid({ children, columns = 2, className }: FormGridProps) {
  const gridColumns = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
  };

  return (
    <div className={cn(
      "grid gap-4",
      gridColumns[columns],
      className
    )}>
      {children}
    </div>
  );
}

// Metric Overview Component for displaying key stats
interface MetricOverviewProps {
  metrics: {
    label: string;
    value: string | number;
    unit?: string;
    trend?: 'up' | 'down' | 'neutral';
    change?: number;
    icon?: React.ElementType;
    theme?: 'gold' | 'blue' | 'indigo' | 'red' | 'neutral';
  }[];
  className?: string;
}

export function MetricOverview({ metrics, className }: MetricOverviewProps) {
  return (
    <div className={cn(
      "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
      className
    )}>
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.3 }}
          className="p-4 bg-card/50 backdrop-blur-sm border border-border rounded-lg"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
              <div className="flex items-baseline gap-1">
                {typeof metric.value === 'number' ? (
                  <NumberFlowDisplay
                    value={metric.value}
                    format={
                      metric.unit === '%' ? 'percentage' :
                      metric.unit === ' years' ? 'default' :
                      metric.value >= 1000000 ? 'population' : 'default'
                    }
                    suffix={metric.unit && metric.unit !== '%' ? metric.unit : ''}
                    className="text-xl font-bold text-foreground"
                    duration={800}
                    decimalPlaces={metric.unit === '%' || metric.unit === ' years' ? 1 : 0}
                  />
                ) : (
                  <span className="text-xl font-bold text-foreground">{metric.value}</span>
                )}
              </div>
              {metric.change !== undefined && (
                <div className={cn(
                  "flex items-center gap-1 mt-1 text-xs",
                  metric.trend === 'up' ? "text-green-400" :
                  metric.trend === 'down' ? "text-red-400" : "text-muted-foreground"
                )}>
                  {metric.trend === 'up' && <ChevronUp className="h-3 w-3" />}
                  {metric.trend === 'down' && <ChevronDown className="h-3 w-3" />}
                  <NumberFlowDisplay
                    value={Math.abs(metric.change)}
                    format="percentage"
                    className="text-xs"
                    duration={600}
                    decimalPlaces={1}
                  />
                </div>
              )}
            </div>
            {metric.icon && 
              React.createElement(metric.icon, { className: "h-5 w-5 text-muted-foreground" })
            }
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Validation Message Component
interface ValidationMessageProps {
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  className?: string;
}

export function ValidationMessage({ type, message, className }: ValidationMessageProps) {
  const styles = {
    error: "bg-red-500/20 border-red-400/30 text-red-300",
    warning: "bg-yellow-500/20 border-yellow-400/30 text-yellow-300",
    info: "bg-blue-500/20 border-blue-400/30 text-blue-300",
    success: "bg-green-500/20 border-green-400/30 text-green-300"
  };

  const icons = {
    error: "⚠️",
    warning: "⚡",
    info: "ℹ️",
    success: "✅"
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "flex items-start gap-2 p-3 rounded-lg border backdrop-blur-sm",
        styles[type],
        className
      )}
    >
      <span className="text-sm">{icons[type]}</span>
      <p className="text-sm font-medium flex-1">{message}</p>
    </motion.div>
  );
}