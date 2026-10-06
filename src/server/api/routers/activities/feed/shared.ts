// Feed-item builders shared by the global and following feeds.

import type { Prisma, PrismaClient } from "@prisma/client";
import { formatPollForClient } from "~/server/shared/thinkpages-post-utils";
import { containsMutedKeyword } from "~/server/shared/privacy-permissions";

/** Poll with per-option vote counts, as both feeds include it. */
export const POLL_INCLUDE = {
  include: { options: { include: { _count: { select: { votes: true } } } } },
} satisfies Prisma.PollDefaultArgs;

export const FEED_ACCOUNT_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileImageUrl: true,
  accountType: true,
  verified: true,
} satisfies Prisma.ThinkpagesAccountSelect;

/** Stored reactionCounts JSON baseline plus live per-type counts. */
export function mergeReactionCounts(
  stored: string | null | undefined,
  live: Record<string, number> | undefined
): Record<string, number> {
  let baseline: Record<string, number> = {};
  try {
    if (stored) baseline = (JSON.parse(stored) as Record<string, number> | null) ?? {};
  } catch {
    // ignore
  }
  for (const [type, count] of Object.entries(live ?? {})) {
    baseline[type] = (baseline[type] || 0) + count;
  }
  return baseline;
}

/** Parses a stored JSON column, falling back (with a warning) when it is malformed or absent. */
export function parseStoredJson<T>(raw: string | null | undefined, fallback: T, what: string): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`Failed to parse ${what}:`, e);
    return fallback;
  }
}

const RANGE_MS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

/** Start of a "24h" | "7d" | "30d" | "90d" window ending now. */
export function rangeStart(range: keyof typeof RANGE_MS) {
  return new Date(Date.now() - RANGE_MS[range]);
}

/** Restores the Date fields JSON caching flattened to strings. */
export function hydrateCachedActivity<
  T extends { timestamp: string | Date; rawPost?: { createdAt: string; ixTimeTimestamp: string } },
>(act: T) {
  return {
    ...act,
    timestamp: new Date(act.timestamp),
    rawPost: act.rawPost
      ? {
          ...act.rawPost,
          createdAt: new Date(act.rawPost.createdAt),
          ixTimeTimestamp: new Date(act.rawPost.ixTimeTimestamp),
        }
      : undefined,
  };
}

/** Feed author for an activity row: its country when it has one, the platform otherwise. */
export function countryFeedUser(country: any) {
  return country
    ? {
        id: `country-${country.id}`,
        name: country.name,
        countryName: country.name,
        countryId: country.id,
        countryFlag: country.flag ?? null,
      }
    : { id: "system", name: "IxStats System", countryFlag: null };
}

/** Feed item for an ActivityFeed row; the caller supplies the resolved user, metadata and related countries. */
export function activityFeedItem(
  activity: any,
  user: unknown,
  metadata: unknown,
  relatedCountries: string[]
) {
  return {
    id: activity.id,
    type: activity.type,
    category: activity.category,
    source: "activity",
    user,
    content: {
      title: activity.title,
      description: activity.description,
      metadata,
    },
    poll: activity.poll ? formatPollForClient(activity.poll) : null,
    engagement: {
      likes: activity.likes,
      comments: activity.comments,
      shares: activity.shares,
      views: activity.views,
    },
    timestamp: activity.createdAt,
    priority: activity.priority.toLowerCase(),
    visibility: activity.visibility,
    relatedCountries,
  };
}

/** Feed item for a ThinkPages post, without the poll and rawPost fields each feed adds itself. */
export function thinkpagesFeedItem(post: any) {
  const cleanContent = post.content.replace(/\s*\[DiscordMsg:\d+\]\s*$/, "");
  const squashed = cleanContent.replace(/\s+/g, " ").trim();
  return {
    id: `thinkpages-${post.id}`,
    type: "social",
    category: "social",
    source: "thinkpages",
    user: {
      id: post.accountId,
      name: `@${post.account.username}`,
      countryName: post.account.country?.name,
      countryId: post.account.country?.id,
      countryFlag: post.account.country?.flag ?? null,
    },
    content: {
      title: squashed.length ? squashed : `@${post.account.username} · ThinkPages`,
      description: cleanContent,
      mediaAttachments: post.mediaAttachments.map((m: any) => ({
        id: m.id,
        url: m.url,
        filename: m.filename,
      })),
      reactionCounts: parseStoredReactionCounts(post.reactionCounts),
      metadata: {
        accountType: post.account.accountType,
        verified: post.account.verified,
        trending: post.trending,
        postType: "thinkpages",
      },
    },
    engagement: {
      likes: post.likeCount,
      comments: post.replyCount,
      shares: post.repostCount,
      views: post.impressions,
    },
    timestamp: post.isAutoGenerated ? post.ixTimeTimestamp : post.createdAt,
    priority: post.trending ? "high" : "medium",
    visibility: post.visibility,
    relatedCountries: post.account.country?.id ? [post.account.country.id] : [],
  };
}

function parseStoredReactionCounts(stored: unknown) {
  try {
    return typeof stored === "string" ? JSON.parse(stored) : stored || null;
  } catch {
    return null;
  }
}

/** Merge the viewer's own poll votes (hasVoted / userVotedOptionIds) into the paginated slice. */
export async function withViewerPollVotes<T extends { poll?: { id: string } | null }>(
  db: PrismaClient,
  viewerClerkId: string | null | undefined,
  activities: T[]
): Promise<T[]> {
  const pollIds = activities.flatMap((a) => (a.poll?.id ? [a.poll.id] : []));
  const votedOptions = new Map<string, string[]>();
  if (viewerClerkId && pollIds.length > 0) {
    const userVotes = await db.pollVote.findMany({
      where: { pollId: { in: pollIds }, userId: viewerClerkId },
      select: { pollId: true, optionId: true },
    });
    for (const vote of userVotes) {
      votedOptions.set(vote.pollId, [...(votedOptions.get(vote.pollId) ?? []), vote.optionId]);
    }
  }
  return activities.map((act) =>
    act.poll
      ? {
          ...act,
          poll: {
            ...act.poll,
            hasVoted: votedOptions.has(act.poll.id),
            userVotedOptionIds: votedOptions.get(act.poll.id) ?? [],
          },
        }
      : act
  );
}

/** Leaves out feed items whose title or text contains one of the viewer's muted words (SL-4). */
export function dropMutedItems<T extends { content?: { title?: string; description?: string } }>(
  items: T[],
  mutedWords: string[]
): T[] {
  if (mutedWords.length === 0) return items;
  return items.filter(
    (item) =>
      !containsMutedKeyword(item.content?.title, mutedWords) &&
      !containsMutedKeyword(item.content?.description, mutedWords)
  );
}
