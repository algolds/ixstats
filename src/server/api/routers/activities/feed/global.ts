import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getRecentChanges as getWikiBridgeRecentChanges } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getForumActivity } from "~/server/modules/forum";
import { globalCache } from "~/lib/cache";
import { hiddenThinkpagesAccountIds } from "~/server/shared/user-blocks";
import { formatPollForClient } from "~/server/shared/thinkpages-post-utils";
import {
  activityFeedItem,
  countryFeedUser,
  FEED_ACCOUNT_SELECT,
  hydrateCachedActivity,
  mergeReactionCounts,
  parseStoredJson,
  POLL_INCLUDE,
  thinkpagesFeedItem,
  withViewerPollVotes,
  dropMutedItems,
} from "./shared";
import { mutedKeywords } from "~/server/shared/privacy-permissions";

const activityFilterSchema = z.object({
  limit: z.number().min(1).max(80).default(20),
  cursor: z.string().optional(),
  filter: z
    .enum(["all", "achievements", "diplomatic", "economic", "social", "meta", "community"])
    .default("all"),
  category: z.enum(["all", "game", "platform", "social"]).default("all"),
  userId: z.string().optional(),
});

type ReactionTally = Map<string, Record<string, number>>;

/** Per-post reaction counts in one grouped query (instead of loading every reaction row). */
async function tallyReactions(db: PrismaClient, postIds: string[]): Promise<ReactionTally> {
  const tally: ReactionTally = new Map();
  if (postIds.length === 0) return tally;
  const groups = await db.postReaction.groupBy({
    by: ["postId", "reactionType"],
    where: { postId: { in: postIds } },
    _count: { _all: true },
  });
  for (const g of groups) {
    const counts = tally.get(g.postId) ?? {};
    counts[g.reactionType] = (counts[g.reactionType] ?? 0) + g._count._all;
    tally.set(g.postId, counts);
  }
  return tally;
}

/**
 * Viewer-only reactions/reposts for the paginated ThinkPages items. Runs after the shared
 * cache so per-viewer data never lands in the cached entry.
 */
async function attachViewerEngagement<T extends { source?: string; rawPost?: { id: string } }>(
  db: PrismaClient,
  viewerClerkId: string | null | undefined,
  activities: T[]
): Promise<T[]> {
  const postIds = activities.flatMap((a) =>
    a.source === "thinkpages" && a.rawPost ? [a.rawPost.id] : []
  );
  if (!viewerClerkId || postIds.length === 0) return activities;
  const accounts = await db.thinkpagesAccount.findMany({
    where: { clerkUserId: viewerClerkId },
    select: { id: true },
  });
  const viewerAccountIds = accounts.map((a) => a.id);
  if (viewerAccountIds.length === 0) return activities;
  const [reactions, reposts] = await Promise.all([
    db.postReaction.findMany({
      where: { postId: { in: postIds }, accountId: { in: viewerAccountIds } },
      select: { postId: true, accountId: true, reactionType: true },
    }),
    db.thinkpagesPost.findMany({
      where: { repostOfId: { in: postIds }, accountId: { in: viewerAccountIds } },
      select: { repostOfId: true, accountId: true },
    }),
  ]);
  return activities.map((act) => {
    const rawPost = act.rawPost;
    if (act.source !== "thinkpages" || !rawPost) return act;
    const postId = rawPost.id;
    return {
      ...act,
      rawPost: {
        ...rawPost,
        reactions: reactions.filter((r) => r.postId === postId),
        reposts: reposts
          .filter((r) => r.repostOfId === postId)
          .map((r) => ({ accountId: r.accountId })),
      },
    };
  });
}

const ACCOUNT_WITH_CLERK = {
  ...FEED_ACCOUNT_SELECT,
  clerkUserId: true,
} satisfies Prisma.ThinkpagesAccountSelect;
const QUOTED_POST_INCLUDE = {
  include: { account: { select: ACCOUNT_WITH_CLERK } },
} satisfies Prisma.ThinkpagesPostDefaultArgs;

const THINKPAGES_INCLUDE = {
  account: {
    select: {
      ...ACCOUNT_WITH_CLERK,
      country: { select: { id: true, name: true, flag: true } },
    },
  },
  parentPost: QUOTED_POST_INCLUDE,
  repostOf: QUOTED_POST_INCLUDE,
  mediaAttachments: true,
  poll: POLL_INCLUDE,
  _count: { select: { replies: true, reposts: true } },
} satisfies Prisma.ThinkpagesPostInclude;

type FeedInput = z.infer<typeof activityFilterSchema>;

