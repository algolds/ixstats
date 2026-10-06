import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { notificationHooks } from "~/lib/notifications/hooks";
import { validateNoXSS } from "~/lib/utils";
import { vaultService } from "~/lib/vault/vault-service";
import { invalidateFeeds, personaDisplayName, postAuthorsInclude } from "../../post-utils";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { ownHashtags } from "~/server/shared/realm-board";
import { recipientsBlockingSender } from "~/server/shared/user-blocks";
import { recipientsRefusing } from "~/server/shared/privacy-permissions";

/** Visibilities whose posts other people can open, so they may trigger notifications. */
const NOTIFIABLE_VISIBILITIES = new Set(["public", "unlisted"]);

const CreatePostSchema = z.object({
  accountId: z.string(), // ThinkpagesAccount ID for feed posts
  content: z
    .string()
    .max(10000)
    .optional()
    .default("")
    .refine(
      (content) => {
        if (!content) return true;
        const validation = validateNoXSS(content);
        return validation.valid;
      },
      {
        message:
          "Content contains potentially unsafe HTML. Please avoid using script tags, javascript: URLs, or event handlers.",
      }
    ),
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  visibility: z.enum(["public", "private", "unlisted", "draft"]).default("public"),
  parentPostId: z.string().optional(), // For replies
  repostOfId: z.string().optional(), // For reposts
  visualizations: z
    .array(
      z.object({
        type: z.enum([
          "economic_chart",
          "diplomatic_map",
          "trade_flow",
          "gdp_growth",
          "demographics",
          "budget_debt",
          "labor_market",
          "national_vitality",
        ]),
        title: z.string(),
        config: z
          .object({
            chartType: z.string().optional(),
            dataSource: z.string().optional(),
            timeRange: z
              .union([
                z.string(),
                z.object({
                  start: z.string().optional(),
                  end: z.string().optional(),
                }),
              ])
              .optional(),
            metrics: z.array(z.string()).optional(),
            countries: z.array(z.string()).optional(),
            colors: z.array(z.string()).optional(),
            displayOptions: z
              .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
              .optional(),
          })
          .passthrough(), // Allow additional custom properties
      })
    )
    .optional(), // Data visualizations embedded in post
  mediaUrls: z.array(z.string()).max(4).optional(), // Up to 4 images per post
  postToDiscord: z.boolean().optional().default(true),
  poll: z
    .object({
      question: z.string().min(1).max(500),
      description: z.string().max(2000).optional(),
      pollType: z.enum(["choice", "feature-poll"]).default("choice"),
      multiple: z.boolean().default(false),
      options: z.array(z.string().min(1).max(200)).min(2, "At least 2 options are required"),
    })
    .optional(),
});

type PostDb = Pick<
  PrismaClient,
  | "thinkpagesAccount"
  | "thinkpagesPost"
  | "poll"
  | "mediaAttachment"
  | "postMention"
  | "userConnection"
  | "user"
  | "countryFollow"
  | "thinkpagesFollow"
>;

const logNotifyFailure = (kind: string) => (err: unknown) =>
  console.error(`[ThinkPages] Failed to send ${kind} notification:`, err);

/** The caller's active persona; the caller must own it. */
async function requirePostingAccount(db: PostDb, accountId: string, clerkUserId: string) {
  const account = await db.thinkpagesAccount.findUnique({ where: { id: accountId } });

  if (!account || !account.isActive) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Account not found or inactive" });
  }
  if (account.clerkUserId !== clerkUserId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to post from this account",
    });
  }
  return account;
}

const mediaAttachmentData = (postId: string, urls: string[]) =>
  urls.map((url, index) => ({
    postId,
    type: "image",
    url,
    filename: `image_${index + 1}`,
    mimeType: url.startsWith("data:") ? url.split(";")[0]!.split(":")[1] : "image/jpeg",
    fileSize: null,
  }));

/**
 * Record @mentions and notify the owning user of each mentioned persona once, never the author.
 * Users who blocked the author, or whose mention setting excludes them (SL-4), are not notified;
 * the mention is still recorded.
 */
