"use client";
// src/components/wiki-os/margin/tabs/MarginMarkupTab.tsx
// Displays active text annotations and stashed quotes with jump-to-text scrolling,
// child page creation, export notes, and message sharing.
// Signature Highlighter Yellow / Warm Amber branding for Margin.

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
  const [shareTarget, setShareTarget] = useState<{ quote: string; note?: string | null } | null>(
    null
  );
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // oxlint-disable-next-line eslint/no-unused-vars
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
    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT, null);
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
        <span className="text-[11px] font-semibold tracking-tight text-[var(--wikios-text)]">
          Highlights and notes ({annotations.length})
        </span>

        {annotations.length > 0 && (
          <button
            type="button"
            onClick={handleExportAllMarkdown}
            className="bg-margin-accent hover:bg-margin-accent/90 flex cursor-pointer items-center gap-1 rounded-lg border border-yellow-400/50 px-2.5 py-0.5 text-[10.5px] font-bold text-stone-950 shadow-xs transition-all duration-150 active:scale-95"
          >
            {copiedAll ? (
              <>
                <Check className="h-3 w-3 text-emerald-900" />
                <span>Exported</span>
              </>
            ) : (
              <>
                <FileText className="h-3 w-3" />
                <span>Export notes</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-[var(--wikios-text-muted)]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
          <span className="text-xs">Loading highlights...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && annotations.length === 0 && (
        <div className="space-y-1.5 py-12 text-center text-[var(--wikios-text-muted)]">
          <div className="bg-margin-accent/20 dark:text-margin-accent mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-yellow-400/50 text-yellow-600 shadow-xs">
            <Highlighter className="h-5 w-5 opacity-90" />
          </div>
          <p className="text-xs font-bold tracking-tight text-[var(--wikios-text)]">
            No highlights yet
          </p>
          <p className="mx-auto max-w-xs text-[11px] leading-relaxed text-[var(--wikios-text-dim)]">
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
              ann.selectedText
                .replace(/[^a-zA-Z0-9 ]/g, "")
                .slice(0, 35)
                .trim()
                .replace(/ /g, "_")
            );

            return (
              <div
                key={ann.id}
                ref={(el) => {
                  itemRefs.current[ann.id] = el;
                }}
                onClick={() => onSelectAnnotation?.(ann.id)}
                className={cn(
                  "group relative cursor-pointer space-y-2 overflow-hidden rounded-2xl border bg-[var(--wikios-card-bg)]/80 p-3 shadow-xs backdrop-blur-md transition-[border-color,box-shadow,background-color,transform] duration-150 active:scale-[0.985]",
                  isSelected
                    ? "border-yellow-400/80 shadow-[0_0_20px_rgba(254,240,54,0.35)] ring-1 ring-yellow-400/50"
                    : "border-[var(--wikios-border)] hover:border-yellow-400/50 hover:shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
                )}
              >
                {/* Accent Color Left Edge Bar with Fluorescent Highlighter Aura */}
                <div
                  className="absolute top-0 bottom-0 left-0 w-1 rounded-l-2xl shadow-xs transition-colors"
                  style={{ backgroundColor: swatchColor, boxShadow: `0 0 8px ${swatchColor}60` }}
                />

                {/* Top Metadata Row: Swatch indicator, Type tag, Actions */}
                <div className="flex items-center justify-between gap-1 pl-1 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full shadow-xs ring-1 ring-white/20"
                      style={{ backgroundColor: swatchColor }}
                    />
                    {isStashedQuote ? (
                      <span className="py-0.2 flex items-center gap-1 rounded-md border border-rose-500/25 bg-rose-500/15 px-1.5 text-[9px] font-bold tracking-wider text-rose-400 uppercase">
                        <Bookmark className="h-2.5 w-2.5" /> Quote
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-bold tracking-wider text-[var(--wikios-text-dim)] uppercase">
                        Highlight
                      </span>
                    )}
                  </div>

                  {/* Micro Actions (Visible on hover or mobile) */}
                  <div className="flex items-center gap-0.5 opacity-80 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShareTarget({ quote: ann.selectedText, note: ann.comment });
                      }}
                      className="cursor-pointer rounded-lg p-1 text-[var(--wikios-text-dim)] transition-all duration-150 hover:bg-white/10 hover:text-[var(--wikios-text)] active:scale-90"
                      title="Share and export"
                    >
                      <Share2 className="h-3 w-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(ann.id, ann.selectedText);
                      }}
                      className="cursor-pointer rounded-lg p-1 text-[var(--wikios-text-dim)] transition-all duration-150 hover:bg-white/10 hover:text-[var(--wikios-text)] active:scale-90"
                      title="Copy quote"
                    >
                      {copiedId === ann.id ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
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
                        className="cursor-pointer rounded-lg p-1 text-[var(--wikios-text-dim)] transition-all duration-150 hover:bg-rose-500/10 hover:text-rose-400 active:scale-90"
                        title="Delete highlight"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Excerpt Quote Text */}
                <p className="pl-1 text-[11.5px] leading-relaxed text-[var(--wikios-text)] italic">
                  &ldquo;{ann.selectedText}&rdquo;
                </p>

                {/* User Note if present */}
                {ann.comment && !isStashedQuote && (
                  <div className="ml-1 space-y-0.5 rounded-xl border border-yellow-400/40 bg-[var(--wikios-surface)]/80 p-2 text-[11px] text-[var(--wikios-text-muted)] shadow-2xs">
                    <div className="flex items-center gap-1 text-[9.5px] font-bold text-[var(--wikios-text)]">
                      <MessageSquare className="dark:text-margin-accent h-2.5 w-2.5 text-yellow-600" />
                      <span>Lore Significance</span>
                    </div>
                    <p className="leading-snug italic">{ann.comment}</p>
                  </div>
                )}

                {/* Bottom Action Strip */}
                <div className="flex items-center justify-between border-t border-[var(--wikios-border)]/50 pt-1 text-[10.5px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJumpToText(ann.selectedText);
                    }}
                    className="dark:hover:text-margin-accent group/jump flex cursor-pointer items-center gap-1 font-bold text-[var(--wikios-text)] transition-transform duration-100 hover:text-yellow-600 active:scale-95"
                  >
                    <span>Jump to text</span>
                    <ArrowUpRight className="dark:text-margin-accent h-3 w-3 text-yellow-600 transition-transform group-hover/jump:translate-x-0.5 group-hover/jump:-translate-y-0.5" />
                  </button>

                  <Link
                    href={`/wiki/edit/${sproutChildSlug}?parent=${encodeURIComponent(articleTitle)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-400 shadow-2xs transition-transform duration-100 hover:bg-emerald-500/20 active:scale-95"
                    title="Create a new page from this quote"
                  >
                    <Sprout className="h-2.5 w-2.5" />
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
