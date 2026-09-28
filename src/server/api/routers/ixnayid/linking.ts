import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { linkWikiAccount } from "~/lib/wiki-os/adapters/ixstates/user-sync";
import { linkDiscordAccount } from "~/lib/discord/user-sync";
import { linkForumAccount } from "~/server/modules/forum";
import {
  fetchUserPageWikitext,
  fetchWikiUser,
  PROOF_SOURCES,
} from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { createWikiLinkService, WikiLinkError } from "~/server/modules/identity/identity.wiki-links";

const wikiSourceInput = z.enum(PROOF_SOURCES);
const wikiLinks = () => createWikiLinkService(db, { fetchWikiUser, fetchUserPageWikitext });

function toTrpcError(error: Error): never {
  if (error instanceof WikiLinkError) {
    const code = error.code === "WIKI_UNREACHABLE" ? "SERVICE_UNAVAILABLE" : error.code === "TAKEN" ? "CONFLICT" : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message });
  }
  throw error;
}

export const ixnayidLinkingRouter = createTRPCRouter({
  // =========================================================================
  // WIKI LINKING
  // =========================================================================

  linkWiki: protectedProcedure
    .input(z.object({ wikiUsername: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const result = await linkWikiAccount(ctx.user.id, input.wikiUsername, ctx.auth.userId);

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error ?? "Failed to link wiki account",
        });
      }

      return { success: true, wikiUsername: result.wikiUsername };
    }),

  unlinkWiki: protectedProcedure.mutation(async ({ ctx }) => {
    await db.user.update({
      where: { id: ctx.user.id },
      data: {
        wikiUserId: null,
        wikiUsername: null,
        lastWikiSync: null,
      },
    });
    return { success: true };
  }),

  // =========================================================================
  // VERIFIED WIKI ACCOUNT LINKING (token-on-user-page proof)
  // =========================================================================

  listWikiLinks: protectedProcedure.query(({ ctx }) => wikiLinks().list(ctx.user.id)),

  startWikiVerification: protectedProcedure
    .input(z.object({ source: wikiSourceInput, username: z.string().trim().min(1).max(100) }))
    .mutation(({ ctx, input }) => wikiLinks().start(ctx.user.id, input.source, input.username).catch(toTrpcError)),

  confirmWikiVerification: protectedProcedure
    .input(z.object({ source: wikiSourceInput }))
    .mutation(({ ctx, input }) => wikiLinks().confirm(ctx.user.id, input.source).catch(toTrpcError)),

  unlinkWikiAccount: protectedProcedure
    .input(z.object({ source: wikiSourceInput }))
    .mutation(async ({ ctx, input }) => {
      await wikiLinks().unlink(ctx.user.id, input.source);
      return { success: true };
    }),

  // =========================================================================
  // DISCORD LINKING
  // =========================================================================

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

  // =========================================================================
  // FORUM LINKING
  // =========================================================================

  linkForum: protectedProcedure
    .input(z.object({ forumUsername: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const result = await linkForumAccount(ctx.user.id, input.forumUsername, ctx.auth.userId);

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error ?? "Failed to link forum account",
        });
      }

      return { success: true, forumUserId: result.forumUserId };
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
