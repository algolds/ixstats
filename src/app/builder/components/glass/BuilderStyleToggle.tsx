"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Grid3X3, Zap, Settings } from 'lucide-react';
import { cn } from '~/lib/utils';

export type BuilderStyle = 'modern' | 'classic';
export type BuilderMode = 'basic' | 'advanced';

interface BuilderStyleToggleProps {
  style: BuilderStyle;
  mode: BuilderMode;
  onStyleChange: (style: BuilderStyle) => void;
  onModeChange: (mode: BuilderMode) => void;
  className?: string;
}

export function BuilderStyleToggle({ 
  style, 
  mode, 
  onStyleChange, 
  onModeChange, 
  className 
}: BuilderStyleToggleProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Style Toggle: Modern vs Classic */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-white/80">Interface Style</h4>
        <motion.div
          className="relative flex items-center p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-lg"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          {/* Background Slider for Style */}
          <motion.div
            className="absolute top-1 bottom-1 w-1/2 bg-gradient-to-r from-purple-500/30 to-blue-500/30 backdrop-blur-sm rounded-lg border border-white/30"
            initial={false}
            animate={{
              x: style === 'modern' ? 0 : '100%'
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30
            }}
          />

          {/* Modern Style Button */}
          <button
            onClick={() => onStyleChange('modern')}
            className={cn(
              "relative z-10 flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 flex-1 justify-center",
              style === 'modern' 
                ? "text-white" 
                : "text-white/60 hover:text-white/80"
            )}
          >
            <Sparkles className="h-4 w-4" />
            <span className="font-medium text-sm">Modern Glass</span>
          </button>

          {/* Classic Style Button */}
          <button
            onClick={() => onStyleChange('classic')}
            className={cn(
              "relative z-10 flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 flex-1 justify-center",
              style === 'classic' 
                ? "text-white" 
                : "text-white/60 hover:text-white/80"
            )}
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="font-medium text-sm">Classic Dense</span>
          </button>
        </motion.div>

        {/* Style Description */}
        <motion.div
          key={style}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <p className="text-xs text-white/60">
            {style === 'modern' 
              ? "Sleek glass interface with guided workflows and smooth animations"
              : "Information-rich dense view for power users with maximum data visibility"
            }
          </p>
        </motion.div>
      </div>

      {/* Mode Toggle: Basic vs Advanced */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-white/80">Complexity Level</h4>
        <motion.div
          className="relative flex items-center p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-lg"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          {/* Background Slider for Mode */}
          <motion.div
            className="absolute top-1 bottom-1 w-1/2 bg-gradient-to-r from-green-500/30 to-emerald-500/30 backdrop-blur-sm rounded-lg border border-white/30"
            initial={false}
            animate={{
              x: mode === 'basic' ? 0 : '100%'
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30
            }}
          />

          {/* Basic Mode Button */}
          <button
            onClick={() => onModeChange('basic')}
            className={cn(
              "relative z-10 flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 flex-1 justify-center",
              mode === 'basic' 
                ? "text-white" 
                : "text-white/60 hover:text-white/80"
            )}
          >
            <Zap className="h-4 w-4" />
            <span className="font-medium text-sm">Basic</span>
          </button>

          {/* Advanced Mode Button */}
          <button
            onClick={() => onModeChange('advanced')}
            className={cn(
              "relative z-10 flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 flex-1 justify-center",
              mode === 'advanced' 
                ? "text-white" 
                : "text-white/60 hover:text-white/80"
            )}
          >
            <Settings className="h-4 w-4" />
            <span className="font-medium text-sm">Advanced</span>
          </button>
        </motion.div>

        {/* Mode Description */}
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <p className="text-xs text-white/60">
            {mode === 'basic' 
              ? "Essential parameters only - perfect for quick nation building"
              : "Full parameter suite with expert controls and detailed customization"
            }
          </p>
        </motion.div>
      </div>

      {/* Glass Transition Effect */}
      <motion.div
        key={`transition-${style}-${mode}`}
        className="absolute inset-0 pointer-events-none"
        initial={{ 
          background: "radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%)",
          scale: 0
        }}
        animate={{ 
          background: "radial-gradient(circle at center, rgba(255,255,255,0) 0%, transparent 70%)",
          scale: 2
        }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

export default BuilderStyleToggle;