import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import { globalCache } from "~/lib/cache";
import { canViewPost } from "../../post-utils";

/** Local reactors listed per call. */
const LOCAL_REACTIONS_LIMIT = 200;
/** Reaction types fetched from Discord per call (one Discord request each). */
const DISCORD_REACTION_TYPES_LIMIT = 10;
/** Discord reactors resolved per call (a guild-member request and a few lookups each). */
const DISCORD_REACTORS_LIMIT = 50;
/** How long one message's Discord-derived reactor list is reused, in seconds. */
const DISCORD_REACTIONS_TTL_SECONDS = 120;

type ReactionsDb = Pick<PrismaClient, "user" | "thinkpagesAccount">;

/**
 * The Discord reactors of an IxTwitter-synced post, each as a local persona when one is linked.
 * Bounded (DISCORD_REACTION_TYPES_LIMIT types, DISCORD_REACTORS_LIMIT reactors) and cached per
 * message and filter, so the public reactions list can't be used to fan out Discord requests.
 */
async function discordReactions(
  db: ReactionsDb,
  post: { id: string; createdAt: Date },
  discordMsgId: string,
  counts: Record<string, number>,
  reactionType: string | undefined
): Promise<any[]> {
  const cacheKey = `thinkpages_discord_reactions:${discordMsgId}:${reactionType ?? "all"}`;
  const cached = await globalCache.get<any[]>(cacheKey);
  if (cached) return cached;
  const fetched = await fetchDiscordReactions(db, post, discordMsgId, counts, reactionType);
  // Only a complete read is cached: a 429 or 5xx on any emoji would otherwise hide its reactors
  // from every viewer for the whole TTL
  if (fetched?.complete) {
    await globalCache.set(cacheKey, fetched.reactors, { ttl: DISCORD_REACTIONS_TTL_SECONDS });
  }
  return fetched?.reactors ?? [];
}

/**
 * The uncached Discord read; null when it could not be made (no token, or Discord failed), and
 * `complete: false` when some emoji's reactor list came back with an error status.
 */
