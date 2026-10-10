import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  lightMutationProcedure,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { linkDiscordAccount } from "~/lib/discord/user-sync";
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

  unlinkWikiAccount: rateLimitedMutationProcedure
    .input(z.object({ source: wikiSourceInput }))
    .mutation(async ({ ctx, input }) => {
      await wikiLinks().unlink(ctx.user.id, input.source);
      return { success: true };
    }),

  linkDiscord: rateLimitedMutationProcedure.mutation(async ({ ctx }) => {
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

  unlinkDiscord: rateLimitedMutationProcedure.mutation(async ({ ctx }) => {
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
});
