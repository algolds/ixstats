"use client";

import Link from "next/link";
import { FireFlame as Flame } from "iconoir-react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { EmptyState } from "~/components/ui/empty-state";
import { FeedItemSkeleton } from "./UnifiedFeedItem";
import { Card } from "~/components/ui/card";
import { FeedList, type FeedHandlers } from "./UnifiedFeedContent";

/**
 * Trending tab: posts the thinkpages-trending cron job flagged (engagement from other users over
 * the last few days, with time decay), best first, plus the trending hashtags. Shows an honest
 * empty state when nothing qualifies; there is no recency fallback.
 */
export function TrendingFeedContent(handlers: FeedHandlers) {
  const { data: feed, isLoading } = api.thinkpages.getFeed.useQuery(
    { filter: "trending", limit: 25 },
    { refetchInterval: 5 * 60_000, staleTime: 60_000 }
  );
  const { data: topics } = api.activities.getTrendingTopics.useQuery(
    { limit: 8 },
    { staleTime: 5 * 60_000 }
  );

  const posts = feed?.posts ?? [];

  return (
    <div className="space-y-3">
      {topics && topics.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Trending topics">
          <span className="text-label-secondary text-subhead">Trending topics</span>
          {topics.map((topic) => (
            <Link
              key={topic.id}
              href={withBasePath(`/hashtags/${encodeURIComponent(topic.hashtag)}`)}
              className="bg-fill-3 hover:bg-fill-2 text-label text-caption duration-fast ease-out-facet focus-visible:outline-tint rounded-full px-3 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              title={`${topic.postCount} post${topic.postCount !== 1 ? "s" : ""}`}
            >
              {topic.title}
            </Link>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <FeedItemSkeleton key={i} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Flame />}
            title="Nothing is trending right now"
            message="Posts trend when other people react to, reply to or repost them within the last few days."
          />
        </Card>
      ) : (
        <FeedList
          items={posts.map((post: any) => ({ id: post.id, source: "thinkpages", rawPost: post }))}
          {...handlers}
        />
      )}
    </div>
  );
}
