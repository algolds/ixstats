"use client";

import { useMemo, memo } from "react";
import {
  WarningTriangle as AlertTriangle,
  Globe,
  Bank as Landmark,
  Map as MapIcon,
  RssFeed as Rss,
  Shield,
  StatUp as TrendingUp,
  Trophy,
  Group as Users,
  ChatBubble as MessageCircle,
} from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { FeedPollWidget } from "~/components/shared/polls/FeedPollWidget";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { parseSportsBulletin } from "~/lib/sports/feed-bulletins";
import { SportsBulletinCard } from "~/components/thinkpages/SportsBulletinCard";
import { cn, formatThinkpagesContentForDisplay } from "~/lib/utils";
import { FeedItemHeader } from "./feed/FeedItemHeader";
import { FeedGroupedDrawer } from "./feed/FeedGroupedDrawer";
import { WikiFeedCard } from "./feed/WikiFeedCard";
import type { ProcessedFeedItem } from "~/types/dashboard-feed";
import { Card } from "~/components/ui/card";

type FeedBadge = { icon: typeof Rss; color: string; bg: string; label: string };

const BLUE = { color: "text-blue", bg: "bg-blue/10" };
const GREEN = { color: "text-green", bg: "bg-green/10" };
const RED = { color: "text-red", bg: "bg-red/10" };

const SOURCE_CONFIG: Record<string, FeedBadge> = {
  activity: { icon: Rss, ...BLUE, label: "Activity" },
  thinkpages: { icon: Users, ...BLUE, label: "Social" },
  forum: { icon: MessageCircle, color: "text-orange", bg: "bg-orange/10", label: "Forum" },
};

/** First match wins: a category or a keyword in the title. */
const ACTIVITY_RULES: (FeedBadge & { cats?: string[]; words: string[] })[] = [
  { label: "POI", icon: MapIcon, ...GREEN, words: ["point of interest", "poi"] },
  { label: "City", icon: MapIcon, ...GREEN, words: ["city", "settlement"] },
  {
    label: "Subdivision",
    icon: MapIcon,
    ...GREEN,
    words: ["subdivision", "province", "state", "region"],
  },
  { label: "Maps", icon: MapIcon, ...GREEN, cats: ["map"], words: ["map", "claim"] },
  {
    label: "Economy",
    icon: TrendingUp,
    ...GREEN,
    cats: ["economic"],
    words: ["gdp", "econom", "trade"],
  },
  {
    label: "Diplomacy",
    icon: Globe,
    color: "text-teal",
    bg: "bg-teal/10",
    cats: ["diplomatic"],
    words: ["embassy", "diplom", "treaty"],
  },
  {
    label: "Defense",
    icon: Shield,
    ...RED,
    cats: ["military"],
    words: ["military", "defense", "deploy"],
  },
  {
    label: "Politics",
    icon: Landmark,
    color: "text-indigo",
    bg: "bg-indigo/10",
    cats: ["political"],
    words: ["govern", "politic", "election"],
  },
  { label: "Crisis", icon: AlertTriangle, ...RED, cats: ["crisis"], words: ["crisis"] },
  {
    label: "Achievement",
    icon: Trophy,
    color: "text-yellow",
    bg: "bg-yellow/10",
    cats: ["achievement"],
    words: ["tier", "achieve"],
  },
];

export function getActivityLabel(activity: any): FeedBadge {
  const cat = activity.category ?? activity.content?.metadata?.category ?? "";
  const title = (activity.content?.title ?? "").toLowerCase();
  const rule = ACTIVITY_RULES.find(
    (r) => r.cats?.includes(cat) || r.words.some((word) => title.includes(word))
  );
  return rule ?? SOURCE_CONFIG.activity!;
}

function Byline({ activity }: { activity: any }) {
  if (activity._grouped) {
    return (
      <span>
        <span className="text-label font-medium tabular-nums">{activity._editCount}</span> updates
        by <span className="text-label font-medium">{activity._editors?.[0] ?? "unknown"}</span>
      </span>
    );
  }
  const name = activity.user?.name;
  if (!name || (activity.poll && name === "User")) return null;
  return (
    <span>
      by <span className="text-label font-medium">{name}</span>
    </span>
  );
}

function ActivityBody({ activity, sportsBulletin }: { activity: any; sportsBulletin: any }) {
  if (activity._grouped) return <FeedGroupedDrawer subEdits={activity._subEdits} />;
  const description = activity.content?.description || activity.post?.content;
  return (
    <>
      {description && (
        <WikiHtmlContent
          html={formatThinkpagesContentForDisplay(description as string)}
          className="text-label-secondary text-callout pt-0.5 break-words whitespace-pre-wrap"
        />
      )}
      {activity.poll ? (
        <FeedPollWidget poll={activity.poll} />
      ) : sportsBulletin ? (
        <SportsBulletinCard data={sportsBulletin} />
      ) : null}
    </>
  );
}

function ActivityCard({ activity }: { activity: any }) {
  const source = activity.source ?? "activity";
  const badge =
    source === "activity"
      ? getActivityLabel(activity)
      : (SOURCE_CONFIG[source] ?? SOURCE_CONFIG.activity!);
  const Icon = badge.icon;
  const metadata = activity.content?.metadata ?? {};
  const title = activity.content?.title ?? "";

  const rawContentText = [
    activity.content?.title,
    activity.content?.description,
    activity.post?.content,
  ]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .join("\n");
  const sportsBulletin = useMemo(() => parseSportsBulletin(rawContentText), [rawContentText]);

  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className={cn(
            "rounded-row border-separator mt-0.5 flex size-9 shrink-0 items-center justify-center border",
            badge.bg
          )}
        >
          <Icon className={cn("size-4.5", badge.color)} />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <FeedItemHeader
            activity={activity}
            label={badge.label}
            sportsBulletin={sportsBulletin}
            titleHtml={title ? formatThinkpagesContentForDisplay(title) : ""}
            externalUrl={metadata.wikiUrl ?? metadata.forumUrl}
          />
          <div className="text-label-secondary text-footnote flex flex-wrap items-center gap-2">
            <Byline activity={activity} />
          </div>
          <ActivityBody activity={activity} sportsBulletin={sportsBulletin} />
        </div>
      </div>
    </Card>
  );
}

/** Wiki edits get their own card; every other activity shares one layout. */
export const UnifiedFeedItem = memo(function UnifiedFeedItem({
  activity,
}: {
  activity: ProcessedFeedItem | any;
}) {
  return activity.source === "wiki" ? (
    <WikiFeedCard activity={activity} />
  ) : (
    <ActivityCard activity={activity} />
  );
});

/** Loading placeholder shaped like a feed card. */
export function FeedItemSkeleton() {
  return (
    <Card padding="md" aria-hidden className="flex items-start gap-3">
      <Skeleton className="rounded-row size-9 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="rounded-control-sm h-4 w-3/4" />
        <Skeleton className="rounded-control-sm h-3 w-1/2" />
      </div>
    </Card>
  );
}
