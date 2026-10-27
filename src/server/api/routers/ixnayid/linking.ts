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
} from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { SISTER_READER_IDS } from "~/lib/wiki-os/wiki-hosts";
import {
  createWikiLinkService,
  WikiLinkError,
} from "~/server/modules/identity/identity.wiki-links";
import {
  createNameClaimService,
  toNameClaimTrpcError,
  type ClaimActor,
} from "~/server/modules/identity/identity.name-claims";

// Links are for the sister wikis only: an old IxWiki name joins an account through a name claim.
const sisterSourceInput = z.enum(SISTER_READER_IDS);
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

/** A player acts for their own account only, never as a system owner. */
const playerActor = (user: { id: string; clerkUserId: string }): ClaimActor => ({
  userId: user.id,
  clerkUserId: user.clerkUserId,
  isSystemOwner: false,
});

export const ixnayidLinkingRouter = createTRPCRouter({
  listWikiLinks: protectedProcedure.query(({ ctx }) => wikiLinks().list(ctx.user.id)),

  startWikiVerification: lightMutationProcedure
    .input(z.object({ source: sisterSourceInput, username: z.string().trim().min(1).max(100) }))
    .mutation(({ ctx, input }) =>
      wikiLinks().start(ctx.user.id, input.source, input.username).catch(toTrpcError)
    ),

  confirmWikiVerification: lightMutationProcedure
    .input(z.object({ source: sisterSourceInput }))
    .mutation(({ ctx, input }) =>
      wikiLinks().confirm(ctx.user.id, input.source).catch(toTrpcError)
    ),

  unlinkWikiAccount: rateLimitedMutationProcedure
    .input(z.object({ source: sisterSourceInput }))
    .mutation(async ({ ctx, input }) => {
      await wikiLinks().unlink(ctx.user.id, input.source);
      return { success: true };
    }),

  listMyNameClaims: protectedProcedure.query(({ ctx }) =>
    createNameClaimService(ctx.db).listMine(ctx.user.id)
  ),

  requestNameClaim: rateLimitedMutationProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(85),
        evidence: z.string().trim().max(1000).nullish(),
      })
    )
    .mutation(({ ctx, input }) =>
      createNameClaimService(ctx.db)
        .request(playerActor(ctx.user), { name: input.name, evidence: input.evidence ?? null })
        .catch(toNameClaimTrpcError)
    ),

  setNameClaimVisibility: rateLimitedMutationProcedure
    .input(z.object({ claimId: z.string().min(1).max(64), visible: z.boolean() }))
    .mutation(({ ctx, input }) =>
      createNameClaimService(ctx.db)
        .setVisibility(playerActor(ctx.user), input)
        .catch(toNameClaimTrpcError)
    ),

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
