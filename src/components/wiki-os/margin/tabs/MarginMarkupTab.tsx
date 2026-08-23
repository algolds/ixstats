// src/components/wiki-os/margin/tabs/MarginMarkupTab.tsx
// Displays active text annotations and stashed quotes with jump-to-text scrolling,
// child page creation, export notes, and message sharing.
// Signature Highlighter Yellow / Warm Amber branding for Margin.

"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  DesignPencil as Highlighter,
  Trash as Trash2,
  ArrowUpRight,
  ChatBubble as MessageSquare,
  Bookmark,
  Copy,
  Check,
  ShareAndroid as Share2,
  Page as FileText,
  Leaf as Sprout,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";
import { MarginShareModal } from "../modals/MarginShareModal";

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
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
  themeColors?: ThemeColors | null;
}

export function MarginMarkupTab({
  articleTitle,
  contentRef,
  isAuthenticated,
  selectedAnnotationId,
  onSelectAnnotation,
  themeColors,
}: MarginMarkupTabProps) {
  const notify = useNotify();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ quote: string; note?: string | null } | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const primaryColor = themeColors?.primary || "var(--wikios-accent, #fef036)";

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

  // Scroll to selected annotation if passed
  useEffect(() => {
    if (selectedAnnotationId && itemRefs.current[selectedAnnotationId]) {
      itemRefs.current[selectedAnnotationId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedAnnotationId]);

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

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      soundEffects.press();
      setCopiedId(id);
      notify.success("Quote copied to clipboard");
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      notify.error("Failed to copy");
    }
  };

  const handleExportAllMarkdown = async () => {
    if (annotations.length === 0) return;
    const slug = encodeURIComponent(articleTitle.replace(/ /g, "_"));
    const markdownLines = [
      `# Notes and quotes: [[${articleTitle}]]`,
      `*Source: https://ixwiki.com/wiki/${slug}*\n`,
    ];

    annotations.forEach((ann, idx) => {
      markdownLines.push(`### Excerpt ${idx + 1}`);
      markdownLines.push(`> "${ann.selectedText}"`);
      if (ann.comment && ann.comment !== "Saved quote") {
        markdownLines.push(`\n*Note: ${ann.comment}*`);
      }
      markdownLines.push("");
    });

    try {
      await navigator.clipboard.writeText(markdownLines.join("\n"));
      soundEffects.success();
      setCopiedAll(true);
      notify.success("Notes copied to clipboard");
      setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      notify.error("Failed to export notes");
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Header Info & Export Action */}
      <div className="flex items-center justify-between border-b border-[var(--wikios-border)] pb-2 text-xs text-[var(--wikios-text-muted)]">
        <span className="font-semibold text-[var(--wikios-text)] text-[11px] tracking-tight">
          Highlights and notes ({annotations.length})
        </span>

        {annotations.length > 0 && (
          <button
            type="button"
            onClick={handleExportAllMarkdown}
            className="flex items-center gap-1 text-[10.5px] font-bold text-stone-950 bg-margin-accent hover:bg-margin-accent/90 border border-yellow-400/50 px-2.5 py-0.5 rounded-lg active:scale-95 transition-all duration-150 cursor-pointer shadow-xs"
          >
            {copiedAll ? (
              <>
                <Check className="w-3 h-3 text-emerald-900" />
                <span>Exported</span>
              </>
            ) : (
              <>
                <FileText className="w-3 h-3" />
                <span>Export notes</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-[var(--wikios-text-muted)]">
          <div
            className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"
          />
          <span className="text-xs">Loading highlights...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && annotations.length === 0 && (
        <div className="py-12 text-center text-[var(--wikios-text-muted)] space-y-1.5">
          <div className="w-10 h-10 rounded-2xl bg-margin-accent/20 border border-yellow-400/50 flex items-center justify-center mx-auto mb-2.5 text-yellow-600 dark:text-margin-accent shadow-xs">
            <Highlighter className="w-5 h-5 opacity-90" />
          </div>
          <p className="text-xs font-bold text-[var(--wikios-text)] tracking-tight">No highlights yet</p>
          <p className="text-[11px] text-[var(--wikios-text-dim)] max-w-xs mx-auto leading-relaxed">
            Select any paragraph or sentence in the article to highlight, note, or save a quote.
          </p>
        </div>
      )}

      {/* Annotation List */}
      {!isLoading && annotations.length > 0 && (
        <div className="space-y-2.5">
          {annotations.map((ann) => {
            const isSelected = selectedAnnotationId === ann.id;
            const isStashedQuote = ann.comment === "Saved quote";
            const swatchColor = ann.color || "#fef036";
            const sproutChildSlug = encodeURIComponent(
              ann.selectedText.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 35).trim().replace(/ /g, "_")
            );

            return (
              <div
                key={ann.id}
                ref={(el) => {
                  itemRefs.current[ann.id] = el;
                }}
                onClick={() => onSelectAnnotation?.(ann.id)}
                className={cn(
                  "relative rounded-2xl border bg-[var(--wikios-card-bg)]/80 shadow-xs transition-[border-color,box-shadow,background-color,transform] duration-150 space-y-2 group backdrop-blur-md cursor-pointer overflow-hidden p-3 active:scale-[0.985]",
                  isSelected
                    ? "border-yellow-400/80 shadow-[0_0_20px_rgba(254,240,54,0.35)] ring-1 ring-yellow-400/50"
                    : "border-[var(--wikios-border)] hover:border-yellow-400/50 hover:shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
                )}
              >
                {/* Accent Color Left Edge Bar with Fluorescent Highlighter Aura */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl shadow-xs transition-colors"
                  style={{ backgroundColor: swatchColor, boxShadow: `0 0 8px ${swatchColor}60` }}
                />

                {/* Top Metadata Row: Swatch indicator, Type tag, Actions */}
                <div className="flex items-center justify-between gap-1 text-[10px] pl-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0 shadow-xs ring-1 ring-white/20"
                      style={{ backgroundColor: swatchColor }}
                    />
                    {isStashedQuote ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-rose-500/15 border border-rose-500/25 text-rose-400 font-bold text-[9px] uppercase tracking-wider">
                        <Bookmark className="w-2.5 h-2.5" /> Quote
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-bold text-[var(--wikios-text-dim)] uppercase tracking-wider">
                        Highlight
                      </span>
                    )}
                  </div>

                  {/* Micro Actions (Visible on hover or mobile) */}
                  <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShareTarget({ quote: ann.selectedText, note: ann.comment });
                      }}
                      className="p-1 rounded-lg text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] hover:bg-white/10 active:scale-90 transition-all duration-150 cursor-pointer"
                      title="Share and export"
                    >
                      <Share2 className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(ann.id, ann.selectedText);
                      }}
                      className="p-1 rounded-lg text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] hover:bg-white/10 active:scale-90 transition-all duration-150 cursor-pointer"
                      title="Copy quote"
                    >
                      {copiedId === ann.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>

                    {isAuthenticated && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAnnotationMutation.mutate({ id: ann.id });
                        }}
                        disabled={deleteAnnotationMutation.isPending}
                        className="p-1 rounded-lg text-[var(--wikios-text-dim)] hover:text-rose-400 hover:bg-rose-500/10 active:scale-90 transition-all duration-150 cursor-pointer"
                        title="Delete highlight"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Excerpt Quote Text */}
                <p className="text-[11.5px] italic text-[var(--wikios-text)] leading-relaxed pl-1">
                  &ldquo;{ann.selectedText}&rdquo;
                </p>

                {/* User Note if present */}
                {ann.comment && !isStashedQuote && (
                  <div className="ml-1 p-2 rounded-xl bg-[var(--wikios-surface)]/80 border border-yellow-400/40 text-[11px] text-[var(--wikios-text-muted)] space-y-0.5 shadow-2xs">
                    <div className="flex items-center gap-1 text-[9.5px] font-bold text-[var(--wikios-text)]">
                      <MessageSquare className="w-2.5 h-2.5 text-yellow-600 dark:text-margin-accent" />
                      <span>Lore Significance</span>
                    </div>
                    <p className="italic leading-snug">{ann.comment}</p>
                  </div>
                )}

                {/* Bottom Action Strip */}
                <div className="flex items-center justify-between text-[10.5px] pt-1 border-t border-[var(--wikios-border)]/50">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJumpToText(ann.selectedText);
                    }}
                    className="flex items-center gap-1 font-bold text-[var(--wikios-text)] hover:text-yellow-600 dark:hover:text-margin-accent active:scale-95 transition-transform duration-100 cursor-pointer group/jump"
                  >
                    <span>Jump to text</span>
                    <ArrowUpRight className="w-3 h-3 group-hover/jump:translate-x-0.5 group-hover/jump:-translate-y-0.5 transition-transform text-yellow-600 dark:text-margin-accent" />
                  </button>

                  <Link
                    href={`/wiki/edit/${sproutChildSlug}?parent=${encodeURIComponent(articleTitle)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-transform duration-100 cursor-pointer font-semibold shadow-2xs"
                    title="Create a new page from this quote"
                  >
                    <Sprout className="w-2.5 h-2.5" />
                    <span>Create page</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share Modal Dialog */}
      {shareTarget && (
        <MarginShareModal
          isOpen={!!shareTarget}
          onClose={() => setShareTarget(null)}
          articleTitle={articleTitle}
          quoteText={shareTarget.quote}
          commentNote={shareTarget.note}
          isAuthenticated={isAuthenticated}
        />
      )}
    </div>
  );
}
