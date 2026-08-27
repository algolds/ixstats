// src/components/wiki-os/margin/modals/MarginCategoryHelpModal.tsx
// Interactive Category Guide modal for the 5 Ws Thread Categories in WikiOS Margin.
// Apple Design & Lore Theory Standard.

"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Xmark as X, Compass } from "iconoir-react";
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
            className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/95 text-[var(--wikios-text)] shadow-2xl backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/40 p-4.5">
              <div className="flex items-center gap-3">
                <div className="bg-margin-accent flex h-10 w-10 items-center justify-center rounded-2xl border border-yellow-400/60 font-bold text-stone-950 shadow-[0_0_14px_rgba(254,240,54,0.4)]">
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
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] text-[var(--wikios-text-dim)] shadow-xs transition-all hover:bg-[var(--wikios-border)] hover:text-[var(--wikios-text)] active:scale-95"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Category Cards */}
            <div className="scrollbar-thin space-y-3 overflow-y-auto p-5 text-xs">
              <p className="pb-1 text-[11.5px] leading-relaxed text-[var(--wikios-text-muted)]">
                Discussions in Margin are categorized into five core dimensions to keep
                worldbuilding structured and easy to search:
              </p>

              {LORE_DIMENSIONS.map((dim) => (
                <div
                  key={dim.id}
                  className="space-y-1.5 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 p-3.5 transition-colors hover:border-[var(--wikios-border)]/80"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{dim.emoji}</span>
                      <span className="text-xs font-bold text-[var(--wikios-text)]">
                        {dim.label}
                      </span>
                    </div>
                    <span
                      style={{
                        backgroundColor:
                          dim.color === "#fef036" ? "rgba(254, 240, 54, 0.25)" : `${dim.color}20`,
                        borderColor:
                          dim.color === "#fef036" ? "rgba(250, 204, 21, 0.6)" : `${dim.color}50`,
                        color: dim.color === "#fef036" ? "var(--wikios-text)" : dim.color,
                      }}
                      className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
                    >
                      {dim.short}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[var(--wikios-text-dim)]">
                    {dim.desc}.
                  </p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/40 p-4">
              <button
                type="button"
                onClick={() => {
                  soundEffects.press();
                  onClose();
                }}
                className="bg-margin-accent hover:bg-margin-accent/90 cursor-pointer rounded-xl px-5 py-2 text-xs font-bold text-stone-950 shadow-md transition-all active:scale-95"
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
