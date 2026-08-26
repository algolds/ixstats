// src/components/wiki-os/margin/modals/MarginCategoryHelpModal.tsx
// Interactive Category Guide modal for the 5 Ws Thread Categories in WikiOS Margin.
// Apple Design & Lore Theory Standard.

"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Xmark as X,
  Compass,
} from "iconoir-react";
import { soundEffects } from "~/lib/sound/cuelume";
import { LORE_DIMENSIONS } from "../tabs/MarginThreadsTab";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface MarginCategoryHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColors?: ThemeColors | null;
}

export function MarginCategoryHelpModal({
  isOpen,
  onClose,
  // oxlint-disable-next-line eslint/no-unused-vars
  themeColors,
}: MarginCategoryHelpModalProps) {
  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        soundEffects.release();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              soundEffects.release();
              onClose();
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            className="relative w-full max-w-lg rounded-3xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/95 shadow-2xl backdrop-blur-2xl text-[var(--wikios-text)] overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4.5 border-b border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/40">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-yellow-400/60 bg-margin-accent text-stone-950 shadow-[0_0_14px_rgba(254,240,54,0.4)] font-bold">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">Category Guide</h3>
                  <p className="text-xs text-[var(--wikios-text-dim)]">
                    The 5 Ws classification system for lore discussions
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEffects.release();
                  onClose();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] hover:bg-[var(--wikios-border)] active:scale-95 transition-all cursor-pointer shadow-xs"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Category Cards */}
            <div className="p-5 overflow-y-auto space-y-3 text-xs scrollbar-thin">
              <p className="text-[11.5px] text-[var(--wikios-text-muted)] leading-relaxed pb-1">
                Discussions in Margin are categorized into five core dimensions to keep worldbuilding structured and easy to search:
              </p>

              {LORE_DIMENSIONS.map((dim) => (
                <div
                  key={dim.id}
                  className="p-3.5 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 space-y-1.5 transition-colors hover:border-[var(--wikios-border)]/80"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{dim.emoji}</span>
                      <span className="font-bold text-xs text-[var(--wikios-text)]">
                        {dim.label}
                      </span>
                    </div>
                    <span
                      style={{
                        backgroundColor: dim.color === "#fef036" ? "rgba(254, 240, 54, 0.25)" : `${dim.color}20`,
                        borderColor: dim.color === "#fef036" ? "rgba(250, 204, 21, 0.6)" : `${dim.color}50`,
                        color: dim.color === "#fef036" ? "var(--wikios-text)" : dim.color,
                      }}
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                    >
                      {dim.short}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--wikios-text-dim)] leading-relaxed">
                    {dim.desc}.
                  </p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/40 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  soundEffects.press();
                  onClose();
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-stone-950 bg-margin-accent hover:bg-margin-accent/90 active:scale-95 transition-all shadow-md cursor-pointer"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