async function fetchDiscordReactions(
  db: ReactionsDb,
  post: { id: string; createdAt: Date },
  discordMsgId: string,
  counts: Record<string, number>,
  reactionType: string | undefined
): Promise<{ reactors: any[]; complete: boolean } | null> {
  const discordBotToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_IXTWITTER_CHANNEL_ID || "557223534418722818";
  if (!discordBotToken) return null;

  try {
    const activeTypes = (reactionType ? [reactionType] : Object.keys(counts))
      .filter((type) => (counts[type] || 0) > 0)
      .slice(0, DISCORD_REACTION_TYPES_LIMIT);

    let complete = true;
    // Fetch reactors for all active emoji types in parallel
    const fetchPromises = activeTypes.map(async (type) => {
      // Map reaction type to Discord emoji format
      let emojiStr = type;
      if (type.startsWith("discord:")) {
        const parts = type.split(":");
        const name = parts[1] || "";
        const id = parts[2] || "";
        emojiStr = id ? `${name}:${id}` : name;
      } else {
        switch (type) {
          case "like":
            emojiStr = "❤️";
            break;
          case "laugh":
            emojiStr = "😂";
            break;
          case "angry":
            emojiStr = "😡";
            break;
          case "sad":
            emojiStr = "😢";
            break;
          case "fire":
            emojiStr = "🔥";
            break;
          case "thumbsup":
            emojiStr = "👍";
            break;
          case "thumbsdown":
            emojiStr = "👎";
            break;
        }
      }

      const encodedEmoji = encodeURIComponent(emojiStr);
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${discordMsgId}/reactions/${encodedEmoji}?limit=${DISCORD_REACTORS_LIMIT}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bot ${discordBotToken}`,
            "User-Agent": "IxStats/1.0",
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (res.ok) {
        const users = (await res.json()) as any[];
        return users.map((u) => ({ ...u, type }));
      }
      complete = false;
      return [];
    });

    const fetchedResults = await Promise.all(fetchPromises);
    const allFetchedReactors = fetchedResults
      .flat()
      .filter((u) => !u.bot)
      .slice(0, DISCORD_REACTORS_LIMIT);

    // Fetch guild member nicknames and map accounts in parallel
    const memberPromises = allFetchedReactors.map(async (u) => {
      const discordAvatarUrl = u.avatar
        ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
        : null;

      let serverNickname = u.global_name || u.username;

      // Guild nicknames need the guild ID; without it the Discord name is shown.
      const guildId = env.DISCORD_GUILD_ID;
      if (guildId) {
        try {
          const memberRes = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${u.id}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bot ${discordBotToken}`,
                "User-Agent": "IxStats/1.0",
              },
              signal: AbortSignal.timeout(3000),
            }
          );
          if (memberRes.ok) {
            const memberData = (await memberRes.json()) as { nick?: string | null };
            if (memberData.nick) {
              serverNickname = memberData.nick;
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch guild member nickname for ${u.id}:`, err);
        }
      }

      let localAcc = null;

      // 1. Look up User by Discord ID or Username (IxnayID auth sync)
      const linkedUser = await db.user.findFirst({
        where: {
          OR: [{ discordUserId: u.id }, { discordUsername: u.username }],
        },
        select: {
          clerkUserId: true,
        },
      });

      // 2. If User found, look up their ThinkpagesAccount
      if (linkedUser) {
        localAcc = await db.thinkpagesAccount.findFirst({
          where: {
            clerkUserId: linkedUser.clerkUserId,
          },
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
            accountType: true,
            verified: true,
          },
        });
      }

      // 3. Fallback to direct username or bio lookup
      if (!localAcc) {
        localAcc = await db.thinkpagesAccount.findFirst({
          where: {
            OR: [{ username: u.username }, { bio: { contains: `discord:${u.username}` } }],
          },
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
            accountType: true,
            verified: true,
          },
        });
      }

      if (localAcc) {
        return {
          id: `discord_react_${u.id}_${u.type}`,
          postId: post.id,
          reactionType: u.type,
          timestamp: new Date(post.createdAt),
          account: {
            ...localAcc,
            displayName: serverNickname || localAcc.displayName,
            profileImageUrl: discordAvatarUrl || localAcc.profileImageUrl,
          },
        };
      } else {
        return {
          id: `discord_react_${u.id}_${u.type}`,
          postId: post.id,
          reactionType: u.type,
          timestamp: new Date(post.createdAt),
          account: {
            id: `discord_user_${u.id}`,
            username: serverNickname,
            displayName: serverNickname,
            profileImageUrl: discordAvatarUrl,
            accountType: "citizen",
            verified: false,
            isDiscordUser: true,
          },
        };
      }
    });

    const processedReactions = await Promise.all(memberPromises);
    return { reactors: processedReactions, complete };
  } catch (e) {
    console.error("Failed to fetch reactions from Discord API:", e);
    return null;
  }
}

export const thinkpagesPostsReactionsQueriesRouter = createTRPCRouter({
  // ===== THINKSHARE (MESSAGING) ENDPOINTS =====

  // Get post reactions with account details. Public and rate limited; the newest
  // LOCAL_REACTIONS_LIMIT local reactors plus a bounded, cached Discord list.
  getPostReactions: rateLimitedPublicProcedure
    .input(
      z.object({
        postId: z.string(),
        reactionType: z.string().max(200).optional(), // Filter by specific reaction type
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          content: true,
          visibility: true,
          reactionCounts: true,
          createdAt: true,
          account: { select: { clerkUserId: true } },
        },
      });
      // A private post's reactors are as private as the post.
      if (!post || !canViewPost(post, ctx.auth?.userId)) return [];

      const localReactions = await db.postReaction.findMany({
        where: {
          postId: input.postId,
          ...(input.reactionType ? { reactionType: input.reactionType } : {}),
        },
        include: {
          account: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true,
              accountType: true,
              verified: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: LOCAL_REACTIONS_LIMIT,
      });

      // No fallback: when the Discord fetch fails or no bot token is set, only local
      // reactors are listed. The post's reaction counts still come from reactionCounts.
      const discordMsgId = post.content.match(/\[DiscordMsg:(\d+)\]/)?.[1];
      if (!discordMsgId) return localReactions;

      let counts: Record<string, number> = {};
      try {
        if (post.reactionCounts) {
          counts = JSON.parse(post.reactionCounts);
        }
      } catch (e) {
        console.warn("Failed to parse reactionCounts in getPostReactions:", e);
      }

      return [
        ...localReactions,
        ...(await discordReactions(db, post, discordMsgId, counts, input.reactionType)),
      ];
    }),
});
