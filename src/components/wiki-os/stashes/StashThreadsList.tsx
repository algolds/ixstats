// src/components/wiki-os/stashes/StashThreadsList.tsx
// Saved forum threads view with rich metadata and direct link to native forum.
// Apple Design & Facet compliance.

"use client";

import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import {
  ChatBubble as MessageSquare,
  Clock,
  Xmark as X,
  ArrowUpRight,
} from "iconoir-react";
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
            className="group relative rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 hover:bg-[var(--wikios-surface)]/90 hover:border-[var(--wikios-border)]/80 shadow-xs hover:shadow-md transition-all duration-200 backdrop-blur-xl p-4 overflow-hidden flex flex-col gap-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={withBasePath(forumUrl)}
                onClick={() => soundEffects.press()}
                className="flex items-center gap-2.5 min-w-0 group/title flex-1"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 shadow-2xs shrink-0 group-hover/title:scale-105 transition-all">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-[var(--wikios-text)] group-hover/title:text-orange-400 transition-colors truncate tracking-tight">
                    {cleanTitle}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--wikios-text-dim)] pt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.savedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="px-1.5 py-0.2 rounded-md bg-orange-500/15 border border-orange-500/25 text-orange-400 font-bold text-[9px] uppercase tracking-wider">
                      Forum
                    </span>
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href={withBasePath(forumUrl)}
                  onClick={() => soundEffects.press()}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)] px-2.5 py-1 rounded-xl bg-white/5 border border-[var(--wikios-border)] hover:bg-white/10 active:scale-95 transition-all shadow-2xs"
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
                  className="h-7 w-7 flex items-center justify-center rounded-xl bg-white/5 border border-[var(--wikios-border)] text-[var(--wikios-text-dim)] hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
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
