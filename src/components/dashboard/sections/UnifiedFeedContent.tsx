"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { RssFeed as Rss, Group as Users } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import { ThinkpagesPost } from "~/components/thinkpages/ThinkpagesPost";
import { UnifiedFeedItem, FeedItemSkeleton, getActivityLabel } from "./UnifiedFeedItem";
import { EmptyState, type EmptyStateProps } from "~/components/ui/empty-state";
import { springSmooth } from "~/lib/design/motion";
import { Card } from "~/components/ui/card";

type FeedTab = "all" | "following" | "community";

/**
 * Collapses runs of consecutive items sharing a non-null `keyOf` into one `build(run, start)`
 * entry. `sameRun` can further limit which items may join the run that `first` started.
 */
function groupRuns(
  items: any[],
  keyOf: (item: any) => string | null,
  build: (run: any[], start: number) => any,
  sameRun: (first: any, next: any) => boolean = () => true
): any[] {
  const result: any[] = [];
  for (let i = 0; i < items.length;) {
    const key = keyOf(items[i]);
    let end = i + 1;
    if (key !== null) {
      while (end < items.length && keyOf(items[end]) === key && sameRun(items[i], items[end]))
        end++;
    }
    result.push(end - i > 1 ? build(items.slice(i, end), i) : items[i]);
    i = end;
  }
  return result;
}

const wikiPageKey = (a: any) => (a.source === "wiki" && a.content?.metadata?.pageTitle) || null;

/** Consecutive wiki edits to the same page become one entry. */
function groupWikiEdits(activities: any[]): any[] {
  return groupRuns(activities, wikiPageKey, (group, i) => {
    const pageTitle = wikiPageKey(group[0]);
    const editors = new Set(group.map((g) => g.user?.name).filter(Boolean));
    const isNew = group.some((g) => g.content?.title?.startsWith("New wiki page"));
    return {
      ...group[0],
      id: `wiki-grouped-${pageTitle}-${i}`,
      content: {
        ...group[0].content,
        title: isNew ? `New wiki page: ${pageTitle}` : pageTitle,
      },
      _grouped: true,
      _editCount: group.length,
      _editors: Array.from(editors),
      _subEdits: group,
      _isNew: isNew,
    };
  });
}

// Repeated IxStats activities of the same type by the same user within a time window.
const ACTIVITY_GROUP_WINDOW_MS = 2 * 60 * 60 * 1000;

const userKey = (a: any) =>
  a.user?.countryName ?? a.user?.countryId ?? a.user?.name ?? a.user?.id ?? "";
const timeOf = (a: any) => new Date(a.timestamp).getTime();

/** Only `source: "activity"` groups (not wiki, thinkpages, forum). */
function groupRepeatedActivities(activities: any[]): any[] {
  return groupRuns(
    activities,
    (a) => (a.source === "activity" ? `${userKey(a)}\0${getActivityLabel(a).label}` : null),
    (group, i) => {
      const [first] = group;
      const label = getActivityLabel(first).label;
      return {
        ...first,
        id: `activity-grouped-${userKey(first)}-${label}-${i}`,
        content: { ...first.content, title: `${group.length} ${label} updates` },
        _grouped: true,
        _editCount: group.length,
        _editors: [first.user?.countryName ?? first.user?.name ?? "unknown"],
        _subEdits: group,
      };
    },
    (first, next) => Math.abs(timeOf(next) - timeOf(first)) < ACTIVITY_GROUP_WINDOW_MS
  );
}

export interface FeedHandlers {
  currentUserAccountId: string;
  accounts: any[];
  countryId: string;
  isOwner: boolean;
  onAccountSelectAction: (a: any) => void;
  onAccountSettingsAction: (a: any) => void;
  onCreateAccountAction: () => void;
  onLikeAction: (id: string) => void;
  onRepostAction: (post: any) => void;
  onReactionAction: (id: string, type: string) => void;
  onReplyAction: (id: string) => void;
  onShareAction: (id: string) => void;
}

export function FeedSkeletons({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <FeedItemSkeleton key={i} />
      ))}
    </div>
  );
}

/** ThinkPages posts render as threads; every other activity as a unified feed item. */
export function FeedList({ items, ...h }: FeedHandlers & { items: any[] }) {
  return (
    <div className="space-y-2">
      {items.map((a) => {
        if (a.source === "thinkpages" && a.rawPost) {
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springSmooth}
            >
              <ThinkpagesPost
                post={a.rawPost}
                currentUserAccountId={h.currentUserAccountId}
                accounts={h.accounts}
                countryId={h.countryId}
                isOwner={h.isOwner}
                onAccountSelect={h.onAccountSelectAction}
                onAccountSettings={h.onAccountSettingsAction}
                onCreateAccount={h.onCreateAccountAction}
                onLike={h.onLikeAction}
                onRepost={() => h.onRepostAction(a.rawPost)}
                onReaction={h.onReactionAction}
                onReply={h.onReplyAction}
                onShare={h.onShareAction}
                onAccountClick={() => {}}
                showThread={true}
              />
            </motion.div>
          );
        }
        return <UnifiedFeedItem key={a.id} activity={a} />;
      })}
    </div>
  );
}

