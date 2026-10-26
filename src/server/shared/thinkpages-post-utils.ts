import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { globalCache } from "~/lib/cache";

/** Shared helpers for ThinkPages post reads and writes. */

/** Visibilities that anyone holding the post id may read (the feed itself lists only "public"). */
const LINK_READABLE_VISIBILITIES = new Set(["public", "unlisted"]);

/**
 * Whether a viewer may read a post by id. Private and draft posts are readable only by the
 * account owner (matched on Clerk user id); public and unlisted posts are readable by anyone.
 */
export function canViewPost(
  post: { visibility?: string | null; account?: { clerkUserId?: string | null } | null },
  viewerClerkUserId?: string | null
): boolean {
  if (LINK_READABLE_VISIBILITIES.has(post.visibility ?? "public")) return true;
  return !!viewerClerkUserId && post.account?.clerkUserId === viewerClerkUserId;
}

/** The IxTwitter sync's `[DiscordMsg:<id>]` marker, in any case and with or without an id. */
const DISCORD_MARKER = /\s*\[DiscordMsg:[^\]]*\]/gi;

/**
 * Removes any `[DiscordMsg:<id>]` marker from user-supplied post content. Only the IxTwitter sync
 * may set one (edit, delete and reactions act on the Discord message it names), so a forged
 * marker would let a post act on someone else's Discord message.
 */
export function stripDiscordMarker(content: string): string {
  return content.replace(DISCORD_MARKER, "");
}

/**
 * The post with its embedded parent and repost dropped when the viewer couldn't read them on
 * their own (a public reply to, or repost of, a private post).
 */
export function withVisibleEmbeds<
  T extends { parentPost?: unknown; repostOf?: unknown } | null | undefined,
>(post: T, viewerClerkUserId?: string | null): T {
  if (!post) return post;
  const visible = (p: any) => (p && canViewPost(p, viewerClerkUserId) ? p : null);
  return { ...post, parentPost: visible(post.parentPost), repostOf: visible(post.repostOf) };
}

/** A persona as other players see it: the owner's Clerk id stays on the server. */
function withoutOwnerId(account: any) {
  if (!account || typeof account !== "object") return account;
  const { clerkUserId: _owner, ...rest } = account;
  return rest;
}

/**
 * A post whose personas (its own, its parent's and its original's) carry no owner Clerk id.
 * canViewPost reads that id, so it runs before this.
 */
export function withoutOwnerIds<T>(post: T): T {
  if (!post || typeof post !== "object") return post;
  const p = post as any;
  const embed = (e: any) => (e ? { ...e, account: withoutOwnerId(e.account) } : e);
  return {
    ...p,
    account: withoutOwnerId(p.account),
    parentPost: embed(p.parentPost),
    repostOf: embed(p.repostOf),
  };
}

/**
 * Reaction tally for a post.
 *
 * `reactionCounts` (JSON) is the authoritative denormalised tally: the add/remove reaction
 * mutations keep it in step with the `PostReaction` rows, and the Discord sync and auto-post
 * writers overwrite it with the full count. Adding the row tally on top double-counted every
 * native reaction, so rows are only used as a fallback when the JSON is missing or empty.
 */
export function resolveReactionCounts(
  stored: unknown,
  reactions?: Array<{ reactionType: string }> | null
): Record<string, number> {
  let counts: Record<string, number> = {};
  try {
    if (stored) {
      const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
      if (parsed && typeof parsed === "object") counts = { ...(parsed as Record<string, number>) };
    }
  } catch {
    // ignore malformed JSON
  }
  if (Object.keys(counts).length > 0) return counts;
  return (reactions ?? []).reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.reactionType] = (acc[reaction.reactionType] || 0) + 1;
    return acc;
  }, {});
}

/** A persona's name as shown in notification titles: display name, else `@username`. */
export function personaDisplayName(account: {
  displayName?: string | null;
  username?: string | null;
}): string | undefined {
  return account.displayName?.trim() || (account.username ? `@${account.username}` : undefined);
}

