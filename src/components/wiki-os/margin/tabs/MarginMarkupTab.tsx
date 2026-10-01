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
import { soundCues } from "~/lib/sound/cuelume";
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
      soundCues?.success?.();
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
      <div className="border-separator text-footnote text-label-secondary flex items-center justify-between border-b pb-2">
        <span className="text-caption text-label font-semibold">
          Highlights and notes ({annotations.length})
        </span>

        {annotations.length > 0 && (
          <button
            type="button"
            onClick={handleExportAllMarkdown}
            className="bg-margin-accent hover:bg-margin-accent/90 rounded-control border-yellow/50 text-caption flex cursor-pointer items-center gap-1 border px-2.5 py-0.5 font-semibold text-(--margin-badge-text) transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]"
          >
            {copiedAll ? (
              <>
                <Check className="text-green h-3 w-3" />
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
        <div className="text-label-secondary flex flex-col items-center justify-center gap-2 py-12">
          <div className="border-yellow/50 h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-footnote">Loading highlights...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && annotations.length === 0 && (
        <div className="text-label-secondary space-y-1.5 py-12 text-center">
          <div className="bg-margin-accent/20 rounded-card border-yellow/50 text-yellow mx-auto mb-2.5 flex h-10 w-10 items-center justify-center border">
            <Highlighter className="h-5 w-5 opacity-90" />
          </div>
          <p className="text-caption text-label font-semibold">No highlights yet</p>
          <p className="text-footnote text-label-secondary mx-auto max-w-xs leading-relaxed">
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
                  "group rounded-card bg-surface relative cursor-pointer space-y-2 overflow-hidden border p-3 transition-[border-color,box-shadow,background-color,transform] duration-150 active:scale-[0.985]",
                  isSelected
                    ? "border-yellow/80 ring-yellow/50 ring-1"
                    : "border-separator hover:border-yellow/50"
                )}
              >
                {/* Accent Color Left Edge Bar with Fluorescent Highlighter Aura */}
                <div
                  className="rounded-l-card absolute top-0 bottom-0 left-0 w-1 transition-colors"
                  style={{ backgroundColor: swatchColor, boxShadow: `0 0 8px ${swatchColor}60` }}
                />

                {/* Top Metadata Row: Swatch indicator, Type tag, Actions */}
                <div className="text-footnote flex items-center justify-between gap-1 pl-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full ring-1 ring-white/20"
                      style={{ backgroundColor: swatchColor }}
                    />
                    {isStashedQuote ? (
                      <span className="py-0.2 rounded-control-sm border-red/25 bg-red/15 text-eyebrow text-red flex items-center gap-1 border px-1.5">
                        <Bookmark className="h-2.5 w-2.5" /> Quote
                      </span>
                    ) : (
                      <span className="text-eyebrow text-label-secondary">Highlight</span>
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
                      className="rounded-control text-label-secondary hover:bg-fill-4 hover:text-label cursor-pointer p-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]"
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
                      className="rounded-control text-label-secondary hover:bg-fill-4 hover:text-label cursor-pointer p-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]"
                      title="Copy quote"
                    >
                      {copiedId === ann.id ? (
                        <Check className="text-green h-3 w-3" />
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
                        className="rounded-control text-label-secondary hover:bg-red/10 hover:text-red cursor-pointer p-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]"
                        title="Delete highlight"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Excerpt Quote Text */}
                <p className="text-footnote text-label pl-1 leading-relaxed italic">
                  &ldquo;{ann.selectedText}&rdquo;
                </p>

                {/* User Note if present */}
                {ann.comment && !isStashedQuote && (
                  <div className="rounded-row border-yellow/40 bg-surface text-footnote text-label-secondary ml-1 space-y-0.5 border p-2">
                    <div className="text-caption text-label flex items-center gap-1 font-semibold">
                      <MessageSquare className="text-yellow h-2.5 w-2.5" />
                      <span>Lore Significance</span>
                    </div>
                    <p className="leading-snug italic">{ann.comment}</p>
                  </div>
                )}

                {/* Bottom Action Strip */}
                <div className="border-separator text-footnote flex items-center justify-between border-t pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJumpToText(ann.selectedText);
                    }}
                    className="group/jump text-label hover:text-yellow flex cursor-pointer items-center gap-1 font-semibold transition-transform duration-100 active:scale-[0.98]"
                  >
                    <span>Jump to text</span>
                    <ArrowUpRight className="text-yellow h-3 w-3 transition-transform group-hover/jump:translate-x-0.5 group-hover/jump:-translate-y-0.5" />
                  </button>

                  <Link
                    href={`/wiki/edit/${sproutChildSlug}?parent=${encodeURIComponent(articleTitle)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-control border-green/30 bg-green/10 text-green hover:bg-green/20 flex cursor-pointer items-center gap-1 border px-2 py-0.5 font-semibold transition-transform duration-100 active:scale-[0.98]"
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
