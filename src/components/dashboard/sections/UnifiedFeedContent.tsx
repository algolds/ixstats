// @ts-nocheck
"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { Rss, Users } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { titleToWikiOSPath } from "~/lib/wikios/url-compat";
import { ThinkpagesPost } from "~/components/thinkpages/ThinkpagesPost";
import { UnifiedFeedItem, getActivityLabel } from "./UnifiedFeedItem";

type FeedTab = "all" | "following" | "community";

// Group consecutive wiki edits to the same page
function groupWikiEdits(activities: any[]): any[] {
  const result: any[] = [];
  let i = 0;
  while (i < activities.length) {
    const a = activities[i];
    if (a.source === "wiki" && a.content?.metadata?.pageTitle) {
      const pageTitle = a.content.metadata.pageTitle;
      const group = [a];
      let j = i + 1;
      // Collect consecutive edits to same page
      while (j < activities.length) {
        const b = activities[j];
        if (b.source === "wiki" && b.content?.metadata?.pageTitle === pageTitle) {
          group.push(b);
          j++;
        } else {
          break;
        }
      }
      if (group.length > 1) {
        // Build a condensed entry
        const editors = new Set(group.map((g: any) => g.user?.name).filter(Boolean));
        const totalBytes = group.reduce((sum: number, g: any) => {
          const desc = g.content?.description ?? "";
          const match = desc.match(/([+-]?\d+)\s+bytes/);
          return sum + (match ? parseInt(match[1], 10) : 0);
        }, 0);
        const isNew = group.some((g: any) => g.content?.title?.startsWith("New wiki page"));
        result.push({
          ...group[0],
          id: `wiki-grouped-${pageTitle}-${i}`,
          content: {
            ...group[0].content,
            title: isNew ? `New wiki page: ${pageTitle}` : pageTitle,
          },
          _grouped: true,
          _editCount: group.length,
          _editors: Array.from(editors),
          _totalBytes: totalBytes,
          _subEdits: group,
          _isNew: isNew,
        });
      } else {
        result.push(a);
      }
      i = j;
    } else {
      result.push(a);
      i++;
    }
  }
  return result;
}

// Group repeated IxStats activities of the same type by the same user within a time window
const ACTIVITY_GROUP_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

function groupRepeatedActivities(activities: any[]): any[] {
  const result: any[] = [];
  let i = 0;
  while (i < activities.length) {
    const a = activities[i];
    // Only group source=activity (not wiki, thinkpages, forum)
    if (a.source === "activity") {
      // Group by country (or user if no country) + label
      const groupKey = a.user?.countryName ?? a.user?.countryId ?? a.user?.name ?? a.user?.id ?? "";
      const displayName = a.user?.countryName ?? a.user?.name ?? "unknown";
      const label = getActivityLabel(a).label;
      const aTime = new Date(a.timestamp).getTime();
      const group = [a];
      let j = i + 1;
      // Collect consecutive activities with same user + label within window
      while (j < activities.length) {
        const b = activities[j];
        if (
          b.source === "activity" &&
          (b.user?.countryName ?? b.user?.countryId ?? b.user?.name ?? b.user?.id ?? "") ===
            groupKey &&
          getActivityLabel(b).label === label &&
          Math.abs(new Date(b.timestamp).getTime() - aTime) < ACTIVITY_GROUP_WINDOW_MS
        ) {
          group.push(b);
          j++;
        } else {
          break;
        }
      }
      if (group.length > 1) {
        const titles = group.map((g: any) => g.content?.title ?? "").filter(Boolean);
        const groupLabel = getActivityLabel(a).label;
        result.push({
          ...group[0],
          id: `activity-grouped-${groupKey}-${label}-${i}`,
          content: {
            ...group[0].content,
            title: `${group.length} ${groupLabel} updates`,
          },
          _grouped: true,
          _editCount: group.length,
          _editors: [displayName],
          _totalBytes: 0,
          _subEdits: group,
          _groupLabel: groupLabel,
          _subTitles: titles,
        });
      } else {
        result.push(a);
      }
      i = j;
    } else {
      result.push(a);
      i++;
    }
  }
  return result;
}