async function recordMentions(
  db: PostDb,
  post: { id: string },
  input: { content: string; mentions: string[] },
  notify: { clerkUserId: string; actorName: string | undefined; notifiable: boolean }
) {
  const mentionedAccounts = await db.thinkpagesAccount.findMany({
    where: { username: { in: input.mentions.map((m) => m.replace("@", "")) } },
    select: { id: true, username: true, clerkUserId: true },
  });
  if (mentionedAccounts.length === 0) return;

  await db.postMention.createMany({
    data: mentionedAccounts.map((mentioned) => ({
      postId: post.id,
      mentionedAccountId: mentioned.id,
      position: input.content.indexOf(`@${mentioned.username}`),
    })),
  });

  if (!notify.notifiable) return;
  // Notifications are keyed by Clerk user id.
  const candidates = [
    ...new Set(
      mentionedAccounts
        .map((mentioned) => mentioned.clerkUserId)
        .filter((id): id is string => !!id && id !== notify.clerkUserId)
    ),
  ];
  if (candidates.length === 0) return;
  const [blocking, refusing] = await Promise.all([
    recipientsBlockingSender(db, notify.clerkUserId, candidates),
    recipientsRefusing(db, notify.clerkUserId, candidates, "mentions"),
  ]);
  const excluded = new Set([...blocking, ...refusing]);
  const recipients = candidates.filter((id) => !excluded.has(id));
  for (const recipient of recipients) {
    await notificationHooks
      .onSocialActivity({
        activityType: "mention",
        fromUserId: notify.clerkUserId,
        fromUserName: notify.actorName,
        toUserId: recipient,
        contentTitle: input.content.substring(0, 50),
        contentId: post.id,
      })
      .catch(logNotifyFailure("mention"));
  }
}

/** IxCredits for a social post: 1 IxC for each of the first 5 posts per day. Never blocks posting. */
async function awardPostCredits(
  db: PostDb,
  clerkUserId: string,
  post: { id: string },
  meta: { postType: string; accountId: string }
) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const postsToday = await db.thinkpagesPost.count({
      where: { accountId: meta.accountId, createdAt: { gte: today } },
    });
    if (postsToday > 5) return 0;

    const earnResult = await vaultService.earnCredits(
      clerkUserId,
      1,
      "EARN_SOCIAL",
      "SOCIAL_POST",
      db as any,
      { postId: post.id, ...meta }
    );
    return earnResult.success ? 1 : 0;
  } catch (error) {
    console.error("[ThinkPages] Failed to award post credits:", error);
    return 0;
  }
}

/** Fire-and-forget Discord autoposts so the createPost response stays fast. */
async function mirrorToDiscord(
  db: PostDb,
  post: {
    id: string;
    content: string;
    ixTimeTimestamp?: Date | string;
    pollId?: string | null;
    visibility: string;
    postType: string;
  },
  account: {
    displayName: string;
    username: string;
    verified: boolean;
    profileImageUrl?: string | null;
  },
  input: { postToDiscord: boolean; mediaUrls?: string[] }
) {
  // Public, non-repost posts go to the IxTwitter channel.
  if (input.postToDiscord && post.visibility === "public" && post.postType !== "repost") {
    try {
      const { postThinkPagesToDiscord } = await import("~/lib/discord/ixtwitter-sync");
      postThinkPagesToDiscord(
        db as any,
        post,
        {
          displayName: account.displayName,
          username: account.username,
          verified: account.verified,
          profileImageUrl: account.profileImageUrl,
        },
        input.mediaUrls
      ).catch((err: unknown) =>
        console.error("[ThinkPages] Autopost to Discord promise error:", err)
      );
    } catch (error) {
      console.error("[ThinkPages] Failed to trigger Discord autopost:", error);
    }
  }

  // Mirror to the admin-configured #thinkpages Discord feed (filtered, deduped).
  // Independent of the IxTwitter autopost above; the filter/enable lives in admin config.
  if (post.visibility === "public") {
    try {
      const { mirrorThinkPagesPostToDiscordFeed } = await import("~/lib/discord/thinkpages-feed");
      mirrorThinkPagesPostToDiscordFeed(db as any, post.id, input.mediaUrls).catch((err: unknown) =>
        console.error("[ThinkPages] Discord feed mirror promise error:", err)
      );
    } catch (error) {
      console.error("[ThinkPages] Failed to trigger Discord feed mirror:", error);
    }
  }
}

