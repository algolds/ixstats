"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { FireFlame as Flame } from "iconoir-react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { ThinkpagesPost } from "~/components/thinkpages/ThinkpagesPost";

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
          <span className="text-muted-foreground text-xs font-medium">Trending topics</span>
          {topics.map((topic) => (
            <Link
              key={topic.id}
              href={withBasePath(`/hashtags/${encodeURIComponent(topic.hashtag)}`)}
              className="border-border/60 bg-card/60 hover:bg-accent/10 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors"
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
            <div
              key={i}
              className="border-border/50 bg-muted/30 animate-pulse rounded-xl border p-5"
            >
              <div className="bg-muted mb-2 h-4 w-3/4 rounded" />
              <div className="bg-muted/60 h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="border-border/50 bg-card/75 rounded-2xl border p-8 text-center shadow-xs backdrop-blur-xl">
          <Flame className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
          <h3 className="mb-1 text-sm font-semibold">Nothing is trending right now</h3>
          <p className="text-muted-foreground text-xs">
            Posts trend when other people react to, reply to or repost them within the last few
            days.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post: any) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
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
