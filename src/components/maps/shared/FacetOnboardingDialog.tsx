"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";

export interface OnboardingSlide {
  icon: React.ElementType;
  title: string;
  description: string;
  badge?: string;
}

interface FacetOnboardingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  slides: OnboardingSlide[];
  storageKey?: string;
}

export const FacetOnboardingDialog = memo(function FacetOnboardingDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  slides,
  storageKey,
}: FacetOnboardingDialogProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentSlide(0);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (dontShowAgain && storageKey && typeof window !== "undefined") {
      localStorage.setItem(storageKey, "true");
    }
    onClose();
  }, [dontShowAgain, storageKey, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight") {
        setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1));
      }
      if (e.key === "ArrowLeft") {
        setCurrentSlide((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, slides.length, handleClose]);

  if (!isOpen || slides.length === 0) return null;

  const slide = slides[currentSlide]!;
  const Icon = slide.icon;
  const isLast = currentSlide === slides.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/90 p-6 text-white shadow-2xl backdrop-blur-xl">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Title */}
        <div className="mb-6 space-y-1">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-neutral-400">{subtitle}</p>}
        </div>

        {/* Slide Content */}
        <div className="min-h-[160px] flex flex-col items-center justify-center text-center space-y-4 py-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary ring-1 ring-primary/40">
            <Icon className="h-7 w-7" />
          </div>
          <div className="space-y-1.5 max-w-xs">
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-base font-semibold">{slide.title}</h3>
              {slide.badge && (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {slide.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">{slide.description}</p>
          </div>
        </div>

        {/* Indicators */}
        <div className="my-6 flex justify-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentSlide ? "w-6 bg-primary" : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
          {storageKey ? (
            <label className="flex items-center gap-2 text-neutral-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-white/20 bg-white/5 text-primary focus:ring-0"
              />
              <span>Don't show again</span>
            </label>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            {currentSlide > 0 && (
              <button
                onClick={() => setCurrentSlide((p) => p - 1)}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-neutral-300 hover:bg-white/10 transition"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            )}
            <button
              onClick={() => (isLast ? handleClose() : setCurrentSlide((p) => p + 1))}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 font-semibold text-white shadow-lg hover:bg-primary/90 transition"
            >
              <span>{isLast ? "Get Started" : "Next"}</span>
              {isLast ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
