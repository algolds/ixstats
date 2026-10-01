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
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FACET_INSET_SURFACE } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils/cn";
import { ParkedBadge } from "~/components/wiki-os/shared/ParkedBadge";
import type { WorkPayload } from "../../types";

type FeedItem = WorkPayload["wikiActivityFeed"][number];

const FEED_STYLE: Record<
  FeedItem["type"],
  { icon: typeof BookOpen; badge: BadgeVariant; label: string }
> = {
  publish: { icon: BookOpen, badge: "info", label: "Created page" },
  revision: { icon: EditPencil, badge: "tinted", label: "Revised page" },
  minor_edit: { icon: EditPencil, badge: "neutral", label: "Copyedit" },
  discussion: { icon: ChatBubble, badge: "neutral", label: "Discussion" },
  laurel: { icon: Medal, badge: "caution", label: "Laurel" },
};

function ByteDiff({ bytes }: { bytes: number }) {
  return (
    <Badge
      variant={bytes > 0 ? "success" : bytes < 0 ? "destructive" : "neutral"}
      className="tabular-nums"
    >
      {bytes > 0 && <ArrowUpRight aria-hidden />}
      {bytes < 0 && <ArrowDownRight aria-hidden />}
      {bytes > 0 ? `+${bytes}B` : `${bytes}B`}
    </Badge>
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
        <h4 className="text-subhead text-label-secondary flex items-center gap-2">
          <EditPencil aria-hidden className="size-4" />
          <span>
            Full WikiOS and database activity stream{" "}
            <span className="tabular-nums">({feed.length})</span>
          </span>
        </h4>
        <Link
          href={`/util/contributions/${encodeURIComponent(contributionsUser)}`}
          className="text-tint text-footnote flex items-center gap-0.5 hover:underline"
        >
          <span>View All</span>
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </div>

      <ul className="grid grid-cols-1 gap-2">
        {feed.map((item, idx) => {
          const style = FEED_STYLE[item.type];
          const Icon = style.icon;
          return (
            <li
              key={`${item.id}-${idx}`}
              className={cn(
                FACET_INSET_SURFACE,
                "flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div
                  aria-hidden
                  className="bg-surface text-label-secondary rounded-row flex size-9 shrink-0 items-center justify-center"
                >
                  <Icon className="size-4" />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={style.badge}>{style.label}</Badge>
                    <span className="text-label-secondary text-footnote flex items-center gap-1 tabular-nums">
                      <Clock aria-hidden className="size-3.5" />
                      {new Date(item.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {item.byteDiff !== null && <ByteDiff bytes={item.byteDiff} />}
                    {item.parked && <ParkedBadge />}
                  </div>

                  <h4 className="text-label text-headline truncate">{item.title}</h4>

                  {item.summary && (
                    <p className="text-label-secondary text-footnote line-clamp-1 italic">
                      &ldquo;{item.summary}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end pt-1 sm:pt-0">
                <Button asChild variant="gray" size="sm">
                  <Link href={item.url}>
                    <span>View in WikiOS</span>
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
