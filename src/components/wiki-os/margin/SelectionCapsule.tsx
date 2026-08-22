// src/components/wiki-os/margin/SelectionCapsule.tsx
// Origin-aware floating selection capsule for inline markup, stash, and discussions.
// Full Apple Design & Theme Compliance.

"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Bookmark, Check, Copy } from "lucide-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";

export const HIGHLIGHT_PALETTE = [
  { color: "#fbbf24", label: "Amber" },
  { color: "#34d399", label: "Emerald" },
  { color: "#60a5fa", label: "Blue" },
  { color: "#f472b6", label: "Rose" },
];

export interface SelectionPayload {
  text: string;
  anchorSelector?: string;
  anchorOffset?: number;
  focusSelector?: string;
  focusOffset?: number;
  rect: DOMRect;
}

interface SelectionCapsuleProps {
  contentRef: React.RefObject<HTMLDivElement | null>;
  onAddHighlight?: (payload: SelectionPayload, color: string) => void;
  onOpenThreadDraft?: (payload: SelectionPayload) => void;
  onStashQuote?: (payload: SelectionPayload) => void;
  isAuthenticated: boolean;
}

export function SelectionCapsule({
  contentRef,
  onAddHighlight,
  onOpenThreadDraft,
  onStashQuote,
  isAuthenticated,
}: SelectionCapsuleProps) {
  const [selectionData, setSelectionData] = useState<SelectionPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const notify = useNotify();

  const clearSelection = useCallback(() => {
    setSelectionData(null);
  }, []);

  const handleSelectionChange = useCallback(() => {
    if (typeof window === "undefined") return;
    const container = contentRef.current;
    if (!container) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSelectionData(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) {
      setSelectionData(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setSelectionData(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setSelectionData(null);
      return;
    }

    setSelectionData({
      text,
      rect,
    });
  }, [contentRef]);

  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(handleSelectionChange, 20);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
        return;
      }
      setTimeout(handleSelectionChange, 20);
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleSelectionChange, clearSelection]);

  const handleHighlight = (color: string) => {
    if (!selectionData) return;
    soundEffects.press();
    onAddHighlight?.(selectionData, color);
    clearSelection();
  };

  const handleComment = () => {
    if (!selectionData) return;
    soundEffects.press();
    onOpenThreadDraft?.(selectionData);
    clearSelection();
  };

  const handleStash = () => {
    if (!selectionData) return;
    soundEffects.success();
    onStashQuote?.(selectionData);
    notify.success("Quote saved to Stash");
    clearSelection();
  };

  const handleCopy = async () => {
    if (!selectionData) return;
    try {
      await navigator.clipboard.writeText(selectionData.text);
      soundEffects.press();
      setCopied(true);
      notify.success("Quote copied to clipboard");
      setTimeout(() => {
        setCopied(false);
        clearSelection();
      }, 1200);
    } catch {
      notify.error("Failed to copy");
    }
  };

  if (!selectionData || typeof document === "undefined") return null;

  // Compute position centered above the selection with safe viewport bounds
  const x = Math.max(160, Math.min(window.innerWidth - 160, selectionData.rect.left + selectionData.rect.width / 2));
  const y = Math.max(70, selectionData.rect.top - 12);

  const style: React.CSSProperties = {
    position: "fixed",
    left: `${x}px`,
    top: `${y}px`,
    transform: "translate(-50%, -100%)",
    transformOrigin: "center bottom",
    zIndex: 9999,
  };

  return createPortal(
    <div
      ref={capsuleRef}
      style={style}
      className={cn(
        "flex items-center gap-1.5 p-1.5 rounded-2xl border border-[var(--wikios-border)] shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-all duration-200 select-none animate-in fade-in zoom-in-95",
        "bg-[var(--wikios-surface)]/95 text-[var(--wikios-text)]"
      )}
    >
      {/* Highlight Color Palette */}
      {isAuthenticated && (
        <div className="flex items-center gap-1 pr-1.5 border-r border-[var(--wikios-border)]">
          {HIGHLIGHT_PALETTE.map((p) => (
            <button
              key={p.color}
              type="button"
              onClick={() => handleHighlight(p.color)}
              className="w-5 h-5 rounded-full border border-white/20 transition-transform active:scale-90 hover:scale-110 cursor-pointer shadow-xs"
              style={{ backgroundColor: p.color }}
              title={`Note in Margin (${p.label})`}
            />
          ))}
        </div>
      )}

      {/* Action: Comment / Discuss */}
      <button
        type="button"
        onClick={handleComment}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)] hover:bg-[var(--wikios-border)] active:scale-[0.97] transition-all cursor-pointer"
        title="Discuss in Margin"
      >
        <MessageSquare className="w-3.5 h-3.5 text-[var(--wikios-accent)]" />
        <span>Discuss</span>
      </button>

      {/* Action: Stash Quote */}
      {isAuthenticated && (
        <button
          type="button"
          onClick={handleStash}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)] hover:bg-[var(--wikios-border)] active:scale-[0.97] transition-all cursor-pointer"
          title="Clip quote to Stash"
        >
          <Bookmark className="w-3.5 h-3.5 text-rose-400" />
          <span>Stash</span>
        </button>
      )}

      {/* Action: Copy Text */}
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] hover:bg-[var(--wikios-border)] active:scale-[0.97] transition-all cursor-pointer"
        title="Copy quote"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>,
    document.body
  );
}
