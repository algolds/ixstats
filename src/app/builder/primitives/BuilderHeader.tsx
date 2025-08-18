"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Crown, Settings, Sparkles, Grid3X3, Zap } from 'lucide-react';
import { cn } from '~/lib/utils';
import { GlassCard, GlassCardContent } from '../components/glass/GlassCard';
import type { BuilderStyle, BuilderMode } from '../components/glass/BuilderStyleToggle';

interface BuilderHeaderProps {
  title: string;
  subtitle?: string;
  phase?: 'select' | 'customize' | 'preview';
  style?: BuilderStyle;
  mode?: BuilderMode;
  onStyleChange?: (style: BuilderStyle) => void;
  onModeChange?: (mode: BuilderMode) => void;
  onBack?: () => void;
  showBackButton?: boolean;
  enhanced?: boolean;
  className?: string;
}

export function BuilderHeader({
  title,
  subtitle,
  phase = 'select',
  style = 'modern',
  mode = 'basic',
  onStyleChange,
  onModeChange,
  onBack,
  showBackButton = true,
  enhanced = false,
  className
}: BuilderHeaderProps) {
  // If not enhanced mode, render the original simple header
  if (!enhanced) {
    return (
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[var(--color-text-muted)]">{subtitle}</p>
          )}
        </div>
        {showBackButton && onBack && (
          <button onClick={onBack} className="btn-secondary text-sm py-1.5 px-3">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
          </button>
        )}
      </div>
    );
  }

  // Enhanced mode with glass design and toggles
  return (
    <div className={cn("relative z-20 mb-6", className)}>
      <GlassCard depth="elevated" blur="medium">
        <GlassCardContent>
          <div className="flex items-center justify-between">
            {/* Left Side: Back Button + Title */}
            <div className="flex items-center gap-4">
              {showBackButton && onBack && (
                <motion.button
                  onClick={onBack}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 backdrop-blur-sm border border-white/20"
                >
                  <ArrowLeft className="h-5 w-5 text-white" />
                </motion.button>
              )}
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Crown className="h-8 w-8 text-amber-400" />
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute -top-1 -right-1"
                  >
                    <Sparkles className="h-4 w-4 text-purple-400" />
                  </motion.div>
                </div>
                
                <div>
                  <h1 className="text-2xl font-bold text-white">{title}</h1>
                  {subtitle && (
                    <p className="text-white/70 text-sm">{subtitle}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Center: Phase Indicator */}
            <div className="hidden md:flex items-center gap-2">
              {['select', 'customize', 'preview'].map((stepPhase, index) => (
                <React.Fragment key={stepPhase}>
                  <motion.div
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-300",
                      phase === stepPhase
                        ? "bg-white/20 text-white"
                        : index < ['select', 'customize', 'preview'].indexOf(phase)
                        ? "bg-green-500/20 text-green-300"
                        : "bg-white/5 text-white/40"
                    )}
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full transition-all duration-300",
                      phase === stepPhase
                        ? "bg-blue-400"
                        : index < ['select', 'customize', 'preview'].indexOf(phase)
                        ? "bg-green-400"
                        : "bg-white/20"
                    )} />
                    <span className="capitalize">{stepPhase}</span>
                  </motion.div>
                  {index < 2 && (
                    <div className={cn(
                      "w-8 h-0.5 transition-all duration-300",
                      index < ['select', 'customize', 'preview'].indexOf(phase)
                        ? "bg-green-400/60"
                        : "bg-white/20"
                    )} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Right Side: Builder's Toggle */}
            <div className="flex items-center gap-3">
              {/* Style Toggle: Modern vs Classic */}
              {onStyleChange && (
                <div className="hidden lg:flex items-center gap-2">
                  <span className="text-xs text-white/60">Style:</span>
                  <motion.div
                    className="relative flex items-center p-0.5 bg-white/10 backdrop-blur-md rounded-lg border border-white/20"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.div
                      className="absolute top-0.5 bottom-0.5 w-1/2 bg-gradient-to-r from-purple-500/30 to-blue-500/30 backdrop-blur-sm rounded-md border border-white/30"
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
                    
                    <button
                      onClick={() => onStyleChange('modern')}
                      className={cn(
                        "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-200",
                        style === 'modern' 
                          ? "text-white" 
                          : "text-white/60 hover:text-white/80"
                      )}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span className="font-medium text-xs">Modern</span>
                    </button>
                    
                    <button
                      onClick={() => onStyleChange('classic')}
                      className={cn(
                        "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-200",
                        style === 'classic' 
                          ? "text-white" 
                          : "text-white/60 hover:text-white/80"
                      )}
                    >
                      <Grid3X3 className="h-3.5 w-3.5" />
                      <span className="font-medium text-xs">Classic</span>
                    </button>
                  </motion.div>
                </div>
              )}

              {/* Mode Toggle: Basic vs Advanced */}
              {onModeChange && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/60 hidden sm:block">Mode:</span>
                  <motion.div
                    className="relative flex items-center p-0.5 bg-white/10 backdrop-blur-md rounded-lg border border-white/20"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.div
                      className="absolute top-0.5 bottom-0.5 w-1/2 bg-gradient-to-r from-green-500/30 to-emerald-500/30 backdrop-blur-sm rounded-md border border-white/30"
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
                    
                    <button
                      onClick={() => onModeChange('basic')}
                      className={cn(
                        "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-200",
                        mode === 'basic' 
                          ? "text-white" 
                          : "text-white/60 hover:text-white/80"
                      )}
                    >
                      <Zap className="h-3.5 w-3.5" />
                      <span className="font-medium text-xs">Basic</span>
                    </button>
                    
                    <button
                      onClick={() => onModeChange('advanced')}
                      className={cn(
                        "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-200",
                        mode === 'advanced' 
                          ? "text-white" 
                          : "text-white/60 hover:text-white/80"
                      )}
                    >
                      <Settings className="h-3.5 w-3.5" />
                      <span className="font-medium text-xs">Advanced</span>
                    </button>
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}