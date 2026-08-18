// src/server/api/routers/ixnayid.ts
// IxnayID — Unified account linking across Forum, Wiki, and Discord.
// Consolidates all external identity connections in one namespace.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { lookupWikiUser, linkWikiAccount } from "~/lib/wiki/user-sync";
import { linkDiscordAccount } from "~/lib/discord/user-sync";
import { linkForumAccount } from "~/server/modules/forum";

export const ixnayidRouter = createTRPCRouter({
  // =========================================================================
  // STATUS — all linked accounts at once
  // =========================================================================

  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        forumUserId: true,
        forumUsername: true,
        lastForumSync: true,
        wikiUserId: true,
        wikiUsername: true,
        lastWikiSync: true,
        discordUserId: true,
        discordUsername: true,
        lastDiscordSync: true,
      },
    });

    return {
      forum: {
        linked: !!user?.forumUserId || !!user?.forumUsername,
        username: user?.forumUsername ?? null,
        lastSync: user?.lastForumSync ?? null,
      },
      wiki: {
        linked: !!user?.wikiUsername,
        username: user?.wikiUsername ?? null,
        lastSync: user?.lastWikiSync ?? null,
      },
      discord: {
        linked: !!user?.discordUserId,
        userId: user?.discordUserId ?? null,
        username: user?.discordUsername ?? null,
        lastSync: user?.lastDiscordSync ?? null,
      },
    };
  }),

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
  // FORUM LINKING (delegates to existing service)
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

  // =========================================================================
  // LOOKUP — preview before linking
  // =========================================================================

  lookupWikiUser: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const result = await lookupWikiUser(input.username);
      return result;
    }),

  lookupForumUser: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const { lookupForumUser } = await import("~/server/modules/forum");
      return lookupForumUser(input.username);
    }),
});
