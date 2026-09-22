"use client";

/**
 * Domain Welcome Modal
 *
 * Shared walkthrough modal for domain builders (Government, Economy, Defense, etc.).
 * Features fluid slide transitions, tactile controls, and localStorage persistence.
 */

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Xmark as X, NavArrowRight as ChevronRight, NavArrowLeft as ChevronLeft, Check } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export interface DomainTip {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: string;
  color?: string;
  bg?: string;
}

export interface DomainWelcomeModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  storageKey: string;
  version?: string | number;
  title: string;
  subtitle?: string;
  tips: DomainTip[];
  theme?: "amber" | "emerald" | "purple" | "indigo" | "cyan";
}

const THEME_CONFIG = {
  amber: {
    accent: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    glow: "shadow-lg",
    button: "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20",
    activeDot: "bg-amber-500",
  },
  emerald: {
    accent: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    glow: "shadow-lg",
    button: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20",
    activeDot: "bg-emerald-500",
  },
  indigo: {
    accent: "text-indigo-500 dark:text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    glow: "shadow-lg",
    button: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20",
    activeDot: "bg-indigo-500",
  },
  purple: {
    accent: "text-indigo-500 dark:text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    glow: "shadow-lg",
    button: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20",
    activeDot: "bg-indigo-500",
  },
  cyan: {
    accent: "text-cyan-500 dark:text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    glow: "shadow-lg",
    button: "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20",
    activeDot: "bg-cyan-500",
  },
};

export const DomainWelcomeModal = React.memo(function DomainWelcomeModal({
  open: controlledOpen,
  onOpenChange,
  storageKey,
  version = "1.0",
  title,
  subtitle,
  tips,
  theme = "amber",
}: DomainWelcomeModalProps) {
  const [internalOpen, setInternalOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const colors = THEME_CONFIG[theme] ?? THEME_CONFIG.amber;

  useEffect(() => {
    setMounted(true);
    if (!isControlled) {
      try {
        const seen = localStorage.getItem(storageKey);
        if (!seen || seen !== String(version)) {
          setInternalOpen(true);
        }
      } catch {
        // Fallback for SSR/private browsing
      }
    }
  }, [storageKey, version, isControlled]);

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem(storageKey, String(version));
    } catch {
      // ignore
    }
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setInternalOpen(false);
    }
    setCurrentIndex(0);
  }, [storageKey, version, isControlled, onOpenChange]);

  const handleNext = () => {
    if (currentIndex < tips.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose, currentIndex, tips.length]);

  if (!mounted || !isOpen || tips.length === 0) return null;

  const currentTip = tips[currentIndex] || tips[0]!;
  const Icon = currentTip.icon;
  const isLast = currentIndex === tips.length - 1;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="fixed inset-0 bg-background/80 backdrop-blur-md"
      />

      {/* Dialog Surface */}
      <motion.div
        initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.95, y: shouldReduceMotion ? 0 : 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.95, y: shouldReduceMotion ? 0 : 10 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-2xl border bg-card/95 p-6 shadow-2xl backdrop-blur-xl",
          colors.border,
          colors.glow
        )}
      >
        {/* Close Button */}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleClose}
          className="absolute top-4 right-4 h-8 w-8 p-0 text-muted-foreground hover:text-foreground active:scale-[0.92]"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Header */}
        <div className="mb-6 pr-8">
          <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>

        {/* Animated Slide Content */}
        <div className="min-h-[160px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -16 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex flex-col gap-3.5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "rounded-xl p-3 shrink-0 border",
                    currentTip.bg || colors.bg,
                    currentTip.color || colors.accent,
                    colors.border
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{currentTip.title}</h3>
                    {currentTip.badge && (
                      <Badge variant="outline" className="text-[10px] font-medium border-border/50">
                        {currentTip.badge}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Step {currentIndex + 1} of {tips.length}
                  </span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {currentTip.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation & Dots */}
        <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {tips.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                title={`Go to step ${idx + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  idx === currentIndex ? cn("w-5", colors.activeDot) : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {currentIndex > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrev}
                className="h-8 text-xs active:scale-[0.94]"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleNext}
              className={cn("h-8 text-xs font-semibold active:scale-[0.94] shadow-xs", colors.button)}
            >
              {isLast ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Get Started
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
});
