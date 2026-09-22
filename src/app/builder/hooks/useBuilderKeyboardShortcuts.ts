"use client";

import { useEffect, useEffectEvent } from "react";
import { soundEffects } from "~/lib/sound/cuelume";

export interface UseBuilderKeyboardShortcutsOptions {
  onSave?: (() => void | Promise<void>) | null;
  onReset?: () => void;
  onToggleAdvanced?: () => void;
  isSubmitting?: boolean;
}

/**
 * Global keyboard shortcuts for Country Builder & Editor:
 * - ⌘S / Ctrl+S: Submit / save changes
 * - ⌘⇧D / Ctrl+Shift+D: Trigger reset / discard dialog
 * - ⌘⇧A / Ctrl+Shift+A: Toggle Advanced / Power Mode
 */
export function useBuilderKeyboardShortcuts({
  onSave,
  onReset,
  onToggleAdvanced,
  isSubmitting = false,
}: UseBuilderKeyboardShortcutsOptions) {
  const handleKeyDownEvent = useEffectEvent((e: KeyboardEvent) => {
    const isModifier = e.metaKey || e.ctrlKey;
    if (!isModifier) return;

    const key = e.key.toLowerCase();

    // ⌘S / Ctrl+S — Save / Submit
    if (key === "s" && !e.shiftKey) {
      e.preventDefault();
      if (onSave && !isSubmitting) {
        soundEffects.bloom();
        void onSave();
      }
      return;
    }

    // ⌘⇧D / Ctrl+Shift+D — Discard / Reset
    if (key === "d" && e.shiftKey) {
      e.preventDefault();
      if (onReset && !isSubmitting) {
        soundEffects.tick();
        onReset();
      }
      return;
    }

    // ⌘⇧A / Ctrl+Shift+A — Toggle Advanced / Power Mode
    if (key === "a" && e.shiftKey) {
      e.preventDefault();
      if (onToggleAdvanced && !isSubmitting) {
        soundEffects.toggle();
        onToggleAdvanced();
      }
      return;
    }
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeyDownEvent(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
