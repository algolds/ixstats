// src/components/wiki-os/margin/SelectionCapsule.tsx
// Origin-aware floating selection capsule for inline markup, stash, suggested edits, and discussions.
// Full Apple Design & Emil Kowalski motion compliance.

"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ChatBubble as MessageSquare,
  Bookmark,
  Check,
  Copy,
  DesignPencil as Edit3,
  ShareAndroid as Share2,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";

export const HIGHLIGHT_PALETTE = [
  { color: "#fef036", label: "Yellow (Purpose)" },
  { color: "#4ade80", label: "Green (Geography)" },
  { color: "#38bdf8", label: "Blue (History)" },
  { color: "#fb7185", label: "Pink (Critical)" },
  { color: "#fb923c", label: "Orange (Customs)" },
  { color: "#c084fc", label: "Lavender (Figures)" },
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
  onSuggestEdit?: (payload: SelectionPayload) => void;
  onStashQuote?: (payload: SelectionPayload) => void;
  onShareQuote?: (payload: SelectionPayload) => void;
  isAuthenticated: boolean;
}

export function SelectionCapsule({
  contentRef,
  onAddHighlight,
  onOpenThreadDraft,
  onSuggestEdit,
  onStashQuote,
  onShareQuote,
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

  const handleSuggest = () => {
    if (!selectionData) return;
    soundEffects.press();
    if (onSuggestEdit) {
      onSuggestEdit(selectionData);
    } else {
      onOpenThreadDraft?.(selectionData);
    }
    clearSelection();
  };

  const handleStash = () => {
    if (!selectionData) return;
    soundEffects.press();
    onStashQuote?.(selectionData);
    clearSelection();
  };

  const handleShare = () => {
    if (!selectionData) return;
    soundEffects.press();
    onShareQuote?.(selectionData);
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
        "flex items-center gap-1 p-1 rounded-2xl border border-[var(--wikios-border)] shadow-[0_12px_36px_rgba(0,0,0,0.4)] backdrop-blur-2xl transition-transform duration-100 select-none animate-in fade-in zoom-in-95",
        "bg-[var(--wikios-surface)]/95 text-[var(--wikios-text)]"
      )}
    >
      {/* Highlight Color Palette */}
      {isAuthenticated && (
        <div className="flex items-center gap-1 pr-1.5 border-r border-[var(--wikios-border)] pl-0.5">
          {HIGHLIGHT_PALETTE.map((p) => (
            <button
              key={p.color}
              type="button"
              onClick={() => handleHighlight(p.color)}
              className="w-4.5 h-4.5 rounded-full border border-white/25 transition-transform duration-100 active:scale-85 hover:scale-110 cursor-pointer shadow-xs"
              style={{ backgroundColor: p.color }}
              title={`Highlight (${p.label})`}
            />
          ))}
        </div>
      )}

      {/* Action: Comment / Discuss */}
      <button
        type="button"
        onClick={handleComment}
        className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)] hover:bg-[var(--wikios-border)] active:scale-95 transition-transform duration-100 cursor-pointer"
        title="Discuss"
      >
        <MessageSquare className="w-3.5 h-3.5 text-[#fef036]" />
        <span>Discuss</span>
      </button>

      {/* Action: Suggest Edit */}
      {isAuthenticated && (
        <button
          type="button"
          onClick={handleSuggest}
          className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)] hover:bg-[var(--wikios-border)] active:scale-95 transition-transform duration-100 cursor-pointer"
          title="Suggest edit"
        >
          <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Suggest edit</span>
        </button>
      )}

      {/* Action: Stash Quote */}
      {isAuthenticated && (
        <button
          type="button"
          onClick={handleStash}
          className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)] hover:bg-[var(--wikios-border)] active:scale-95 transition-transform duration-100 cursor-pointer"
          title="Save quote"
        >
          <Bookmark className="w-3.5 h-3.5 text-rose-400" />
          <span>Stash</span>
        </button>
      )}

      {/* Action: Share / Dispatch */}
      <button
        type="button"
        onClick={handleShare}
        className="p-1 rounded-xl text-[var(--wikios-text-dim)] hover:text-[#fef036] hover:bg-[var(--wikios-border)] active:scale-95 transition-transform duration-100 cursor-pointer"
        title="Share quote"
      >
        <Share2 className="w-3.5 h-3.5" />
      </button>

      {/* Action: Copy Text */}
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 rounded-xl text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] hover:bg-[var(--wikios-border)] active:scale-95 transition-transform duration-100 cursor-pointer"
        title="Copy text"
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
