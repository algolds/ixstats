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
  adminProcedure,
  publicProcedure,
  rateLimitedPublicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { nsApiClient } from "~/lib/nationstates/api-client";
import { processCTENationFilter } from "~/lib/nationstates/sync-processor";
import type { Prisma, PrismaClient } from "@prisma/client";
import { CardType } from "~/lib/cards/enums";
import { isJsonObject, nsFactsOf } from "~/lib/cards/ns-facts";
import { normalizeNationName } from "~/lib/vault/exploit-corrections";

// ─── Background Processing Functions ──────────────────────────────

async function findNSCard(db: PrismaClient, nsCardId: number, nsSeason: number) {
  const card = await db.card.findFirst({ where: { nsCardId, nsSeason } });
  if (!card) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `No NS card found for ${nsCardId} S${nsSeason}`,
    });
  }
  return card;
}

/** Retire a card, purge its artwork and record the takedown in its metadata. */
async function retireCardArtwork(
  db: PrismaClient,
  card: { id: string; metadata: Prisma.JsonValue },
  takedown: Prisma.InputJsonObject
) {
  await db.card.update({
    where: { id: card.id },
    data: {
      isRetired: true,
      retiredAt: new Date(),
      artwork: null,
      metadata: { ...(card.metadata as Prisma.JsonObject | null), nsTakedown: takedown },
    },
  });
}

export function nationNamesMatch(a: string, b: string): boolean {
  const left = normalizeNationName(a);
  return left.length > 0 && left === normalizeNationName(b);
}

/** The nation an NS card depicts: its facts' name, falling back to the title. */
function cardNationName(card: { title: string; metadata: Prisma.JsonValue }): string {
  return nsFactsOf(card.metadata).name ?? card.title;
}

/** When and why a card was hidden by a takedown, from its metadata. */
function takedownOf(metadata: Prisma.JsonValue): {
  hiddenAt: string | null;
  reason: string | null;
} {
  const takedown =
    isJsonObject(metadata) && isJsonObject(metadata.nsTakedown) ? metadata.nsTakedown : {};
  return {
    hiddenAt: typeof takedown.hiddenAt === "string" ? takedown.hiddenAt : null,
    reason: typeof takedown.reason === "string" ? takedown.reason : null,
  };
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

      // 3. Retire card and purge artwork
      await retireCardArtwork(ctx.db, card, {
        selfService: true,
        verifiedNation: input.nationName.trim(),
        hiddenAt: new Date().toISOString(),
        reason: input.reason || "Self-service flag owner takedown request",
      });

      return {
        success: true,
        cardId: card.id,
        title: card.title,
        message: `Card artwork for "${card.title}" has been retired per verified nation owner request.`,
      };
    }),

  /**
   * Admin: Hide a NationStates-import card (flag-owner takedown / opt-out).
   *
   * Sets the card as retired and clears its artwork so the nation flag stops
   * being served, per a flag owner's objection. The card definition is kept
   * (ownership/history intact) but renders with the placeholder artwork.
   */
  hideNSCard: adminProcedure
    .input(
      z.object({
        nsCardId: z.number().int().positive(),
        nsSeason: z.number().int().positive(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const card = await findNSCard(ctx.db, input.nsCardId, input.nsSeason);

      await retireCardArtwork(ctx.db, card, {
        hiddenAt: new Date().toISOString(),
        hiddenBy: ctx.user.id,
        reason: input.reason || null,
      });

      console.log(
        `[NS Import] Takedown: hid NS card ${input.nsCardId} S${input.nsSeason} (${card.title}) by ${ctx.user.id}`
      );

      return {
        success: true,
        cardId: card.id,
        title: card.title,
        message: `Hidden "${card.title}" (${input.nsCardId} S${input.nsSeason}). Artwork removed; the flag will no longer be served.`,
      };
    }),

  /**
   * Admin: Restore a previously hidden NS-import card (undo takedown).
   */
  restoreNSCard: adminProcedure
    .input(
      z.object({
        nsCardId: z.number().int().positive(),
        nsSeason: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const card = await findNSCard(ctx.db, input.nsCardId, input.nsSeason);

      const prevMetadata = (card.metadata as Record<string, any>) || {};
      await ctx.db.card.update({
        where: { id: card.id },
        data: {
          isRetired: false,
          retiredAt: null,
          metadata: {
            ...prevMetadata,
            nsTakedown: null,
          },
        },
      });

      return {
        success: true,
        cardId: card.id,
        title: card.title,
        message: `Restored "${card.title}". A re-sync will re-add the flag artwork.`,
      };
    }),

  /**
   * Admin: List NS cards currently hidden by takedown.
   */
  listHiddenNSCards: adminProcedure.query(async ({ ctx }) => {
    const cards = await ctx.db.card.findMany({
      where: { isRetired: true, nsCardId: { not: null } },
      select: {
        id: true,
        title: true,
        nsCardId: true,
        nsSeason: true,
        retiredAt: true,
        metadata: true,
      },
      orderBy: { retiredAt: "desc" },
      take: 100,
    });

    return cards.map((card) => {
      const meta = (card.metadata as Record<string, any>) || {};
      return {
        cardId: card.id,
        title: card.title,
        nsCardId: card.nsCardId,
        nsSeason: card.nsSeason,
        retiredAt: card.retiredAt,
        hiddenBy: meta.nsTakedown?.hiddenBy ?? null,
        reason: meta.nsTakedown?.reason ?? null,
        selfService: meta.nsTakedown?.selfService ?? false,
      };
    });
  }),

  /**
   * Admin: Filter imported NS cards against the daily active nations dump (nations.xml.gz).
   * Tags every NS card with metadata.isCTE (true if nation has Ceased To Exist).
   */
  filterCTECards: adminProcedure.mutation(async ({ ctx }) => {
    const result = await processCTENationFilter(ctx.db);
    return {
      success: true,
      ...result,
      message: `CTE filter complete: ${result.totalProcessed} cards processed (${result.activeCount} active, ${result.cteCount} CTE'd).`,
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
      .map(({ cards: card }) => {
        const facts = nsFactsOf(card.metadata);
        const flag = facts.flag ?? card.artwork ?? null;
        const takedown = takedownOf(card.metadata);
        return {
          ...card,
          cardId: card.id,
          artwork: card.artwork || flag || "",
          nation: facts.name ?? card.title,
          imageUrl: flag,
          isHidden: card.isRetired,
          hiddenAt: takedown.hiddenAt ?? card.retiredAt ?? null,
          reason: takedown.reason,
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

      if (card.isRetired) {
        return {
          success: true,
          cardId: card.id,
          title: card.title,
          message: `"${card.title}" is already hidden.`,
        };
      }

      await retireCardArtwork(ctx.db, card, {
        hiddenAt: new Date().toISOString(),
        hiddenBy: ctx.user.id,
        reason: input.reason || null,
        selfService: true,
      });

      console.log(
        `[NS Import] Self-serve takedown: user ${ctx.user.id} hid NS card ${input.nsCardId} S${input.nsSeason} (${card.title})`
      );

      return {
        success: true,
        cardId: card.id,
        title: card.title,
        message: `Hidden "${card.title}". Your flag will no longer be served on this card.`,
      };
    }),
});
