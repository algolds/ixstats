/**
 * NationStates Import Router
 *
 * Handles importing NS trading cards into IxCards system
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedPublicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { nsApiClient } from "~/lib/nationstates/api-client";
import type { Prisma } from "@prisma/client";
import { CardType } from "~/lib/cards/enums";
import { nsFactsOf } from "~/lib/cards/ns-facts";
import { normalizeNationName } from "~/lib/vault/exploit-corrections";
import { selfServiceTakedown } from "~/server/modules/cards/cards.compliance";

export function nationNamesMatch(a: string, b: string): boolean {
  const left = normalizeNationName(a);
  return left.length > 0 && left === normalizeNationName(b);
}

/** The nation an NS card depicts: its facts' name, falling back to the title. */
function cardNationName(card: { title: string; metadata: Prisma.JsonValue }): string {
  return nsFactsOf(card.metadata).name ?? card.title;
}

export const nsImportCardsRouter = createTRPCRouter({
  /**
   * Public: Get site-specific NS verification URL for a given nation name.
   * The URL includes a site token (HMAC-MD5) so the checksum is bound to IxStats only.
   */
  getVerificationUrl: publicProcedure
    .input(z.object({ nationName: z.string().min(1) }))
    .query(({ input }) => {
      const url = nsApiClient.getVerificationUrl(input.nationName.trim().toLowerCase());
      return { url };
    }),

  /**
   * Public/Protected: Self-service NationStates card takedown by verifying nation ownership via NS API.
   */
  requestSelfServiceTakedown: rateLimitedPublicProcedure
    .input(
      z.object({
        cardId: z.string(),
        nationName: z.string().min(1),
        checksum: z.string().min(1),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const card = await ctx.db.card.findUnique({
        where: { id: input.cardId },
      });

      if (!card) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not found",
        });
      }

      // Self-service takedowns only cover NationStates flag cards.
      if (card.cardType !== CardType.NS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only NationStates-import cards can be taken down by their flag owner.",
        });
      }

      // 1. Verify nation ownership on NationStates
      const isVerified = await nsApiClient.verifyOwnership(
        input.nationName.trim(),
        input.checksum.trim()
      );

      if (!isVerified) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "NationStates verification failed. Please check your nation name and checksum code.",
        });
      }

      // 2. The verified nation must be exactly the card's nation (not a substring of it).
      if (!nationNamesMatch(input.nationName, cardNationName(card))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Verified nation "${input.nationName}" does not match card target "${card.title}". Takedowns require ownership of the card's flag nation.`,
        });
      }

      // 3. File the takedown and hide the art, through the one takedown queue.
      const { alreadyHidden } = await selfServiceTakedown(ctx.db, {
        cardId: card.id,
        verifiedNation: input.nationName.trim(),
        reason: input.reason,
        requestedBy: ctx.user?.id ?? null,
      });

      return {
        success: true,
        cardId: card.id,
        title: card.title,
        message: alreadyHidden
          ? `"${card.title}" is already hidden.`
          : `Card art for "${card.title}" is hidden, as its flag owner asked.`,
      };
    }),

  // ─── Self-serve flag-owner opt-out (user settings) ────────────────

  /**
   * User: List the NationStates-imported cards this user owns, grouped for
   * the self-serve takedown UI. Also returns the nations the user has
   * NS-verified (proof of flag ownership) so the UI can gate the opt-out.
   */
  getMyNSCards: protectedProcedure.query(async ({ ctx }) => {
    const [ownerships, verified] = await Promise.all([
      ctx.db.cardOwnership.findMany({
        where: { ownerId: ctx.user.id, cards: { cardType: CardType.NS } },
        select: {
          cardId: true,
          acquiredAt: true,
          cards: {
            select: {
              id: true,
              title: true,
              description: true,
              rarity: true,
              season: true,
              cardType: true,
              category: true,
              subcategory: true,
              artwork: true,
              artworkSource: true,
              artworkCredit: true,
              slug: true,
              marketValue: true,
              totalSupply: true,
              nsCardId: true,
              nsSeason: true,
              isRetired: true,
              retiredAt: true,
              metadata: true,
              takedowns: {
                where: { status: "HIDDEN" },
                orderBy: { resolvedAt: "desc" },
                take: 1,
                select: { reason: true, resolvedAt: true },
              },
            },
          },
        },
        orderBy: { acquiredAt: "desc" },
      }),
      ctx.db.nSVerification.findMany({
        where: { userId: ctx.user.id, verified: true },
        select: { nationName: true },
      }),
    ]);

    // Dedupe by (nsCardId, nsSeason) — a user may own multiple copies.
    const seen = new Set<string>();
    const cards = ownerships
      .filter((o) => {
        const key = `${o.cards.nsCardId}-${o.cards.nsSeason}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(({ cards: { takedowns, ...card } }) => {
        const facts = nsFactsOf(card.metadata);
        const flag = facts.flag ?? card.artwork ?? null;
        const takedown = takedowns[0];
        return {
          ...card,
          cardId: card.id,
          artwork: card.artwork || flag || "",
          nation: facts.name ?? card.title,
          imageUrl: flag,
          isHidden: card.isRetired,
          hiddenAt: takedown?.resolvedAt ?? card.retiredAt ?? null,
          reason: takedown?.reason ?? null,
        };
      });

    return {
      verifiedNations: verified.map((v) => v.nationName),
      cards,
    };
  }),

  /**
   * User: Self-serve takedown of a NationStates-imported card (flag-owner
   * opt-out). Requires the user to (a) own the card and (b) have a verified
   * NSVerification for the card's nation — proving they hold the flag rights.
   */
  hideMyCard: rateLimitedMutationProcedure
    .input(
      z.object({
        nsCardId: z.number().int().positive(),
        nsSeason: z.number().int().positive(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const card = await ctx.db.card.findFirst({
        where: {
          nsCardId: input.nsCardId,
          nsSeason: input.nsSeason,
          cardType: CardType.NS,
        },
      });

      if (!card) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No NationStates card found for ${input.nsCardId} S${input.nsSeason}`,
        });
      }

      // (a) The user must own this card.
      const owned = await ctx.db.cardOwnership.findFirst({
        where: { ownerId: ctx.user.id, cardId: card.id },
      });
      if (!owned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must own this card to request a takedown of its flag.",
        });
      }

      // (b) The user must be NS-verified for the card's nation.
      const nation = cardNationName(card);
      const verified = await ctx.db.nSVerification.findFirst({
        where: {
          userId: ctx.user.id,
          verified: true,
          nationName: { equals: nation, mode: "insensitive" },
        },
      });

      if (!verified) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You must verify ownership of "${nation}" on NationStates to remove its flag.`,
        });
      }

      const { alreadyHidden } = await selfServiceTakedown(ctx.db, {
        cardId: card.id,
        verifiedNation: nation,
        reason: input.reason,
        requestedBy: ctx.user.id,
      });
      return {
        success: true,
        cardId: card.id,
        title: card.title,
        message: alreadyHidden
          ? `"${card.title}" is already hidden.`
          : `Hidden "${card.title}". Your flag is no longer shown on this card.`,
      };
    }),
});