/** ActivityFeed rows as feed items, with their users and countries batch-loaded (no N+1). */
async function activityRowItems(db: PrismaClient, input: FeedInput, mergeCap: number) {
  const where: Prisma.ActivityFeedWhereInput = {};
  // Rows are stored with type "achievement"; the filter is named "achievements".
  if (input.filter !== "all" && input.filter !== "community")
    where.type = input.filter === "achievements" ? "achievement" : input.filter;
  if (input.category !== "all") where.category = input.category;
  if (input.userId) where.userId = input.userId;

  const entries = await db.activityFeed.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: mergeCap,
    include: { poll: POLL_INCLUDE },
  });

  const userIds = [...new Set(entries.flatMap((a) => a.userId || []))];
  const countryIds = [...new Set(entries.flatMap((a) => a.countryId || []))];
  const [users, countries] = await Promise.all([
    userIds.length > 0
      ? db.user.findMany({
          where: { clerkUserId: { in: userIds } },
          select: {
            clerkUserId: true,
            countryId: true,
            wikiUsername: true,
            discordUsername: true,
            forumUsername: true,
            country: { select: { name: true, flag: true } },
          },
        })
      : [],
    countryIds.length > 0
      ? db.country.findMany({
          where: { id: { in: countryIds } },
          select: { id: true, name: true, leader: true, flag: true },
        })
      : [],
  ]);
  const userMap = new Map(users.map((u) => [u.clerkUserId, u]));
  const countryMap = new Map(countries.map((c) => [c.id, c]));

  return entries.map((activity) => {
    const dbUser = activity.userId ? userMap.get(activity.userId) : undefined;
    const author = dbUser
      ? {
          id: dbUser.clerkUserId,
          name:
            dbUser.wikiUsername ??
            dbUser.discordUsername ??
            dbUser.forumUsername ??
            dbUser.country?.name ??
            "User",
          countryName: dbUser.country?.name,
          countryId: dbUser.countryId,
          countryFlag: dbUser.country?.flag ?? null,
        }
      : countryFeedUser(activity.countryId ? countryMap.get(activity.countryId) : undefined);
    return activityFeedItem(
      activity,
      author,
      parseStoredJson(activity.metadata, {}, "activity metadata"),
      parseStoredJson<string[]>(activity.relatedCountries, [], "related countries")
    );
  });
}

async function thinkpagesRowItems(db: PrismaClient, mergeCap: number) {
  const posts = await db.thinkpagesPost.findMany({
    where: { visibility: "public" },
    orderBy: { ixTimeTimestamp: "desc" },
    take: mergeCap,
    include: THINKPAGES_INCLUDE,
  });
  const reactionTally = await tallyReactions(
    db,
    posts.map((p) => p.id)
  );
  return posts.map((post) => ({
    ...thinkpagesFeedItem(post),
    poll: post.poll ? formatPollForClient(post.poll) : null,
    rawPost: {
      ...post,
      hashtags: post.hashtags ? JSON.parse(post.hashtags) : [],
      reactionCounts: mergeReactionCounts(post.reactionCounts, reactionTally.get(post.id)),
      reactions: [],
      reposts: [],
      timestamp: (post.isAutoGenerated ? post.ixTimeTimestamp : post.createdAt).toISOString(),
    },
  }));
}

const NO_ENGAGEMENT = { likes: 0, comments: 0, shares: 0, views: 0 };

function wikiChangeDescription(
  rc: { newLen: number; oldLen: number; comment?: string | null },
  isNewPage: boolean
) {
  const sizeChange = rc.newLen - rc.oldLen;
  const sizeStr = `${sizeChange > 0 ? "+" : ""}${sizeChange} bytes`;
  if (isNewPage) return `Created new page (${sizeStr})`;
  const clean = rc.comment?.replace(/\/\*.*?\*\/\s*/, "").trim();
  if (!clean) return `Edited page (${sizeStr})`;
  return `${clean.length <= 100 ? clean : `${clean.slice(0, 97)}...`} (${sizeStr})`;
}

async function wikiChangeItems() {
  const changes = await getWikiBridgeRecentChanges(20);
  return changes.map((rc) => {
    const isNewPage = rc.type === "new";
    return {
      id: `wiki-rc-${rc.title}-${rc.timestamp}`,
      type: "meta",
      category: "platform",
      source: "wiki",
      user: { id: `wiki-user-${rc.user}`, name: rc.user, countryFlag: null },
      content: {
        title: isNewPage ? `New wiki page: ${rc.title}` : `Wiki edit: ${rc.title}`,
        description: wikiChangeDescription(rc, isNewPage),
        metadata: {
          source: "ixwiki",
          pageTitle: rc.title,
          sizeChange: rc.newLen - rc.oldLen,
          isNewPage,
          wikiUrl: `/wiki/${encodeURIComponent(rc.title.replace(/ /g, "_"))}`,
        },
      },
      engagement: NO_ENGAGEMENT,
      timestamp: new Date(rc.timestamp),
      priority: isNewPage ? "medium" : "low",
      visibility: "public",
      relatedCountries: [],
    };
  });
}

