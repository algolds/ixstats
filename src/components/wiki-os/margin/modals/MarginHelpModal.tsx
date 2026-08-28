"use client";
// src/components/wiki-os/margin/modals/MarginHelpModal.tsx
// Interactive help modal for WikiOS Margin suite.
// Signature Highlighter Yellow / Warm Amber branding for Margin.

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ChatBubble as MessageSquare,
  DesignPencil as Highlighter,
  Bookmark,
  Xmark as X,
  Keyframe as Keyboard,
  Compass,
  CheckCircle as CheckCircle2,
} from "iconoir-react";
import { soundEffects } from "~/lib/sound/cuelume";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface MarginHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColors?: ThemeColors | null;
}

export function MarginHelpModal({ isOpen, onClose, themeColors }: MarginHelpModalProps) {
  const primaryColor = themeColors?.primary || "var(--wikios-accent, #fef036)";

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
                  <Highlighter className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">WikiOS Margin© guide</h3>
                  <p className="text-xs text-[var(--wikios-text-dim)]">
                    Discuss lore, highlight passages, and keep notes without leaving the page
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

            {/* Scrollable Content */}
            <div className="scrollbar-thin space-y-4 overflow-y-auto p-5 text-xs">
              {/* Feature 1: Selection Capsule */}
              <div className="space-y-2 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 p-3.5">
                <div className="flex items-center gap-2 font-bold text-[var(--wikios-text)]">
                  <Compass className="dark:text-margin-accent h-4 w-4 text-yellow-600" />
                  <span>1. Selecting text</span>
                </div>
                <p className="text-[11.5px] leading-relaxed text-[var(--wikios-text-muted)]">
                  Select prose in the article to highlight, start a discussion, suggest an edit, or
                  save a quote:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="flex items-center gap-2 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-2">
                    <span className="bg-margin-accent h-3 w-3 shrink-0 rounded-full" />
                    <span>Highlight</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-2">
                    <MessageSquare className="dark:text-margin-accent h-3.5 w-3.5 shrink-0 text-yellow-600" />
                    <span>Discuss</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-2">
                    <Bookmark className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                    <span>Save quote</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span>Copy text</span>
                  </div>
                </div>
              </div>

              {/* Feature 2: Threads & Comments */}
              <div className="space-y-2 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 p-3.5">
                <div className="flex items-center gap-2 font-bold" style={{ color: primaryColor }}>
                  <MessageSquare className="h-4 w-4" />
                  <span>2. Discussions</span>
                </div>
                <p className="text-[11.5px] leading-relaxed text-[var(--wikios-text-muted)]">
                  Talk through lore details, dispute claims, or suggest edits. Long-press
                  &ldquo;Hold to resolve&rdquo; when a discussion is settled.
                </p>
              </div>

              {/* Feature 3: Markup & Jump to Text */}
              <div className="space-y-2 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 p-3.5">
                <div className="flex items-center gap-2 font-bold" style={{ color: primaryColor }}>
                  <Highlighter className="h-4 w-4" />
                  <span>3. Highlights & quotes</span>
                </div>
                <p className="text-[11.5px] leading-relaxed text-[var(--wikios-text-muted)]">
                  Highlights appear in the Markup tab. Click &ldquo;Jump&rdquo; to scroll to the
                  passage in the article.
                </p>
              </div>

              {/* Feature 4: Keyboard Shortcuts */}
              <div className="space-y-2 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 p-3.5">
                <div className="flex items-center gap-2 font-bold" style={{ color: primaryColor }}>
                  <Keyboard className="h-4 w-4" />
                  <span>Shortcuts</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5 text-[11px]">
                  <div className="flex items-center justify-between rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-2">
                    <span className="text-[var(--wikios-text-muted)]">Toggle Margin</span>
                    <kbd className="rounded border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--wikios-text)]">
                      T
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-2">
                    <span className="text-[var(--wikios-text-muted)]">Close Drawer</span>
                    <kbd className="rounded border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--wikios-text)]">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>
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
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
