"use client";

import { useMemo, memo } from "react";
import { DiscussedInBadge } from "~/components/action-links/DiscussedIn";
import { Skeleton } from "~/components/ui/skeleton";
import { FeedPollWidget } from "~/components/shared/polls/FeedPollWidget";
import { PostHtml } from "~/components/thinkpages/post/PostHtml";
import { parseSportsBulletin } from "~/lib/sports/feed-bulletins";
import { SportsBulletinCard } from "~/components/thinkpages/SportsBulletinCard";
import { cn, formatThinkpagesContentForDisplay } from "~/lib/utils";
import { getActivityLabel, SOURCE_CONFIG } from "~/lib/feed/activity-labels";
import { FeedItemHeader } from "./feed/FeedItemHeader";
import { FeedGroupedDrawer } from "./feed/FeedGroupedDrawer";
import { WikiFeedCard } from "./feed/WikiFeedCard";
import { ForumFeedCard } from "./feed/ForumFeedCard";
import type { ProcessedFeedItem } from "~/types/dashboard-feed";
import { Card } from "~/components/ui/card";

export { getActivityLabel };

function formatEditors(editors: string[]): string {
  if (editors.length === 0) return "unknown";
  if (editors.length === 1) return editors[0]!;
  if (editors.length === 2) return `${editors[0]} and ${editors[1]}`;
  const remaining = editors.length - 2;
  return `${editors[0]}, ${editors[1]} and ${remaining} ${remaining === 1 ? "other" : "others"}`;
}

function Byline({ activity }: { activity: any }) {
  if (activity._isAchievementGroup) {
    return (
      <span>
        by <span className="text-label font-medium">{formatEditors(activity._editors ?? [])}</span>
      </span>
    );
  }
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
  if (activity._grouped) {
    return (
      <FeedGroupedDrawer
        subEdits={activity._subEdits}
        itemLabel={activity._isAchievementGroup ? "achievements" : "items"}
      />
    );
  }
  const description = activity.content?.description || activity.post?.content;
  return (
    <>
      {description && (
        <PostHtml
          content={description as string}
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

/** The item's open link: its wiki page or forum thread, else (an unlock) the achievement in the Vault. */
function openUrlOf(metadata: Record<string, string | undefined>, isAchievementGroup = false) {
  const external = metadata.wikiUrl ?? metadata.forumUrl;
  if (external) return external;
  if (isAchievementGroup) return "/vault/achievements";
  return metadata.achievementKey
    ? `/vault/achievements?a=${encodeURIComponent(metadata.achievementKey)}`
    : undefined;
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
          data-app={badge.app}
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
            externalUrl={openUrlOf(metadata, Boolean(activity._isAchievementGroup))}
          />
          <div className="text-label-secondary text-footnote flex flex-wrap items-center gap-2">
            <Byline activity={activity} />
          </div>
          <ActivityBody activity={activity} sportsBulletin={sportsBulletin} />
          {source === "activity" && !activity._grouped ? (
            <DiscussedInBadge activityId={activity.id} />
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/** Wiki edits and forum posts get their own cards; every other activity shares one layout. */
export const UnifiedFeedItem = memo(function UnifiedFeedItem({
  activity,
}: {
  activity: ProcessedFeedItem;
}) {
  if (activity.source === "wiki") return <WikiFeedCard activity={activity} />;
  // An item cached before previews existed has no `forum` and keeps the plain card.
  if (activity.source === "forum" && activity.forum) {
    return <ForumFeedCard activity={{ timestamp: activity.timestamp, forum: activity.forum }} />;
  }
  return <ActivityCard activity={activity} />;
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
