// src/components/wiki-os/stashes/StashThreadsList.tsx
// Saved forum threads view with rich metadata and direct link to native forum.
// Apple Design & Facet compliance.

"use client";

import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { ChatBubble as MessageSquare, Clock, Xmark as X, ArrowUpRight } from "iconoir-react";
import { soundEffects } from "~/lib/sound/cuelume";
import type { StashedThreadItem } from "./types";

interface StashThreadsListProps {
  items: StashedThreadItem[];
  onUnstash: (pageTitle: string) => void;
}

export function StashThreadsList({ items, onUnstash }: StashThreadsListProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const cleanTitle = item.note ?? item.pageTitle.replace("forum:thread:", "Thread #");
        const forumUrl = item.pageSlug.startsWith("/forum")
          ? item.pageSlug
          : `/forum/thread/${item.pageSlug.replace(/^forum:thread:/, "")}`;

        return (
          <div
            key={item.id}
            className="group relative flex flex-col gap-2.5 overflow-hidden rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 p-4 shadow-xs backdrop-blur-xl transition-all duration-200 hover:border-[var(--wikios-border)]/80 hover:bg-[var(--wikios-surface)]/90 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={withBasePath(forumUrl)}
                onClick={() => soundEffects.press()}
                className="group/title flex min-w-0 flex-1 items-center gap-2.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/15 text-orange-400 shadow-2xs transition-all group-hover/title:scale-105">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold tracking-tight text-[var(--wikios-text)] transition-colors group-hover/title:text-orange-400">
                    {cleanTitle}
                  </h3>
                  <div className="flex items-center gap-2 pt-0.5 text-[11px] text-[var(--wikios-text-dim)]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.savedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="py-0.2 rounded-md border border-orange-500/25 bg-orange-500/15 px-1.5 text-[9px] font-bold tracking-wider text-orange-400 uppercase">
                      Forum
                    </span>
                  </div>
                </div>
              </Link>

              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={withBasePath(forumUrl)}
                  onClick={() => soundEffects.press()}
                  className="flex items-center gap-1 rounded-xl border border-[var(--wikios-border)] bg-white/5 px-2.5 py-1 text-xs font-semibold text-[var(--wikios-text-muted)] shadow-2xs transition-all hover:bg-white/10 hover:text-[var(--wikios-text)] active:scale-95"
                  title="Open forum thread"
                >
                  <span>Open</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    soundEffects.release();
                    onUnstash(item.pageTitle);
                  }}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl border border-[var(--wikios-border)] bg-white/5 text-[var(--wikios-text-dim)] shadow-2xs transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95"
                  title="Remove from stash"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
