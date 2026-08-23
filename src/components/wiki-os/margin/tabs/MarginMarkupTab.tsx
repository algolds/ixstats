// src/components/wiki-os/margin/tabs/MarginMarkupTab.tsx
// Displays active text annotations and highlights with jump-to-text scrolling and theme compliance.

"use client";

import React, { useState, useEffect } from "react";
import {
  DesignPencil as Highlighter,
  Trash as Trash2,
  ArrowUpRight,
  ChatBubble as MessageSquare,
  Xmark as X,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";

interface AnnotationItem {
  id: string;
  selectedText: string;
  comment: string | null;
  color: string;
  createdAt: Date;
}

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface MarginMarkupTabProps {
  articleTitle: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  isAuthenticated: boolean;
  themeColors?: ThemeColors | null;
}

export function MarginMarkupTab({
  articleTitle,
  contentRef,
  isAuthenticated,
  themeColors,
}: MarginMarkupTabProps) {
  const notify = useNotify();
  const [guideVisible, setGuideVisible] = useState(false);
  const primaryColor = themeColors?.primary || "var(--wikios-accent, #3b82f6)";

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("wikios_margin_guide_dismissed");
      if (!dismissed) {
        setGuideVisible(true);
      }
    } catch {}
  }, []);

  const dismissGuide = () => {
    soundEffects.press();
    setGuideVisible(false);
    try {
      localStorage.setItem("wikios_margin_guide_dismissed", "true");
    } catch {}
  };

  const {
    data: annotationsData,
    isLoading,
    refetch,
  } = api.wikios.getAnnotations.useQuery(
    { pageTitle: articleTitle },
    { enabled: !!articleTitle, staleTime: 15_000 }
  );

  const deleteAnnotationMutation = api.wikios.deleteAnnotation.useMutation({
    onSuccess: () => {
      soundEffects.release();
      notify.success("Highlight removed");
      refetch();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to remove highlight");
    },
  });

  const annotations: AnnotationItem[] = (annotationsData as any) || [];

  const handleJumpToText = (textSnippet: string) => {
    if (!contentRef.current) return;
    soundEffects.press();
    const snippet = textSnippet.slice(0, 35);
    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent && node.textContent.includes(snippet)) {
        const parent = node.parentElement;
        if (parent) {
          parent.scrollIntoView({ behavior: "smooth", block: "center" });
          parent.classList.add("wikios-anchor-highlighted");
          setTimeout(() => {
            parent.classList.remove("wikios-anchor-highlighted");
          }, 2000);
          return;
        }
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* First-Use Only Interactive Discovery Card */}
      {guideVisible && (
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-500/10 to-transparent backdrop-blur-md p-3 space-y-2 animate-in fade-in zoom-in-95 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/20 text-[11px] font-bold text-purple-300">
                🖍️
              </span>
              <span className="text-xs font-bold text-[var(--wikios-text)]">
                Markup & Highlights
              </span>
            </div>
            <button
              type="button"
              onClick={dismissGuide}
              className="text-[10px] font-bold text-purple-300 hover:text-white px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/25 cursor-pointer transition-all active:scale-95"
            >
              Got it
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
            <div className="p-2 rounded-xl bg-[var(--wikios-card-bg)]/80 border border-[var(--wikios-border)] space-y-0.5">
              <p className="font-semibold text-[var(--wikios-text)]">1. Palette Swatches</p>
              <p className="text-[10px] text-[var(--wikios-text-dim)] leading-tight">
                Select prose to reveal 4 color highlight swatches.
              </p>
            </div>
            <div className="p-2 rounded-xl bg-[var(--wikios-card-bg)]/80 border border-[var(--wikios-border)] space-y-0.5">
              <p className="font-semibold text-[var(--wikios-text)]">2. Jump to Text</p>
              <p className="text-[10px] text-[var(--wikios-text-dim)] leading-tight">
                Click &ldquo;Jump to text&rdquo; to scroll straight to the passage.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-[var(--wikios-border)] pb-2.5 text-xs text-[var(--wikios-text-muted)]">
        <span className="font-semibold text-[var(--wikios-text)]">
          Text Highlights ({annotations.length})
        </span>
        <span className="text-[10px] text-[var(--wikios-text-dim)]">
          Highlight text in article to add
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-[var(--wikios-text-muted)]">
          <div
            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: primaryColor, borderTopColor: "transparent" }}
          />
          <span className="text-xs">Loading annotations...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && annotations.length === 0 && (
        <div className="py-12 text-center text-[var(--wikios-text-muted)] space-y-1.5">
          <Highlighter className="w-8 h-8 text-[var(--wikios-text-dim)] mx-auto mb-2" />
          <p className="text-xs font-semibold text-[var(--wikios-text)]">No text annotations yet</p>
          <p className="text-[11px] text-[var(--wikios-text-dim)] max-w-xs mx-auto">
            Select any paragraph or sentence in the article to highlight and leave inline notes.
          </p>
        </div>
      )}

      {/* Annotation List */}
      {!isLoading && annotations.length > 0 && (
        <div className="space-y-2">
          {annotations.map((ann) => (
            <div
              key={ann.id}
              className="p-3 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/70 shadow-xs hover:border-purple-500/40 hover:shadow-[0_0_15px_rgba(168,85,247,0.08)] transition-all space-y-2 group backdrop-blur-md"
            >
              {/* Top Quote with Swatch */}
              <div className="flex items-start gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-1 shadow-xs"
                  style={{ backgroundColor: ann.color || "#fbbf24" }}
                />
                <p className="flex-1 text-[11.5px] italic text-[var(--wikios-text)] line-clamp-2 leading-snug">
                  &ldquo;{ann.selectedText}&rdquo;
                </p>
              </div>

              {/* User Note if present */}
              {ann.comment && (
                <div className="pl-3 border-l border-[var(--wikios-border)] text-[11px] text-[var(--wikios-text-muted)]">
                  <div className="flex items-center gap-1 text-[9.5px] font-semibold text-[var(--wikios-text-dim)] mb-0.5">
                    <MessageSquare className="w-2.5 h-2.5" />
                    <span>Note</span>
                  </div>
                  {ann.comment}
                </div>
              )}

              {/* Actions: Jump & Delete */}
              <div className="flex items-center justify-between pt-1.5 border-t border-[var(--wikios-border)] text-[10px]">
                <button
                  type="button"
                  onClick={() => handleJumpToText(ann.selectedText)}
                  className="flex items-center gap-1 font-semibold text-purple-400 hover:text-purple-300 cursor-pointer transition-colors"
                >
                  <span>Jump to text</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>

                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => deleteAnnotationMutation.mutate({ id: ann.id })}
                    disabled={deleteAnnotationMutation.isPending}
                    className="text-[var(--wikios-text-dim)] hover:text-rose-400 p-0.5 rounded cursor-pointer transition-colors"
                    title="Delete highlight"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