/** Poll as the client reads it: option vote counts, with the viewer's own votes merged in later. */
export function formatPollForClient(poll: any) {
  if (!poll) return null;
  const votes: Record<string, number> = {};
  let totalVotes = 0;
  poll.options.forEach((opt: any) => {
    const count = opt._count?.votes ?? 0;
    votes[opt.id] = count;
    totalVotes += count;
  });

  return {
    id: poll.id,
    question: poll.question,
    description: poll.description,
    pollType: poll.pollType,
    multiple: poll.multiple,
    isActive: poll.isActive,
    endDate: poll.endDate,
    countryId: poll.countryId,
    options: poll.options.map((opt: any) => ({
      id: opt.id,
      label: opt.label,
      description: opt.description,
    })),
    votes,
    totalVotes,
    hasVoted: false,
    userVotedOptionIds: [],
  };
}

/** Prisma include that loads a poll with each option's vote count. */
export const pollInclude = {
  poll: {
    include: {
      options: {
        include: {
          _count: {
            select: { votes: true },
          },
        },
      },
    },
  },
};

/** Persona fields shown next to a post or comment; `clerkUserId` is for canViewPost and never sent (transformPost drops it). */
const accountSelect = {
  id: true,
  username: true,
  displayName: true,
  profileImageUrl: true,
  accountType: true,
  verified: true,
  clerkUserId: true,
  countryId: true,
  country: { select: { id: true, name: true, flag: true } },
} as const;

export const accountInclude = { account: { select: accountSelect } };

/** A post with its author and the authors of the post it replies to or reposts. */
export const postAuthorsInclude = {
  ...accountInclude,
  parentPost: { include: accountInclude },
  repostOf: { include: accountInclude },
};

/** Everything the feed and post-detail reads load for a post. */
export const postInclude = {
  ...postAuthorsInclude,
  reactions: true,
  mediaAttachments: true,
  ...pollInclude,
  reposts: { select: { accountId: true } },
  _count: { select: { replies: true, reposts: true } },
};

/**
 * Post as the client reads it: parsed hashtags and reaction counts, formatted poll and a display
 * timestamp, and no owner Clerk ids on its personas.
 */
export function transformPost(p: any) {
  if (!p) return p;
  const reactionCounts = resolveReactionCounts(p.reactionCounts, p.reactions);

  return {
    ...withoutOwnerIds(p),
    poll: formatPollForClient(p.poll),
    hashtags: p.hashtags
      ? typeof p.hashtags === "string"
        ? JSON.parse(p.hashtags)
        : p.hashtags
      : [],
    reactionCounts,
    timestamp: p.isAutoGenerated ? p.ixTimeTimestamp.toISOString() : p.createdAt.toISOString(),
  };
}

/** Drop the cached feeds that list posts, after a post is created, edited, deleted or reacted to. */
export async function invalidateFeeds() {
  try {
    await Promise.all([
      globalCache.deleteByPattern("thinkpages_feed:*"),
      globalCache.deleteByPattern("global_activity_feed:*"),
      globalCache.deleteByPattern("user_following_feed:*"),
    ]);
  } catch (error) {
    console.error("Failed to invalidate feeds:", error);
  }
}

/**
 * Loads a post (with its account) for an edit, delete or pin. The owner may always act; a moderator
 * may when their role level is 10 or lower, or 20 or lower and not below the post owner's.
 */
export async function loadPostForModeration(
  db: Pick<PrismaClient, "thinkpagesPost" | "user">,
  clerkUserId: string | null | undefined,
  roleLevel: number | null | undefined,
  postId: string,
  action: "update" | "delete" | "pin"
) {
  if (!clerkUserId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `You must be logged in to ${action} posts`,
    });
  }

  const post = await db.thinkpagesPost.findUnique({
    where: { id: postId },
    include: { account: true },
  });
  if (!post) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
  }

  const isOwner = post.account.clerkUserId === clerkUserId;
  let isAllowedMod = false;
  if (!isOwner) {
    const currentUserRoleLevel = roleLevel ?? 100;
    if (currentUserRoleLevel <= 10) {
      isAllowedMod = true;
    } else if (currentUserRoleLevel <= 20) {
      const targetUser = await db.user.findUnique({
        where: { clerkUserId: post.account.clerkUserId },
        include: { role: true },
      });
      const targetUserRoleLevel = targetUser?.role?.level ?? 100;
      if (targetUserRoleLevel >= currentUserRoleLevel) {
        isAllowedMod = true;
      }
    }
  }

  if (!isOwner && !isAllowedMod) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You do not have permission to ${action} this post`,
    });
  }

  return post;
}
