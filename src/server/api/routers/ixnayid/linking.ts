import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, lightMutationProcedure, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { env } from "~/env";
import { isSystemOwner } from "~/lib/auth";
import { linkDiscordAccount } from "~/lib/discord/user-sync";
import {
  createForumLinkService,
  ForumLinkError,
  lookupForumUser,
  syncUserToForum,
  xfFetch,
  type ForumProfileProof,
} from "~/server/modules/forum";
import {
  fetchUserPageHistory,
  fetchWikiUser,
  PROOF_SOURCES,
} from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import {
  createWikiLinkService,
  WikiLinkError,
} from "~/server/modules/identity/identity.wiki-links";

const wikiSourceInput = z.enum(PROOF_SOURCES);
const wikiLinks = () => createWikiLinkService(db, { fetchWikiUser, fetchUserPageHistory });

const forumLinks = () =>
  createForumLinkService(db, {
    secret: env.FORUM_VERIFICATION_SECRET || env.CRON_SECRET || null,
    lookupUser: lookupForumUser,
    fetchProfile: async (forumUserId) =>
      (await xfFetch<{ user: ForumProfileProof }>(`/users/${forumUserId}/`))?.user ?? null,
    syncProfile: syncUserToForum,
    isSystemOwner,
  });

function forumTrpcError(error: Error): never {
  if (error instanceof ForumLinkError) {
    const code =
      error.code === "FORUM_UNREACHABLE" || error.code === "NOT_CONFIGURED"
        ? "SERVICE_UNAVAILABLE"
        : error.code === "FORUM_USER_NOT_FOUND"
          ? "NOT_FOUND"
          : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message });
  }
  throw error;
}

function toTrpcError(error: Error): never {
  if (error instanceof WikiLinkError) {
    const code =
      error.code === "WIKI_UNREACHABLE"
        ? "SERVICE_UNAVAILABLE"
        : error.code === "TAKEN"
          ? "CONFLICT"
          : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message });
  }
  throw error;
}

export const ixnayidLinkingRouter = createTRPCRouter({
  listWikiLinks: protectedProcedure.query(({ ctx }) => wikiLinks().list(ctx.user.id)),

  startWikiVerification: lightMutationProcedure
    .input(z.object({ source: wikiSourceInput, username: z.string().trim().min(1).max(100) }))
    .mutation(({ ctx, input }) =>
      wikiLinks().start(ctx.user.id, input.source, input.username).catch(toTrpcError)
    ),

  confirmWikiVerification: lightMutationProcedure
    .input(z.object({ source: wikiSourceInput }))
    .mutation(({ ctx, input }) =>
      wikiLinks().confirm(ctx.user.id, input.source).catch(toTrpcError)
    ),

  unlinkWikiAccount: protectedProcedure
    .input(z.object({ source: wikiSourceInput }))
    .mutation(async ({ ctx, input }) => {
      await wikiLinks().unlink(ctx.user.id, input.source);
      return { success: true };
    }),

  linkDiscord: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await linkDiscordAccount(ctx.user.id, ctx.auth.userId);

    if (!result.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: result.error ?? "Failed to link Discord account",
      });
    }

    return {
      success: true,
      discordUserId: result.discordUserId,
      discordUsername: result.discordUsername,
    };
  }),

  unlinkDiscord: protectedProcedure.mutation(async ({ ctx }) => {
    await db.user.update({
      where: { id: ctx.user.id },
      data: {
        discordUserId: null,
        discordUsername: null,
        lastDiscordSync: null,
      },
    });
    return { success: true };
  }),

  /** Issue a short-lived code for the player to put on their XenForo profile. */
  startForumVerification: lightMutationProcedure
    .input(z.object({ forumUsername: z.string().trim().min(1).max(100) }))
    .mutation(({ ctx, input }) =>
      forumLinks().start(ctx.user.id, input.forumUsername).catch(forumTrpcError)
    ),

  /** Read the XenForo profile, check the code, then link the forum account. */
  confirmForumVerification: lightMutationProcedure
    .input(z.object({ forumUsername: z.string().trim().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const result = await forumLinks()
        .confirm(ctx.user.id, ctx.auth.userId, input.forumUsername)
        .catch(forumTrpcError);
      return { success: true, ...result };
    }),

  unlinkForum: protectedProcedure.mutation(async ({ ctx }) => {
    await db.user.update({
      where: { id: ctx.user.id },
      data: {
        forumUserId: null,
        forumUsername: null,
        lastForumSync: null,
      },
    });
    return { success: true };
  }),
});