/** Notify the original author of a repost or quote (never for self-reposts or private posts). */
async function notifyRepost(
  post: {
    id: string;
    repostOf?: { content: string | null; account: { clerkUserId: string | null } } | null;
  },
  input: { content: string; repostOfId?: string },
  from: { clerkUserId: string; actorName: string | undefined }
) {
  const originalAuthorId = post.repostOf?.account?.clerkUserId;
  if (!input.repostOfId || !originalAuthorId || originalAuthorId === from.clerkUserId) return;

  const isQuote = input.content.trim().length > 0;
  await notificationHooks
    .onSocialActivity({
      activityType: isQuote ? "quote" : "repost",
      fromUserId: from.clerkUserId,
      fromUserName: from.actorName,
      toUserId: originalAuthorId,
      contentTitle: isQuote
        ? input.content.substring(0, 50)
        : (post.repostOf?.content ?? "").substring(0, 50) || undefined,
      // A quote links to the quoting post; a plain repost to the original.
      contentId: isQuote ? post.id : input.repostOfId,
    })
    .catch(logNotifyFailure("repost"));
}

/** Bump the denormalised reply / repost counters on the parent or original post. */
async function bumpEngagementCounters(
  db: PostDb,
  input: { parentPostId?: string; repostOfId?: string }
) {
  if (input.parentPostId) {
    await db.thinkpagesPost.updateMany({
      where: { id: input.parentPostId },
      data: { replyCount: { increment: 1 } },
    });
  }
  if (input.repostOfId) {
    await db.thinkpagesPost.updateMany({
      where: { id: input.repostOfId },
      data: { repostCount: { increment: 1 } },
    });
  }
}

export const thinkpagesPostsPostsCreateRouter = createTRPCRouter({
  createPost: rateLimitedMutationProcedure
    .input(CreatePostSchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to create posts",
        });
      }
      const account = await requirePostingAccount(db, input.accountId, clerkUserId);

      const postType = input.repostOfId ? "repost" : input.parentPostId ? "reply" : "original";

      const poll = input.poll
        ? await db.poll.create({
            data: {
              question: input.poll.question,
              description: input.poll.description,
              pollType: input.poll.pollType,
              multiple: input.poll.multiple,
              options: { create: input.poll.options.map((label) => ({ label })) },
            },
          })
        : null;

      const post = await db.thinkpagesPost.create({
        data: {
          accountId: input.accountId,
          content: input.content,
          // Board placement tags are server-set (createGroupPost); a plain post can't claim one.
          hashtags: input.hashtags ? JSON.stringify(ownHashtags(input.hashtags)) : null,
          visualizations: input.visualizations ? JSON.stringify(input.visualizations) : null,
          postType,
          parentPostId: input.parentPostId,
          repostOfId: input.repostOfId,
          visibility: input.visibility,
          ixTimeTimestamp: new Date(), // Store real-world time for social media timestamps
          pollId: poll?.id ?? null,
        } as any,
        include: postAuthorsInclude,
      });

      if (input.mediaUrls?.length) {
        await db.mediaAttachment.createMany({
          data: mediaAttachmentData(post.id, input.mediaUrls),
        });
      }

      await db.thinkpagesAccount.update({
        where: { id: input.accountId },
        data: { postCount: { increment: 1 } },
      });

      await bumpEngagementCounters(db, input);

      const actorName = personaDisplayName(account);
      // Private and draft posts can only be opened by their author, so they notify nobody.
      const notifiable = NOTIFIABLE_VISIBILITIES.has(post.visibility);

      if (input.mentions?.length) {
        await recordMentions(
          db,
          post,
          { content: input.content, mentions: input.mentions },
          { clerkUserId, actorName, notifiable }
        );
      }

      if (notifiable) await notifyRepost(post, input, { clerkUserId, actorName });

      // Notify if this is a reply. Skip replies to any of the caller's own personas (keyed by
      // owning user, not persona).
      if (input.parentPostId && post.parentPost) {
        const parentPost = await db.thinkpagesPost.findUnique({
          where: { id: input.parentPostId },
          select: { id: true, accountId: true, account: { select: { clerkUserId: true } } },
        });

        if (parentPost && parentPost.account.clerkUserId !== clerkUserId) {
          await notificationHooks
            .onThinkPageActivity({
              thinkpageId: post.id,
              title: input.content.substring(0, 50),
              action: "commented",
              authorId: account.clerkUserId,
              authorName: actorName,
              targetUserId: parentPost.account.clerkUserId,
            })
            .catch(logNotifyFailure("reply"));
        }
      }

      const creditsEarned = await awardPostCredits(db, clerkUserId, post, {
        postType,
        accountId: input.accountId,
      });

      await mirrorToDiscord(db, post, account, input);

      queueAchievementCheck(clerkUserId);
      await invalidateFeeds();

      return { ...post, creditsEarned };
    }),
});
