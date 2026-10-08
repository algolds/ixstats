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
import { ParkedBadge } from "~/components/wiki-os/shared/ParkedBadge";
import type { WorkPayload } from "../../types";
import { formatWorkDay, WORK_LINK, WORK_ROW, WorkSectionTitle } from "./WorkSection";

type FeedItem = WorkPayload["wikiActivityFeed"][number];

const FEED_STYLE: Record<
  FeedItem["type"],
  { icon: typeof BookOpen; badge: BadgeVariant; label: string }
> = {
  publish: { icon: BookOpen, badge: "info", label: "Created page" },
  revision: { icon: EditPencil, badge: "secondary", label: "Revised page" },
  minor_edit: { icon: EditPencil, badge: "default", label: "Copyedit" },
  discussion: { icon: ChatBubble, badge: "default", label: "Discussion" },
  laurel: { icon: Medal, badge: "warning", label: "Laurel" },
};

function ByteDiff({ bytes }: { bytes: number }) {
  return (
    <Badge
      variant={bytes > 0 ? "success" : bytes < 0 ? "destructive" : "default"}
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
  /** Wiki username for the "View all" contributions link. */
  contributionsUser: string;
}

/** Full WikiOS and database activity stream (revisions, contributions, discussions, laurels). */
export const WorkActivityFeed = React.memo(function WorkActivityFeed({
  feed,
  contributionsUser,
}: WorkActivityFeedProps) {
  return (
    <section className="space-y-1">
      <WorkSectionTitle
        icon={<EditPencil />}
        trailing={
          <Link
            href={`/util/contributions/${encodeURIComponent(contributionsUser)}`}
            className={WORK_LINK}
          >
            <span>View all</span>
            <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        }
      >
        Wiki activity <span className="tabular-nums">({feed.length})</span>
      </WorkSectionTitle>

      <ul className="divide-separator divide-y">
        {feed.map((item, idx) => {
          const style = FEED_STYLE[item.type];
          const Icon = style.icon;
          return (
            <li key={`${item.id}-${idx}`} className={WORK_ROW}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Icon aria-hidden className="text-label-secondary mt-0.5 size-4 shrink-0" />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={style.badge}>{style.label}</Badge>
                    <span className="text-label-secondary text-footnote flex items-center gap-1 tabular-nums">
                      <Clock aria-hidden className="size-3.5" />
                      {formatWorkDay(item.timestamp)}
                    </span>
                    {item.byteDiff !== null && <ByteDiff bytes={item.byteDiff} />}
                    {item.parked && <ParkedBadge />}
                  </div>

                  <h3 className="text-label text-headline truncate">{item.title}</h3>

                  {item.summary && (
                    <p className="text-label-secondary text-footnote line-clamp-1 italic">
                      &ldquo;{item.summary}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              <Button asChild variant="secondary" size="sm" className="shrink-0 self-start">
                <Link href={item.url}>
                  <span>View in WikiOS</span>
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
});
