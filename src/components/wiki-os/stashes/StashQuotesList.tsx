"use client";
// Dedicated Quotes & Highlights view for the Stash system.
// Features quote card styling, parent article pills, copy actions, and jump-to-article anchors.

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, ArrowUpRight, ChatBubble as MessageSquare, Clock } from "iconoir-react";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";

import { useNotify } from "~/hooks/useNotify";
import type { StashedQuoteItem } from "./types";
import { Button } from "~/components/ui/button";

interface StashQuotesListProps {
  quotes: StashedQuoteItem[];
}

export function StashQuotesList({ quotes }: StashQuotesListProps) {
  const notify = useNotify();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyQuote = async (e: React.MouseEvent, id: string, text: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      notify.success("Quote copied to clipboard");
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      notify.error("Failed to copy quote");
    }
  };

  return (
    <div className="space-y-3">
      {quotes.map((q) => {
        const cleanArticleTitle = q.pageTitle.replace(/_/g, " ");
        const swatchColor = q.color || "#fef036";

        return (
          <div
            key={q.id}
            className="group rounded-card border-separator bg-surface hover:border-separator hover:bg-surface hover:shadow-card relative flex flex-col gap-2 overflow-hidden border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200"
          >
            {/* Left Highlighter Ink Bar */}
            <div
              className="rounded-l-card absolute top-0 bottom-0 left-0 w-1.5"
              style={{
                backgroundColor: swatchColor,
                boxShadow: `0 0 10px ${swatchColor}60`,
              }}
            />

            {/* Top Row: Parent Article Link + Copy/Jump Actions */}
            <div className="flex items-center justify-between gap-2 pl-2">
              <Link
                href={`/wiki/${q.pageSlug}`}
                className="text-caption text-label hover:text-tint flex max-w-sm items-center gap-2 truncate font-semibold transition-colors"
              >
                <WikiOSLogomark className="text-tint h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{cleanArticleTitle}</span>
              </Link>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleCopyQuote(e, q.id, q.selectedText)}
                  title="Copy quote"
                  className="bg-fill-4 text-label-secondary hover:text-label gap-1 px-2"
                >
                  {copiedId === q.id ? (
                    <>
                      <Check className="text-green h-3 w-3" />
                      <span className="text-green">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>

                <Link
                  href={`/wiki/${q.pageSlug}`}
                  className="rounded-row border-separator bg-fill-4 text-label-secondary hover:bg-fill-4 hover:text-label flex h-7 w-7 items-center justify-center border transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                  title="Open article"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Excerpt Quote Text */}
            <div className="pt-0.5 pl-2">
              <blockquote className="border-separator text-callout text-label border-l-2 py-0.5 pl-3 font-[family-name:var(--wikios-font-reading)] italic">
                &ldquo;{q.selectedText}&rdquo;
              </blockquote>
            </div>

            {/* Lore Significance Note if present */}
            {q.comment && q.comment !== "Saved quote" && (
              <div className="rounded-row border-separator bg-surface text-footnote text-label-secondary ml-2 space-y-0.5 border p-3">
                <div className="text-caption text-label flex items-center gap-1 font-semibold">
                  <MessageSquare className="text-tint h-3 w-3" />
                  <span>Lore note</span>
                </div>
                <p className="leading-relaxed italic">{q.comment}</p>
              </div>
            )}

            {/* Timestamp */}
            <div className="text-footnote text-label-secondary flex items-center gap-1 pt-0.5 pl-2">
              <Clock className="h-2.5 w-2.5" />
              <span>
                Saved on{" "}
                {new Date(q.savedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