const byTimeDesc = (a: any, b: any) => timeOf(b) - timeOf(a);
const newestFifty = (items: any[]) => items.sort(byTimeDesc).slice(0, 50);

/** Wiki recent changes as feed items; one without a valid timestamp is dropped rather than dated "now". */
function wikiChangesAsFeed(changes: any[]): any[] {
  return changes
    .filter((rc) => !isNaN(new Date(rc.timestamp).getTime()))
    .map((rc) => {
      const sizeChange = (rc.newLen ?? 0) - (rc.oldLen ?? 0);
      const isNewPage = rc.type === "new";
      const size = `${sizeChange > 0 ? "+" : ""}${sizeChange} bytes`;
      const comment = rc.comment?.replace(/\/\*.*?\*\/\s*/, "").trim();
      const description = isNewPage
        ? `Created new page (${size})`
        : comment
          ? `${comment.slice(0, 100)} (${size})`
          : `Edited page (${size})`;
      return {
        id: `wiki-rc-${rc.title}-${rc.timestamp}`,
        type: "meta",
        category: "platform",
        source: "wiki",
        user: { id: `wiki-user-${rc.user}`, name: rc.user },
        content: {
          title: isNewPage ? `New wiki page: ${rc.title}` : `Wiki edit: ${rc.title}`,
          description,
          metadata: {
            source: "ixwiki",
            pageTitle: rc.title,
            wikiUrl: titleToWikiOSPath(rc.title),
            blurb: rc.blurb || null,
            thumbnail: rc.thumbnail || null,
          },
        },
        engagement: { likes: 0, comments: 0, shares: 0, views: 0 },
        timestamp: new Date(rc.timestamp),
        priority: isNewPage ? "medium" : "low",
        visibility: "public",
      };
    });
}

/** Picks the stream for a tab, topping it up with wiki changes when the feed has none. */
function selectFeed(tab: FeedTab, activities: any[] | undefined, wikiItems: any[]): any[] {
  if (tab === "community") {
    const fromFeed = (activities ?? []).filter((a) => a.source === "wiki" || a.source === "forum");
    if (fromFeed.length === 0 && wikiItems.length > 0) return wikiItems;
    const merged = [...fromFeed];
    for (const item of wikiItems) {
      if (!merged.some((m) => m.id === item.id)) merged.push(item);
    }
    return newestFifty(merged);
  }
  if (!activities) return [];
  const hasWiki = activities.some((a) => a.source === "wiki");
  return !hasWiki && wikiItems.length > 0 ? newestFifty([...activities, ...wikiItems]) : activities;
}

/** A feed's empty state, in a card. */
export function FeedEmpty(props: EmptyStateProps) {
  return (
    <Card>
      <EmptyState {...props} />
    </Card>
  );
}

export function UnifiedFeedContent({
  activeTab,
  ...handlers
}: FeedHandlers & { activeTab: FeedTab }) {
  const { data: feedData, isLoading: feedLoading } = api.activities.getGlobalFeed.useQuery(
    { limit: 50 },
    { refetchInterval: 60_000, staleTime: 30_000 }
  );
  const { data: wikiRecentChanges } = api.wikios.getRecentChanges.useQuery(
    { limit: 20 },
    {
      enabled: activeTab === "all" || activeTab === "community",
      refetchInterval: 60_000,
      staleTime: 30_000,
    }
  );

  const filteredFeed = useMemo(
    () =>
      groupRepeatedActivities(
        groupWikiEdits(
          selectFeed(activeTab, feedData?.activities, wikiChangesAsFeed(wikiRecentChanges ?? []))
        )
      ),
    [feedData, wikiRecentChanges, activeTab]
  );

  if (feedLoading) return <FeedSkeletons />;

  if (filteredFeed.length === 0) {
    return (
      <FeedEmpty
        icon={<Rss />}
        title={`No recent ${activeTab === "community" ? "community updates" : "activity"}`}
        message="Nothing has been posted here recently."
      />
    );
  }

  return <FeedList items={filteredFeed} {...handlers} />;
}

export function FollowingFeedContent(handlers: FeedHandlers) {
  const { data: followingData, isLoading: followingLoading } =
    api.activities.getFollowingFeed.useQuery(
      { limit: 30 },
      { refetchInterval: 30_000, staleTime: 15_000 }
    );

  const processedActivities = useMemo(
    () => groupRepeatedActivities(groupWikiEdits(followingData?.activities ?? [])),
    [followingData]
  );

  if (followingLoading) return <FeedSkeletons />;

  if ((followingData?.followingCount ?? 0) === 0) {
    return (
      <FeedEmpty
        icon={<Users />}
        title="Not following anyone yet"
        message="Follow countries or ThinkPages accounts to see their activity here."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={"/countries"}>Explore countries</Link>
          </Button>
        }
      />
    );
  }

  if (processedActivities.length === 0) {
    return (
      <FeedEmpty
        icon={<Users />}
        title="No recent activity"
        message="Countries and accounts you follow haven't posted yet."
      />
    );
  }

  return <FeedList items={processedActivities} {...handlers} />;
}
