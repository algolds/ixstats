"use client";
// Saved forum threads view with rich metadata and direct link to native forum.
import Link from "next/link";
import { ixstatesLinkHref } from "~/lib/system/wikios-standalone";
import { threadHref } from "~/lib/thinkpages-forum/links";
import { nativeThreadIdOf } from "~/lib/wiki-os/stash-content-type";
import { ChatBubble as MessageSquare, Clock, Xmark as X, ArrowUpRight } from "iconoir-react";

import type { StashedThreadItem } from "./types";
import { Button } from "~/components/ui/button";

interface StashThreadsListProps {
  items: StashedThreadItem[];
  onUnstash: (pageTitle: string) => void;
}

/**
 * Where a stashed thread opens and what it is called: a native item (`thinkpages:thread:<id>`) opens the ThinkPages
 * forum thread, built from its id. Anything else has no target and is not listed (the stash listing passes no
 * bridge-era item: the XenForo import moves those to native items).
 */
export function stashedThreadTarget(
  item: StashedThreadItem
): { title: string; href: string } | null {
  const nativeId = nativeThreadIdOf(item.pageTitle);
  return nativeId ? { title: item.note ?? "Thread", href: threadHref(nativeId) } : null;
}

export function StashThreadsList({ items, onUnstash }: StashThreadsListProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const target = stashedThreadTarget(item);
        if (!target) return null;
        const { title: cleanTitle, href } = target;
        // Standalone WikiOS serves no forum, so there the link goes to IxStates; inside IxStates it is the plain path.
        const forumUrl = ixstatesLinkHref(href);

        return (
          <div
            key={item.id}
            data-app="thinkpages"
            className="group rounded-card border-separator bg-surface hover:border-separator hover:bg-surface hover:shadow-card relative flex flex-col gap-2 overflow-hidden border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              <Link href={forumUrl} className="group/title flex min-w-0 flex-1 items-center gap-2">
                <div className="rounded-row border-tint/30 bg-tint-fill text-tint flex h-9 w-9 shrink-0 items-center justify-center border transition-[color,background-color,border-color,box-shadow,opacity,transform] group-hover/title:scale-105">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-headline text-label group-hover/title:text-tint truncate transition-colors">
                    {cleanTitle}
                  </h3>
                  <div className="text-footnote text-label-secondary flex items-center gap-2 pt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.savedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="py-0.2 rounded-control-sm border-tint/25 bg-tint-fill text-eyebrow text-tint border px-2">
                      Forum
                    </span>
                  </div>
                </div>
              </Link>

              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={forumUrl}
                  className="rounded-row border-separator bg-fill-4 text-caption text-label-secondary hover:bg-fill-4 hover:text-label flex items-center gap-1 border px-3 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                  title="Open forum thread"
                >
                  <span>Open</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>

                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Remove from stash"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnstash(item.pageTitle);
                  }}
                  title="Remove from stash"
                  className="bg-fill-4 text-label-secondary hover:border-red/30 hover:bg-red/10 hover:text-red"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