async function forumActivityItems() {
  const items = await getForumActivity(20);
  return items.map((item) => ({
    id: item.id,
    type: "social",
    category: "social",
    source: "forum",
    user: { id: `forum-user-${item.author}`, name: item.author, countryFlag: null },
    content: {
      title:
        item.type === "thread"
          ? `New forum thread: ${item.title}`
          : `Forum reply in: ${item.title}`,
      description: item.excerpt || `${item.author} posted in the IxWiki community forum`,
      metadata: {
        source: "xenforo",
        forumName: item.forumName,
        replyCount: item.replyCount,
        viewCount: item.viewCount,
        forumUrl: item.url,
      },
    },
    engagement: {
      ...NO_ENGAGEMENT,
      comments: item.replyCount ?? 0,
      views: item.viewCount ?? 0,
    },
    timestamp: item.timestamp,
    priority: "low",
    visibility: "public",
    relatedCountries: [],
  }));
}

/** External sources (wiki, forum) must never fail the whole feed. */
async function optionalItems<T>(label: string, load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (error) {
    console.error(`[GlobalFeed] ${label} failed:`, error);
    return [];
  }
}

async function buildCombinedActivities(db: PrismaClient, input: FeedInput) {
  const { filter } = input;
  /** Pull a wider slice per source so merges with ThinkPages / wiki / forum stay representative */
  const mergeCap = Math.min(Math.max(input.limit * 4, 48), 150);
  const withWiki = filter === "all" || filter === "meta" || filter === "community";
  const withForum = filter === "all" || filter === "social" || filter === "community";

  const combined: any[] = [
    ...(await activityRowItems(db, input, mergeCap)),
    // ThinkPages only for filters that don't exclude social content
    ...(filter === "all" || filter === "social" ? await thinkpagesRowItems(db, mergeCap) : []),
    ...(withWiki ? await optionalItems("Wiki recent changes", wikiChangeItems) : []),
    ...(withForum ? await optionalItems("Forum activity", forumActivityItems) : []),
  ];
  return combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export const activitiesFeedGlobalRouter = createTRPCRouter({
  // Get global activity feed
  getGlobalFeed: publicProcedure.input(activityFilterSchema).query(async ({ ctx, input }) => {
    try {
      const cacheKey = `global_activity_feed:${input.filter}:${input.category}:${input.userId || "all"}:${input.limit}`;

      const cachedData = await globalCache.get<{ combinedActivities: any[] }>(cacheKey);
      let combinedActivities: any[];
      if (cachedData) {
        combinedActivities = cachedData.combinedActivities.map(hydrateCachedActivity);
      } else {
        combinedActivities = await buildCombinedActivities(ctx.db, input);
        // Cache the combined activities for 60 seconds (matches the dashboard poll)
        await globalCache.set(cacheKey, { combinedActivities }, { ttl: 60 });
      }

      // Leave out ThinkPages posts by accounts the viewer blocked or muted, and anything
      // containing one of the viewer's muted words.
      const [hiddenIds, mutedWords] = await Promise.all([
        hiddenThinkpagesAccountIds(ctx.db, ctx.auth?.userId),
        mutedKeywords(ctx.db, ctx.auth?.userId),
      ]);
      const hidden = new Set(hiddenIds);
      if (hidden.size) {
        combinedActivities = combinedActivities.filter(
          (a) => !(a.source === "thinkpages" && hidden.has(a.rawPost?.accountId))
        );
      }
      combinedActivities = dropMutedItems(combinedActivities, mutedWords);

      // Apply pagination limit to combined results
      const paginatedActivities = await attachViewerEngagement(
        ctx.db,
        ctx.auth?.userId,
        combinedActivities.slice(0, input.limit)
      );
      const nextCursor =
        combinedActivities.length > input.limit ? combinedActivities[input.limit]?.id : undefined;

      return {
        activities: await withViewerPollVotes(ctx.db, ctx.auth?.userId, paginatedActivities),
        nextCursor,
      };
    } catch (error) {
      console.error("Error fetching global activity feed:", error);
      throw new Error("Failed to fetch activity feed", { cause: error });
    }
  }),
});
