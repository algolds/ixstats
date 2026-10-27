"use client";
// Origin-aware floating selection capsule for inline markup, stash, suggested edits, and discussions.
import React, { useEffect, useState, useCallback } from "react";
import {
  ChatBubble as MessageSquare,
  Bookmark,
  Check,
  Copy,
  DesignPencil as Edit3,
  ShareAndroid as Share2,
} from "iconoir-react";
import { VirtualAnchorPopover } from "~/components/ui/popover";
import { useNotify } from "~/hooks/useNotify";

const HIGHLIGHT_PALETTE = [
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
  const [selection, setSelection] = useState<{ payload: SelectionPayload; range: Range } | null>(
    null
  );
  const selectionData = selection?.payload ?? null;
  const [copied, setCopied] = useState(false);
  const notify = useNotify();

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const handleSelectionChange = useCallback(() => {
    if (typeof window === "undefined") return;
    const container = contentRef.current;
    if (!container) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSelection(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) {
      setSelection(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setSelection(null);
      return;
    }

    // The capsule follows a copy of the range, so it stays on the text as the page scrolls.
    setSelection({ payload: { text, rect }, range: range.cloneRange() });
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
    onAddHighlight?.(selectionData, color);
    clearSelection();
  };

  const handleComment = () => {
    if (!selectionData) return;
    onOpenThreadDraft?.(selectionData);
    clearSelection();
  };

  const handleSuggest = () => {
    if (!selectionData) return;
    if (onSuggestEdit) {
      onSuggestEdit(selectionData);
    } else {
      onOpenThreadDraft?.(selectionData);
    }
    clearSelection();
  };

  const handleStash = () => {
    if (!selectionData) return;
    onStashQuote?.(selectionData);
    clearSelection();
  };

  const handleShare = () => {
    if (!selectionData) return;
    onShareQuote?.(selectionData);
    clearSelection();
  };

  const handleCopy = async () => {
    if (!selectionData) return;
    try {
      await navigator.clipboard.writeText(selectionData.text);
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

  return (
    // Anchored to the text selection (a virtual anchor): centred above it, flipping below when
    // there is no room. Keeps focus (and the selection) in the article.
    <VirtualAnchorPopover
      anchor={selection?.range ?? null}
      onOpenChange={(open) => {
        if (!open) clearSelection();
      }}
      side="top"
      sideOffset={12}
      role="toolbar"
      aria-label="Selection actions"
      className="flex w-auto items-center gap-1 rounded-full p-1 select-none"
    >
      {/* Highlight Color Palette */}
      {isAuthenticated && (
        <div className="border-separator flex items-center gap-1 border-r pr-2 pl-0.5">
          {HIGHLIGHT_PALETTE.map((p) => (
            <button
              key={p.color}
              type="button"
              onClick={() => handleHighlight(p.color)}
              className="border-separator duration-fast size-5 cursor-pointer rounded-full border"
              style={{ backgroundColor: p.color }}
              title={`Highlight (${p.label})`}
              aria-label={`Highlight (${p.label})`}
            />
          ))}
        </div>
      )}

      {/* Action: Comment / Discuss */}
      <button
        type="button"
        onClick={handleComment}
        className="text-caption text-label duration-fast hover:bg-fill-3 flex h-7 cursor-pointer items-center gap-1 rounded-full px-3 transition-[background-color,transform]"
        title="Discuss"
      >
        <MessageSquare className="text-margin-accent h-3.5 w-3.5" />
        <span>Discuss</span>
      </button>

      {/* Action: Suggest Edit */}
      {isAuthenticated && (
        <button
          type="button"
          onClick={handleSuggest}
          className="text-caption text-label duration-fast hover:bg-fill-3 flex h-7 cursor-pointer items-center gap-1 rounded-full px-3 transition-[background-color,transform]"
          title="Suggest edit"
        >
          <Edit3 className="text-teal h-3.5 w-3.5" />
          <span>Suggest edit</span>
        </button>
      )}

      {/* Action: Stash Quote */}
      {isAuthenticated && (
        <button
          type="button"
          onClick={handleStash}
          className="text-caption text-label duration-fast hover:bg-fill-3 flex h-7 cursor-pointer items-center gap-1 rounded-full px-3 transition-[background-color,transform]"
          title="Save quote"
        >
          <Bookmark className="text-red h-3.5 w-3.5" />
          <span>Stash</span>
        </button>
      )}

      {/* Action: Share / Dispatch */}
      <button
        type="button"
        onClick={handleShare}
        className="text-label-secondary duration-fast hover:bg-fill-3 hover:text-label flex size-7 cursor-pointer items-center justify-center rounded-full transition-[background-color,color,transform]"
        title="Share quote"
        aria-label="Share quote"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>

      {/* Action: Copy Text */}
      <button
        type="button"
        onClick={handleCopy}
        className="text-label-secondary duration-fast hover:bg-fill-3 hover:text-label flex size-7 cursor-pointer items-center justify-center rounded-full transition-[background-color,color,transform]"
        title="Copy text"
        aria-label="Copy text"
      >
        {copied ? <Check className="text-green h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </VirtualAnchorPopover>
  );
}
