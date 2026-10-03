"use client";

/**
 * Domain Welcome Modal
 *
 * Shared step-through guide for the domain builders (Government, Economy, ...), built on the
 * Dialog primitive. Arrow keys step through tips (instantly; clicks animate), Escape closes, and
 * the uncontrolled form remembers the seen version in localStorage.
 */

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { NavArrowRight as ChevronRight, NavArrowLeft as ChevronLeft, Check } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

export interface DomainTip {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: string;
  /** Optional text-colour class for the tip's glyph (defaults to the MyCountry accent). */
  color?: string;
  /** @deprecated Ignored: Facet glyphs have no tinted tile. */
  bg?: string;
}

interface DomainWelcomeModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  storageKey: string;
  version?: string | number;
  title: string;
  subtitle?: string;
  tips: DomainTip[];
  /**
   * @deprecated Ignored. Every domain guide uses the MyCountry accent; domains are told apart by
   * glyph and title, not a per-domain palette.
   */
  theme?: "amber" | "emerald" | "purple" | "indigo" | "cyan";
}

export const DomainWelcomeModal = React.memo(function DomainWelcomeModal({
  open: controlledOpen,
  onOpenChange,
  storageKey,
  version = "1.0",
  title,
  subtitle,
  tips,
}: DomainWelcomeModalProps) {
  // Uncontrolled: open until this guide version has been seen. Read once on the client; the
  // Dialog portal renders nothing on the server, so this cannot cause a hydration mismatch.
  const [internalOpen, setInternalOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(storageKey) !== String(version);
    } catch {
      return true; // private browsing: show the guide
    }
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  // Keyboard-driven steps render instantly (Facet: 0ms on keyboard-triggered UI).
  const [instant, setInstant] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

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

  const goTo = (index: number, viaKeyboard: boolean) => {
    setInstant(viaKeyboard);
    setCurrentIndex(index);
  };

  const handleNext = (viaKeyboard = false) => {
    if (currentIndex < tips.length - 1) goTo(currentIndex + 1, viaKeyboard);
    else handleClose();
  };

  const handlePrev = (viaKeyboard = false) => {
    if (currentIndex > 0) goTo(currentIndex - 1, viaKeyboard);
  };

  if (tips.length === 0) return null;

  const currentTip = tips[currentIndex] ?? tips[0]!;
  const Icon = currentTip.icon;
  const isLast = currentIndex === tips.length - 1;
  const slideOffset = shouldReduceMotion || instant ? 0 : 16;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            handleNext(true);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            handlePrev(true);
          }
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="">{title}</DialogTitle>
          {subtitle && <DialogDescription className="text-footnote">{subtitle}</DialogDescription>}
        </DialogHeader>

        {/* Current tip */}
        <div className="min-h-[160px]" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: slideOffset }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -slideOffset }}
              transition={{ duration: instant ? 0 : 0.15, ease: "easeOut" }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <Icon
                  aria-hidden="true"
                  className={cn("h-6 w-6 shrink-0", currentTip.color ?? "text-tint")}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-label text-headline">{currentTip.title}</h3>
                    {currentTip.badge && <Badge variant="outline">{currentTip.badge}</Badge>}
                  </div>
                  <Eyebrow className="tabular-nums">
                    Step {currentIndex + 1} of {tips.length}
                  </Eyebrow>
                </div>
              </div>

              <p className="text-label-secondary text-body leading-relaxed">
                {currentTip.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Step dots and navigation */}
        <div className="border-separator flex items-center justify-between gap-3 border-t pt-4">
          <div className="flex items-center" role="group" aria-label="Guide steps">
            {tips.map((tip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goTo(idx, false)}
                aria-label={`Step ${idx + 1}: ${tip.title}`}
                aria-current={idx === currentIndex ? "step" : undefined}
                className="focus-visible:ring-tint flex h-6 items-center rounded-full px-0.5 focus-visible:ring-1 focus-visible:outline-none max-sm:h-11"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-1.5 rounded-full transition-[background-color] duration-150",
                    idx === currentIndex ? "bg-label w-5" : "bg-fill-2 hover:bg-fill w-1.5"
                  )}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentIndex > 0 && (
              <Button size="sm" variant="outline" onClick={() => handlePrev()}>
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}

            <Button size="sm" onClick={() => handleNext()}>
              {isLast ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Get started
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
