// src/components/wiki-os/margin/modals/MarginHelpModal.tsx
// Theme-compliant Apple-grade interactive help & guide modal for WikiOS Margin suite.

"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChatBubble as MessageSquare,
  DesignPencil as Highlighter,
  Bookmark,
  Sparks as Sparkles,
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
  const primaryColor = themeColors?.primary || "var(--wikios-accent, #a855f7)";

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
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border shadow-sm"
                  style={{
                    borderColor: `${primaryColor}40`,
                    backgroundColor: `${primaryColor}15`,
                    color: primaryColor,
                  }}
                >
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">WikiOS Margin Guide</h3>
                  <p className="text-xs text-[var(--wikios-text-dim)]">
                    Interactive reading, threaded discourse, and annotations
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

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs scrollbar-thin">
              {/* Feature 1: Selection Capsule */}
              <div className="p-3.5 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 space-y-2">
                <div
                  className="flex items-center gap-2 font-bold"
                  style={{ color: primaryColor }}
                >
                  <Compass className="w-4 h-4" />
                  <span>1. Select Any Text in the Article</span>
                </div>
                <p className="text-[11.5px] text-[var(--wikios-text-muted)] leading-relaxed">
                  Highlighting any sentence or paragraph brings up the floating Selection Capsule with quick actions:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--wikios-surface)] border border-[var(--wikios-border)]">
                    <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                    <span>Highlight with 4 colors</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--wikios-surface)] border border-[var(--wikios-border)]">
                    <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Start anchored thread</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--wikios-surface)] border border-[var(--wikios-border)]">
                    <Bookmark className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Clip quote to Stash</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--wikios-surface)] border border-[var(--wikios-border)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>One-click copy</span>
                  </div>
                </div>
              </div>

              {/* Feature 2: Threads & Comments */}
              <div className="p-3.5 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 space-y-2">
                <div
                  className="flex items-center gap-2 font-bold"
                  style={{ color: primaryColor }}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>2. Discussion Threads</span>
                </div>
                <p className="text-[11.5px] text-[var(--wikios-text-muted)] leading-relaxed">
                  Collaborate on lore, ask clarifying questions, or discuss treaties. Threads display author user roles, nation affiliations, and support interactive hold-to-resolve completion.
                </p>
              </div>

              {/* Feature 3: Markup & Jump to Text */}
              <div className="p-3.5 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 space-y-2">
                <div
                  className="flex items-center gap-2 font-bold"
                  style={{ color: primaryColor }}
                >
                  <Highlighter className="w-4 h-4" />
                  <span>3. Markup & Jump to Text</span>
                </div>
                <p className="text-[11.5px] text-[var(--wikios-text-muted)] leading-relaxed">
                  Saved highlights appear in the Markup tab with color swatches. Clicking &ldquo;Jump to text&rdquo; instantly scrolls the article directly to that passage with an animated focus ring.
                </p>
              </div>

              {/* Feature 4: Keyboard Shortcuts */}
              <div className="p-3.5 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 space-y-2">
                <div
                  className="flex items-center gap-2 font-bold"
                  style={{ color: primaryColor }}
                >
                  <Keyboard className="w-4 h-4" />
                  <span>Keyboard Shortcuts</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--wikios-surface)] border border-[var(--wikios-border)]">
                    <span className="text-[var(--wikios-text-muted)]">Toggle Margin</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--wikios-card-bg)] text-[var(--wikios-text)] border border-[var(--wikios-border)] font-mono text-[10px]">T</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--wikios-surface)] border border-[var(--wikios-border)]">
                    <span className="text-[var(--wikios-text-muted)]">Close Drawer</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--wikios-card-bg)] text-[var(--wikios-text)] border border-[var(--wikios-border)] font-mono text-[10px]">Esc</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/40 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  soundEffects.press();
                  onClose();
                }}
                style={{ backgroundColor: primaryColor }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer"
              >
                Got It
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
