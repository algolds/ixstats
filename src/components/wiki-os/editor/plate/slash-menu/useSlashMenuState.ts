/**
 * useSlashMenuState.ts — Tracks the `/` trigger and search query for the
 * WikiOS slash command menu, driven by Plate onKeyDown events.
 */

"use client";

import { useCallback, useRef, useState } from "react";

export interface SlashMenuState {
  open: boolean;
  query: string;
  /** DOM rect of the caret position when the menu opened (best-effort anchor). */
  anchorRect: { top: number; left: number } | null;
  close: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useSlashMenuState(): SlashMenuState {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number } | null>(null);
  const trackingRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    trackingRef.current = false;
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open && e.key === "/") {
        // Only trigger at start of empty block or after whitespace — checked by
        // caller via selection; we accept and let filtering hide noise.
        const sel = window.getSelection();
        const rect = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
        setAnchorRect(rect ? { top: rect.bottom + 4, left: rect.left } : null);
        setOpen(true);
        setQuery("");
        trackingRef.current = true;
        return;
      }
      if (!open || !trackingRef.current) return;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Backspace") {
        if (query.length === 0) {
          close();
        } else {
          setQuery((q) => q.slice(0, -1));
        }
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setQuery((q) => q + e.key);
      }
    },
    [open, query.length, close]
  );

  return { open, query, anchorRect, close, handleKeyDown };
}