export function UnifiedFeedContent({
  activeTab,
  currentUserAccountId,
  accounts,
  countryId,
  isOwner,
  onAccountSelectAction,
  onAccountSettingsAction,
  onCreateAccountAction,
  onLikeAction,
  onRepostAction,
  onReactionAction,
  onReplyAction,
  onShareAction,
}: {
  activeTab: FeedTab;
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
}) {
  const { data: feedData, isLoading: feedLoading } = api.activities.getGlobalFeed.useQuery(
    { limit: 50 },
    { refetchInterval: 30_000, staleTime: 15_000 }
  );
  const { data: wikiRecentChanges } = api.wiki.getRecentChanges.useQuery(
    { limit: 20 },
    { refetchInterval: 30_000, staleTime: 15_000 }
  );

  const wikiAsFeed = useMemo(() => {
    if (!wikiRecentChanges) return [];
    return wikiRecentChanges.map((rc: any) => {
      const sizeChange = (rc.newLen ?? 0) - (rc.oldLen ?? 0);
      const isNewPage = rc.type === "new";
      return {
        id: `wiki-rc-${rc.title}-${rc.timestamp}`,
        type: "meta",
        category: "platform",
        source: "wiki",
        user: { id: `wiki-user-${rc.user}`, name: rc.user },
        content: {
          title: isNewPage ? `New wiki page: ${rc.title}` : `Wiki edit: ${rc.title}`,
          description: (() => {
            const s = `${sizeChange > 0 ? "+" : ""}${sizeChange} bytes`;
            if (isNewPage) return `Created new page (${s})`;
            if (!rc.comment) return `Edited page (${s})`;
            const clean = rc.comment.replace(/\/\*.*?\*\/\s*/, "").trim();
            return clean ? `${clean.slice(0, 100)} (${s})` : `Edited page (${s})`;
          })(),
          metadata: {
            source: "ixwiki",
            pageTitle: rc.title,
            wikiUrl: titleToWikiOSPath(rc.title),
          },
        },
        engagement: { likes: 0, comments: 0, shares: 0, views: 0 },
        timestamp: new Date(
          rc.timestamp?.replace(
            /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
            "$1-$2-$3T$4:$5:$6Z"
          ) ?? 0
        ),
        priority: isNewPage ? "medium" : "low",
        visibility: "public",
      };
    });
  }, [wikiRecentChanges]);

  const filteredFeed = useMemo(() => {
    let raw: any[] = [];
    if (activeTab === "community") {
      const fromFeed = (feedData?.activities ?? []).filter(
        (a: any) => a.source === "wiki" || a.source === "forum"
      );
      if (fromFeed.length === 0 && wikiAsFeed.length > 0) {
        raw = wikiAsFeed;
      } else {
        const merged = [...fromFeed];
        for (const wikiItem of wikiAsFeed) {
          if (!merged.some((m) => m.id === wikiItem.id)) {
            merged.push(wikiItem);
          }
        }
        merged.sort(
          (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        raw = merged.slice(0, 50);
      }
    } else {
      if (!feedData?.activities) {
        raw = [];
      } else {
        const hasWiki = feedData.activities.some((a: any) => a.source === "wiki");
        if (!hasWiki && wikiAsFeed.length > 0) {
          const merged = [...feedData.activities, ...wikiAsFeed];
          merged.sort(
            (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          raw = merged.slice(0, 50);
        } else {
          raw = feedData.activities;
        }
      }
    }
    return groupRepeatedActivities(groupWikiEdits(raw));
  }, [feedData, wikiAsFeed, activeTab]);

  if (feedLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border/50 bg-muted/30 animate-pulse rounded-xl border p-5">
            <div className="bg-muted mb-2 h-4 w-3/4 rounded" />
            <div className="bg-muted/60 h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (filteredFeed.length === 0) {
    const label = activeTab === "community" ? "community updates" : "activity";
    return (
      <Card className="glass-surface glass-refraction border-border/40">
        <CardContent className="p-8 text-center">
          <Rss className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
          <h3 className="mb-1 text-sm font-semibold">No recent {label}</h3>
          <p className="text-muted-foreground text-xs">Check back later for updates.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {filteredFeed.map((a: any) => {
        if (a.source === "thinkpages" && a.rawPost) {
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <ThinkpagesPost
                post={a.rawPost}
                currentUserAccountId={currentUserAccountId}
                accounts={accounts}
                countryId={countryId}
                isOwner={isOwner}
                onAccountSelect={onAccountSelectAction}
                onAccountSettings={onAccountSettingsAction}
                onCreateAccount={onCreateAccountAction}
                onLike={onLikeAction}
                onRepost={() => onRepostAction(a.rawPost)}
                onReaction={onReactionAction}
                onReply={onReplyAction}
                onShare={onShareAction}
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

export function FollowingFeedContent({
  currentUserAccountId,
  accounts,
  countryId,
  isOwner,
  onAccountSelectAction,
  onAccountSettingsAction,
  onCreateAccountAction,
  onLikeAction,
  onRepostAction,
  onReactionAction,
  onReplyAction,
  onShareAction,
}: {
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
}) {
  const { data: followingData, isLoading: followingLoading } =
    api.activities.getFollowingFeed.useQuery(
      { limit: 30 },
      { refetchInterval: 30_000, staleTime: 15_000 }
    );

  const processedActivities = useMemo(() => {
    const raw = followingData?.activities ?? [];
    return groupRepeatedActivities(groupWikiEdits(raw));
  }, [followingData]);

  if (followingLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border/50 bg-muted/30 animate-pulse rounded-xl border p-5">
            <div className="bg-muted mb-2 h-4 w-3/4 rounded" />
            <div className="bg-muted/60 h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const followingCount = followingData?.followingCount ?? 0;

  if (followingCount === 0) {
    return (
      <Card className="glass-surface glass-refraction border-border/40">
        <CardContent className="p-8 text-center">
          <Users className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
          <h3 className="mb-1 text-sm font-semibold">Not following anyone yet</h3>
          <p className="text-muted-foreground text-xs">
            Follow countries to see their activity here.
          </p>
          <Link href={"/countries"}>
            <Button size="sm" variant="outline" className="mt-3 text-xs">
              Explore Countries
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (processedActivities.length === 0) {
    return (
      <Card className="glass-surface glass-refraction border-border/40">
        <CardContent className="p-8 text-center">
          <Users className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
          <h3 className="mb-1 text-sm font-semibold">No recent activity</h3>
          <p className="text-muted-foreground text-xs">Countries you follow haven't posted yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {processedActivities.map((a: any) => {
        if (a.source === "thinkpages" && a.rawPost) {
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <ThinkpagesPost
                post={a.rawPost}
                currentUserAccountId={currentUserAccountId}
                accounts={accounts}
                countryId={countryId}
                isOwner={isOwner}
                onAccountSelect={onAccountSelectAction}
                onAccountSettings={onAccountSettingsAction}
                onCreateAccount={onCreateAccountAction}
                onLike={onLikeAction}
                onRepost={() => onRepostAction(a.rawPost)}
                onReaction={onReactionAction}
                onReply={onReplyAction}
                onShare={onShareAction}
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
