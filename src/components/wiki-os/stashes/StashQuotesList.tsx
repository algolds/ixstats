// src/components/wiki-os/stashes/StashQuotesList.tsx
// Dedicated Quotes & Highlights view for the Stash system.
// Features quote card styling, parent article pills, copy actions, and jump-to-article anchors.

"use client";

import { useState } from "react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { Copy, Check, ArrowUpRight, ChatBubble as MessageSquare, Clock } from "iconoir-react";
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
            className="group relative flex flex-col gap-2.5 overflow-hidden rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 p-4 shadow-xs backdrop-blur-xl transition-all duration-200 hover:border-[var(--wikios-border)]/80 hover:bg-[var(--wikios-surface)]/90 hover:shadow-md"
          >
            {/* Left Highlighter Ink Bar */}
            <div
              className="absolute top-0 bottom-0 left-0 w-1.5 rounded-l-2xl shadow-xs"
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
                className="flex max-w-sm items-center gap-1.5 truncate text-xs font-bold text-[var(--wikios-text)] transition-colors hover:text-[var(--wikios-accent)]"
              >
                <WikiOSLogomark className="h-3.5 w-3.5 shrink-0 text-[var(--wikios-accent)]" />
                <span className="truncate">{cleanArticleTitle}</span>
              </Link>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => handleCopyQuote(e, q.id, q.selectedText)}
                  className="flex h-7 cursor-pointer items-center gap-1 rounded-xl border border-[var(--wikios-border)] bg-white/5 px-2 text-[11px] font-semibold text-[var(--wikios-text-dim)] shadow-2xs transition-all hover:bg-white/10 hover:text-[var(--wikios-text)] active:scale-95"
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
                  className="flex h-7 w-7 items-center justify-center rounded-xl border border-[var(--wikios-border)] bg-white/5 text-[var(--wikios-text-dim)] shadow-2xs transition-all hover:bg-white/10 hover:text-[var(--wikios-text)] active:scale-95"
                  title="Open article"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Excerpt Quote Text */}
            <div className="pt-0.5 pl-2">
              <blockquote className="border-l-2 border-[var(--wikios-border)] py-0.5 pl-3 font-serif text-[12.5px] leading-relaxed text-[var(--wikios-text)] italic">
                &ldquo;{q.selectedText}&rdquo;
              </blockquote>
            </div>

            {/* Lore Significance Note if present */}
            {q.comment && q.comment !== "Saved quote" && (
              <div className="ml-2 space-y-0.5 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/70 p-2.5 text-[11px] text-[var(--wikios-text-muted)] shadow-2xs">
                <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--wikios-text)]">
                  <MessageSquare className="h-3 w-3 text-purple-400" />
                  <span>Lore Note</span>
                </div>
                <p className="leading-relaxed italic">{q.comment}</p>
              </div>
            )}

            {/* Timestamp */}
            <div className="flex items-center gap-1 pt-0.5 pl-2 text-[10px] text-[var(--wikios-text-dim)]">
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
