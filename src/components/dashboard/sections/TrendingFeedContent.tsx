"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { FireFlame as Flame } from "iconoir-react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { ThinkpagesPost } from "~/components/thinkpages/ThinkpagesPost";
import { FacetCard } from "~/components/ui/facet-container";
import { EmptyState } from "~/components/ui/empty-state";
import { springSmooth } from "~/lib/design/motion";
import { FeedItemSkeleton } from "./UnifiedFeedItem";

/**
 * Trending tab: posts the thinkpages-trending cron job flagged (engagement from other users over
 * the last few days, with time decay), best first, plus the trending hashtags. Shows an honest
 * empty state when nothing qualifies; there is no recency fallback.
 */
export function TrendingFeedContent({
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
              className="bg-fill-3 hover:bg-fill-2 text-label text-caption duration-fast ease-out-facet focus-visible:outline-tint rounded-full px-2.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
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
        <FacetCard>
          <EmptyState
            icon={<Flame />}
            title="Nothing is trending right now"
            message="Posts trend when other people react to, reply to or repost them within the last few days."
          />
        </FacetCard>
      ) : (
        <div className="space-y-2">
          {posts.map((post: any) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springSmooth}
            >
              <ThinkpagesPost
                post={post}
                currentUserAccountId={currentUserAccountId}
                accounts={accounts}
                countryId={countryId}
                isOwner={isOwner}
                onAccountSelect={onAccountSelectAction}
                onAccountSettings={onAccountSettingsAction}
                onCreateAccount={onCreateAccountAction}
                onLike={onLikeAction}
                onRepost={() => onRepostAction(post)}
                onReaction={onReactionAction}
                onReply={onReplyAction}
                onShare={onShareAction}
                onAccountClick={() => {}}
                showThread={true}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
