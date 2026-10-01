"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  OpenBook as BookOpen,
  ChatBubbleCheck as ChatBubble,
  Clock,
  PageEdit as EditPencil,
  Medal,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import type { WorkPayload } from "../../types";

type FeedItem = WorkPayload["wikiActivityFeed"][number];

const FEED_STYLE: Record<
  FeedItem["type"],
  { icon: typeof BookOpen; iconClass: string; badgeClass: string; label: string }
> = {
  publish: {
    icon: BookOpen,
    iconClass: "border-blue-500/20 bg-blue-500/10 text-blue-500",
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    label: "CREATED PAGE",
  },
  revision: {
    icon: EditPencil,
    iconClass: "border-indigo-500/20 bg-indigo-500/10 text-indigo-500",
    badgeClass: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    label: "REVISED PAGE",
  },
  minor_edit: {
    icon: EditPencil,
    iconClass: "border-stone-500/20 bg-stone-500/10 text-stone-500 [&>svg]:opacity-75",
    badgeClass: "border-stone-500/20 bg-stone-500/10 text-stone-600 dark:text-stone-400",
    label: "COPYEDIT",
  },
  discussion: {
    icon: ChatBubble,
    iconClass: "border-cyan-500/20 bg-cyan-500/10 text-cyan-500",
    badgeClass: "border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    label: "DISCUSSION",
  },
  laurel: {
    icon: Medal,
    iconClass: "border-amber-500/20 bg-amber-500/10 text-amber-500",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    label: "LAUREL",
  },
};

function ByteDiff({ bytes }: { bytes: number }) {
  return (
    <span
      className={cn(
        "py-0.2 flex items-center gap-0.5 rounded px-1.5 font-mono text-xs font-bold",
        bytes > 0 && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        bytes < 0 && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        bytes === 0 && "text-muted-foreground"
      )}
    >
      {bytes > 0 && <ArrowUpRight className="inline h-2.5 w-2.5" />}
      {bytes < 0 && <ArrowDownRight className="inline h-2.5 w-2.5" />}
      {bytes > 0 ? `+${bytes}B` : `${bytes}B`}
    </span>
  );
}

interface WorkActivityFeedProps {
  feed: FeedItem[];
  /** Wiki username for the "View All" contributions link. */
  contributionsUser: string;
}

/** Full WikiOS and database activity stream (revisions, contributions, discussions, laurels). */
export const WorkActivityFeed = React.memo(function WorkActivityFeed({
  feed,
  contributionsUser,
}: WorkActivityFeedProps) {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider uppercase">
          <EditPencil className="h-3.5 w-3.5 text-blue-500" />
          <span>FULL WIKIOS & DATABASE ACTIVITY STREAM ({feed.length})</span>
        </h4>
        <Link
          href={`/util/contributions/${encodeURIComponent(contributionsUser)}`}
          data-cuelume-press="soft"
          className="flex items-center gap-0.5 font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          <span>View All</span>
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {feed.map((item, idx) => {
          const style = FEED_STYLE[item.type];
          const Icon = style.icon;
          return (
            <FacetCard
              key={`${item.id}-${idx}`}
              depth={1}
              interactive="hover"
              className="flex flex-col justify-between gap-3.5 rounded-2xl border border-black/8 bg-black/[0.015] p-4 shadow-xs transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:border-black/15 sm:flex-row sm:items-center sm:p-4.5 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3.5">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-2xs",
                    style.iconClass
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "py-0.2 rounded border px-1.5 font-mono text-xs font-bold tracking-wider uppercase",
                        style.badgeClass
                      )}
                    >
                      {style.label}
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1 font-mono text-xs">
                      <Clock className="inline h-2.5 w-2.5" />
                      {new Date(item.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {item.byteDiff !== null && <ByteDiff bytes={item.byteDiff} />}
                  </div>

                  <h4 className="text-foreground truncate text-sm font-bold tracking-tight">
                    {item.title}
                  </h4>

                  {item.summary && (
                    <p className="text-muted-foreground line-clamp-1 text-xs italic">
                      &ldquo;{item.summary}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end pt-1 sm:pt-0">
                <Link
                  href={item.url}
                  data-cuelume-press="soft"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:opacity-90 active:scale-[0.97] dark:bg-white dark:text-stone-950"
                >
                  <span>View in WikiOS</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </FacetCard>
          );
        })}
      </div>
    </div>
  );
});
