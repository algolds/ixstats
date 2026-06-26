"use client";

// src/app/labs/onoma/components/shared/OnomaHelpModal.tsx
// Onoma Lab — Interactive Welcome Walkthrough & Help Modal (Facet Design)

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Wand2,
  Compass,
  Wrench,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
} from "lucide-react";
import { cn } from "~/lib/utils";

interface OnomaHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    icon: Wand2,
    title: "Quick Generator",
    description:
      "Train a local Markov chain dynamically on any of the 19 public dictionaries (e.g. Norse Deities, Dwarven, Eldritch, Sengoku Japanese) to generate names in real-time.",
    features: [
      "No setup required — select dictionary & click Assemble",
      "Dynamic batch sizes from 10 to 500 candidates",
      "Immediate click-to-copy or save options",
    ],
  },
  {
    icon: Compass,
    title: "Linguistic Sections",
    description:
      "Dive into dedicated naming spaces designed to synthesize specific types of campaign and world building assets.",
    features: [
      "Places: Nations, states, cities, and geographical features",
      "People: Individual characters, rulers, and historic dynasties",
      "Military: Ships, military divisions, and tactical operations",
      "Organizations: Secret orders, merchant guilds, and local taverns",
    ],
  },
  {
    icon: Wrench,
    title: "Studio",
    description:
      "Assemble custom linguistic profiles. Paste your own training seed words, adjust look-back orders, and constrain outputs to craft custom generators.",
    features: [
      "Paste any seed list separated by commas or newlines",
      "Tweak Markov Order (Depth) from 1 to 4 characters",
      "Set filters: length bounds, starts/ends with, contains, excludes",
    ],
  },
  {
    icon: Bookmark,
    title: "Personal Stash",
    description:
      "Keep your name discoveries organized. Save candidate name lists in your Onoma Stash, or export them to your system-level LoreStash collections.",
    features: [
      "Save names and dictionaries into your personal collection",
      "Export names and custom word seeds to LoreStash folders",
      "Share dictionaries with the community as public templates",
    ],
  },
];

export function OnomaHelpModal({ isOpen, onClose }: OnomaHelpModalProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  if (!mounted || !isOpen) return null;

  const currentStep = STEPS[activeStep];
  const StepIcon = currentStep.icon;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop (Frosted Refraction Blur) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="bg-background/40 absolute inset-0 backdrop-blur-[6px]"
          />

          {/* Modal Container (Facet Volumetric Card) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="border-border/40 bg-card relative z-10 flex w-full max-w-lg flex-col justify-between overflow-hidden rounded-xl border p-6 shadow-2xl shadow-black/40"
          >
            {/* Header */}
            <div className="border-border/30 mb-5 flex items-center justify-between border-b pb-3.5">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-[#0091ff]" />
                <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Onoma Lab Guide
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground rounded-lg p-1 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Display (with slide animations) */}
            <div className="flex min-h-[260px] flex-col items-center space-y-4 text-center">
              <div className="animate-pulse rounded-full bg-[#0091ff]/10 p-4 text-[#0091ff]">
                <StepIcon className="h-7 w-7" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-foreground text-lg font-bold tracking-tight">
                  {activeStep + 1}. {currentStep.title}
                </h3>
                <p className="text-muted-foreground mx-auto max-w-sm text-xs leading-relaxed">
                  {currentStep.description}
                </p>
              </div>

              {/* Bullet Features */}
              <div className="w-full space-y-2 rounded-xl border border-[#0091ff]/10 bg-[#0091ff]/5 p-4 text-left">
                {currentStep.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 shrink-0 font-bold text-[#0091ff]">•</span>
                    <span className="text-foreground leading-relaxed font-medium">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Navigation Controls */}
            <div className="border-border/30 mt-6 flex items-center justify-between border-t pt-4">
              {/* Skip Guide */}
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
              >
                Skip Guide
              </button>

              {/* Dots Progress */}
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveStep(idx)}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      idx === activeStep
                        ? "w-4 bg-[#0091ff]"
                        : "bg-border/80 hover:bg-muted-foreground w-1.5"
                    )}
                  />
                ))}
              </div>

              {/* Back / Next Buttons */}
              <div className="flex items-center gap-1.5">
                {activeStep > 0 && (
                  <button
                    onClick={handleBack}
                    className="border-border/40 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </button>
                )}

                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 rounded-lg bg-[#0091ff] px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-[#0091ff]/10 transition-all hover:bg-[#33a7ff] active:scale-[0.98]"
                >
                  <span>{activeStep === STEPS.length - 1 ? "Finish" : "Next"}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default OnomaHelpModal;
