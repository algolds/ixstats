"use client";

// src/app/labs/onoma/components/shared/OnomaHelpModal.tsx
// ⟨ONOMA⟩ Linguistic Engine — Brand Walkthrough & System Guide (Apple / Facet Design)
// Uses Game-Icons from Cards library (Icons by Lorc, Delapouite & contributors, CC BY 3.0)
// Reference: docs/systems/onoma-brand-guide.md

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { CategoryIcon } from "~/components/cards/icons";
import type { LoreCategory } from "~/lib/cards/category-enums";
import { OnomaBrandLogo } from "./OnomaBrandLogo";
import { cn } from "~/lib/utils";

interface OnomaHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StepItem {
  category: LoreCategory;
  badge: string;
  title: string;
  subtitle: string;
  quote?: string;
  progression?: string;
  description: string;
  features: string[];
}

const STEPS: StepItem[] = [
  {
    category: "SCIENCE",
    badge: "",
    title: "Language is a system.",
    subtitle: "From rules to language",
    quote:
      "Good linguistic creation does not begin with words. It begins with the system that makes those words possible.",
    description:
      "A name is never simply a string of letters. It emerges naturally from a structured linguistic chain:",
    progression: "sound → structure → pattern → vocabulary → culture → history",
    features: [
      "Onoma is not a name generator — it is the linguistic engine",
      "Engineered with mathematical rules and formal linguistic models",
      "Define the phonotactic rules and let authentic vocabulary emerge",
    ],
  },
  {
    category: "GEOGRAPHY",
    badge: "02 · CREATE",
    title: "Make language useful.",
    subtitle: "Build the language behind your world",
    description:
      "Synthesize culturally coherent names and entities across dedicated worldbuilding environments:",
    features: [
      "Places: Nations, provinces, settlements, mountain ranges, and rivers",
      "People: First names, surnames, noble dynasties, and cultural ethnonyms",
      "Organizations & Culture: Guilds, chivalric orders, deities, and sacred traditions",
    ],
  },
  {
    category: "HISTORY",
    badge: "03 · STUDIO",
    title: "Build the system.",
    subtitle: "Computational linguistics environment",
    description:
      "A complete laboratory to define sound systems, train models, and simulate centuries of language change:",
    features: [
      "Workshop & Phonology: Multi-order Markov models, syllable templates (CVC, CCVCC), and sonority rules",
      "Acoustics: Real-time 2D IPA Vowel Quadrilateral (F₁ vs F₂) and resonant formant spectrum",
      "Sound Shifts: Historical sound change interpreter (X → Y / ENV) across epochs (Grimm's Law, Romance Lenition)",
    ],
  },
  {
    category: "CULTURE",
    badge: "04 · EXPLORE & STASH",
    title: "Understand the language.",
    subtitle: "The permanent world lexicon",
    description:
      "Inspect underlying mechanics, audit linguistic health, audition natural speech, and stash vocabulary:",
    features: [
      "Linguistic Enrichments: 5-case noun declensions, grammatical gender, and script transcriptions",
      "Dual Speech Engine: Instant browser BCP-47 accents and Kokoro neural phoneme voiceover",
      "Stash: Organize discovered names and export directly into your worldbuilding collections",
    ],
  },
];

export function OnomaHelpModal({ isOpen, onClose }: OnomaHelpModalProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard navigation (Escape to close, Left/Right arrows to step)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") {
        setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
      }
      if (e.key === "ArrowLeft") {
        setActiveStep((prev) => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
            className="bg-background/60 absolute inset-0 backdrop-blur-md"
          />

          {/* Modal Container (Facet Volumetric Card) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="border-border/50 bg-card/95 relative z-10 flex w-full max-w-lg flex-col justify-between overflow-hidden rounded-2xl border p-6 sm:p-7 shadow-2xl shadow-black/50 backdrop-blur-xl"
          >
            {/* Header: Logo, Tagline & Close Trigger */}
            <div className="border-border/30 mb-5 flex items-start justify-between border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <OnomaBrandLogo variant="lockup" className="h-6 w-auto text-foreground" />
                </div>
                <p className="text-[12px] font-medium text-foreground tracking-tight">
                  Language, engineered.{" "}
                  <span className="text-muted-foreground font-normal">
                    Build the language behind your world.
                  </span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground rounded-lg p-1.5 transition-all -mr-1 -mt-1 active:scale-95 cursor-pointer"
                title="Close Guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Display */}
            <div className="flex min-h-[280px] flex-col items-center space-y-3.5 text-center">
              {/* Category Badge & Game-Icon Silhouette from Cards */}
              <div className="relative">
                <div className="rounded-2xl border border-[#0091ff]/20 bg-[#0091ff]/10 p-3 text-[#0091ff] shadow-[0_0_20px_rgba(0,145,255,0.15)] flex items-center justify-center">
                  <CategoryIcon
                    category={currentStep.category}
                    treatment="emblem"
                    className="h-6 w-6 text-[#0091ff]"
                  />
                </div>
                {currentStep.badge ? (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#0091ff]/30 bg-background px-2 py-0.5 text-[9px] font-bold tracking-widest text-[#0091ff] uppercase">
                    {currentStep.badge}
                  </span>
                ) : null}
              </div>

              <div className="space-y-1 pt-1">
                <h3 className="text-foreground text-base sm:text-lg font-semibold tracking-tight">
                  {currentStep.title}
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed max-w-sm mx-auto font-normal">
                  {currentStep.description}
                </p>
              </div>

              {/* Special Quote / Progression Chain for Step 1 */}
              {currentStep.quote && (
                <div className="w-full space-y-1.5 rounded-lg border border-[#0091ff]/20 bg-[#0091ff]/5 px-3 py-2 text-center">
                  <p className="text-[11px] font-medium text-foreground italic">
                    “{currentStep.quote}”
                  </p>
                  <p className="font-mono text-[10px] text-[#0091ff] font-semibold tracking-tight">
                    {currentStep.progression}
                  </p>
                </div>
              )}

              {/* Feature Bullet Points */}
              <div className="w-full space-y-1.5 rounded-xl border border-border/40 bg-secondary/[0.04] p-3 text-left">
                {currentStep.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 shrink-0 text-[#0091ff] font-bold">›</span>
                    <span className="text-foreground/90 leading-relaxed font-medium">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Navigation Controls & North Star Mantra */}
            <div className="border-border/30 mt-5 flex items-center justify-between border-t pt-4">
              {/* Skip Guide */}
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer"
              >
                Skip Guide
              </button>

              {/* Segmented Dots Progress */}
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveStep(idx)}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                      idx === activeStep
                        ? "w-5 bg-[#0091ff]"
                        : "bg-border/80 hover:bg-muted-foreground w-1.5"
                    )}
                  />
                ))}
              </div>

              {/* Back / Next Buttons */}
              <div className="flex items-center gap-2">
                {activeStep > 0 && (
                  <button
                    onClick={handleBack}
                    className="border-border/40 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </button>
                )}

                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 rounded-lg bg-[#0091ff] px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-[#0091ff]/20 transition-all hover:bg-[#33a7ff] active:scale-95 cursor-pointer"
                >
                  <span>{activeStep === STEPS.length - 1 ? "Enter Lab" : "Next"}</span>
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
