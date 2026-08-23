// src/components/wiki-os/stashes/StashQuotesList.tsx
// Dedicated Quotes & Highlights view for the Stash system.
// Features quote card styling, parent article pills, copy actions, and jump-to-article anchors.

"use client";

import { useState } from "react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import {
  Copy,
  Check,
  ArrowUpRight,
  ChatBubble as MessageSquare,
  Clock,
} from "iconoir-react";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";
import type { StashedQuoteItem } from "./types";

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
      soundEffects.press();
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
            className="group relative rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 hover:bg-[var(--wikios-surface)]/90 hover:border-[var(--wikios-border)]/80 shadow-xs hover:shadow-md transition-all duration-200 backdrop-blur-xl p-4 overflow-hidden flex flex-col gap-2.5"
          >
            {/* Left Highlighter Ink Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl shadow-xs"
              style={{
                backgroundColor: swatchColor,
                boxShadow: `0 0 10px ${swatchColor}60`,
              }}
            />

            {/* Top Row: Parent Article Link + Copy/Jump Actions */}
            <div className="flex items-center justify-between gap-2 pl-2">
              <Link
                href={withBasePath(`/wiki/${q.pageSlug}`)}
                onClick={() => soundEffects.press()}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--wikios-text)] hover:text-[var(--wikios-accent)] transition-colors truncate max-w-sm"
              >
                <WikiOSLogomark className="h-3.5 w-3.5 text-[var(--wikios-accent)] shrink-0" />
                <span className="truncate">{cleanArticleTitle}</span>
              </Link>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleCopyQuote(e, q.id, q.selectedText)}
                  className="h-7 px-2 flex items-center gap-1 rounded-xl bg-white/5 border border-[var(--wikios-border)] text-[11px] font-semibold text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] hover:bg-white/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                  title="Copy quote"
                >
                  {copiedId === q.id ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <Link
                  href={withBasePath(`/wiki/${q.pageSlug}`)}
                  onClick={() => soundEffects.press()}
                  className="h-7 w-7 flex items-center justify-center rounded-xl bg-white/5 border border-[var(--wikios-border)] text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] hover:bg-white/10 active:scale-95 transition-all shadow-2xs"
                  title="Open article"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Excerpt Quote Text */}
            <div className="pl-2 pt-0.5">
              <blockquote className="text-[12.5px] italic text-[var(--wikios-text)] leading-relaxed font-serif pl-3 border-l-2 border-[var(--wikios-border)] py-0.5">
                &ldquo;{q.selectedText}&rdquo;
              </blockquote>
            </div>

            {/* Lore Significance Note if present */}
            {q.comment && q.comment !== "Saved quote" && (
              <div className="ml-2 p-2.5 rounded-xl bg-[var(--wikios-surface)]/70 border border-[var(--wikios-border)] text-[11px] text-[var(--wikios-text-muted)] space-y-0.5 shadow-2xs">
                <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--wikios-text)]">
                  <MessageSquare className="w-3 h-3 text-purple-400" />
                  <span>Lore Note</span>
                </div>
                <p className="italic leading-relaxed">{q.comment}</p>
              </div>
            )}

            {/* Timestamp */}
            <div className="flex items-center gap-1 text-[10px] text-[var(--wikios-text-dim)] pl-2 pt-0.5">
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
