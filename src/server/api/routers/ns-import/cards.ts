/**
 * NationStates Import Router
 *
 * Handles importing NS trading cards into IxCards system
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure, publicProcedure } from "~/server/api/trpc";
import { nsApiClient } from "~/lib/ns-api-client";
import { nsImportService } from "~/lib/ns-import-service";
import { processCTENationFilter } from "~/lib/ns-sync-processor";
import { computeCardValue, getValuationConfig } from "~/lib/card-valuation";
import { Prisma } from "@prisma/client";

// ─── Background Processing Functions ──────────────────────────────

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
  requestSelfServiceTakedown: publicProcedure
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

      // 1. Verify nation ownership on NationStates
      const isVerified = await nsApiClient.verifyOwnership(
        input.nationName.trim(),
        input.checksum.trim()
      );

      if (!isVerified) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "NationStates verification failed. Please check your nation name and checksum code.",
        });
      }

      // 2. Validate nation match against card title / metadata
      const cleanNation = input.nationName.toLowerCase().replace(/_/g, " ").trim();
      const cleanTitle = card.title.toLowerCase().replace(/_/g, " ").trim();

      const isMatch = cleanTitle.includes(cleanNation) || cleanNation.includes(cleanTitle);

      if (!isMatch) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Verified nation "${input.nationName}" does not match card target "${card.title}". Takedowns require ownership of the card's flag nation.`,
        });
      }

      // 3. Retire card and purge artwork
      const prevMetadata = (card.metadata as Record<string, any>) || {};
      await ctx.db.card.update({
        where: { id: card.id },
        data: {
          isRetired: true,
          retiredAt: new Date(),
          artwork: null,
          artworkVariants: Prisma.DbNull,
          metadata: {
            ...prevMetadata,
            nsTakedown: {
              selfService: true,
              verifiedNation: input.nationName.trim(),
              hiddenAt: new Date().toISOString(),
              reason: input.reason || "Self-service flag owner takedown request",
            },
          },
        },
      });

      return {
        success: true,
        cardId: card.id,
        title: card.title,
        message: `Card artwork for "${card.title}" has been retired per verified nation owner request.`,
      };
    }),
  /**
   * Get user's import history
   */
  getMyImportHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get user's vault transactions for NS imports
      const vault = await ctx.db.myVault.findUnique({
        where: { userId: ctx.user.id },
        include: {
          transactions: {
            where: {
              source: "ns_import_bonus",
            },
            orderBy: { createdAt: "desc" },
            take: input.limit,
          },
        },
      });

      const imports = vault?.transactions || [];

      return imports.map((tx) => ({
        id: tx.id,
        nationName: (tx.metadata as any)?.nationName || "Unknown",
        cardsImported: (tx.metadata as any)?.cardsImported || 0,
        totalValue: (tx.metadata as any)?.totalValue || 0,
        bonusCredits: tx.credits,
        importedAt: tx.createdAt,
      }));
    }),

  /**
   * Get import statistics
   */
  getImportStats: protectedProcedure.query(async ({ ctx }) => {
    // Count NS import transactions
    const vault = await ctx.db.myVault.findUnique({
      where: { userId: ctx.user.id },
      include: {
        transactions: {
          where: {
            source: "ns_import_bonus",
          },
        },
      },
    });

    const imports = vault?.transactions || [];
    const totalImports = imports.length;
    const lastImport = imports[0]?.createdAt || null;

    // Count imported cards
    const importedCards = await ctx.db.cardOwnership.findMany({
      where: {
        userId: ctx.user.id,
        cards: {
          cardType: "NS_IMPORT",
        },
      },
      include: {
        cards: true,
      },
    });

    const totalCards = importedCards.reduce((sum, ownership) => sum + ownership.quantity, 0);
    const totalValue = importedCards.reduce(
      (sum, ownership) => sum + (ownership.cards.marketValue || 0),
      0
    );

    return {
      totalImports,
      totalCards,
      totalValue,
      lastImport,
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
      const card = await ctx.db.card.findFirst({
        where: { nsCardId: input.nsCardId, nsSeason: input.nsSeason },
      });

      if (!card) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No NS card found for ${input.nsCardId} S${input.nsSeason}`,
        });
      }

      const prevMetadata = (card.metadata as Record<string, any>) || {};
      await ctx.db.card.update({
        where: { id: card.id },
        data: {
          isRetired: true,
          retiredAt: new Date(),
          artwork: null,
          artworkVariants: Prisma.DbNull,
          metadata: {
            ...prevMetadata,
            nsTakedown: {
              hiddenAt: new Date().toISOString(),
              hiddenBy: ctx.user.id,
              reason: input.reason || null,
            },
          },
        },
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
      const card = await ctx.db.card.findFirst({
        where: { nsCardId: input.nsCardId, nsSeason: input.nsSeason },
      });

      if (!card) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No NS card found for ${input.nsCardId} S${input.nsSeason}`,
        });
      }

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
   * Tags all NS_IMPORT cards with metadata.isCTE (true if nation has Ceased To Exist).
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
        where: {
          ownerId: ctx.user.id,
          cards: { cardType: "NS_IMPORT", nsCardId: { not: null } },
        },
        select: {
          cardId: true,
          acquiredAt: true,
          cards: {
            select: {
              id: true,
              title: true,
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
      .map((o) => {
        const meta = (o.cards.metadata as Record<string, any>) || {};
        const nation = (meta.nsData?.name as string) || o.cards.title;
        const takedown = meta.nsTakedown as Record<string, any> | null | undefined;
        return {
          cardId: o.cards.id,
          title: o.cards.title,
          nsCardId: o.cards.nsCardId,
          nsSeason: o.cards.nsSeason,
          nation,
          isHidden: o.cards.isRetired,
          hiddenAt: takedown?.hiddenAt ?? o.cards.retiredAt ?? null,
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
  hideMyCard: protectedProcedure
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
          cardType: "NS_IMPORT",
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
      const meta = (card.metadata as Record<string, any>) || {};
      const nation = (meta.nsData?.name as string) || card.title;
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

      await ctx.db.card.update({
        where: { id: card.id },
        data: {
          isRetired: true,
          retiredAt: new Date(),
          artwork: null,
          artworkVariants: Prisma.DbNull,
          metadata: {
            ...meta,
            nsTakedown: {
              hiddenAt: new Date().toISOString(),
              hiddenBy: ctx.user.id,
              reason: input.reason || null,
              selfService: true,
            },
          },
        },
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

  // ─── Bulk Import Endpoints ────────────────────────────────────────

  // ─── Pause / Play / Stop controls ───

  // ─── Region Discovery ────────────────────────────────────────────

  /**
   * Batch-update gameplay stats (economic/diplomatic/military/social)
   * for all NS_IMPORT cards that don't have them yet.
   */
  batchUpdateCardStats: adminProcedure
    .input(
      z
        .object({
          forceAll: z.boolean().optional().default(false),
        })
        .optional()
        .default({ forceAll: false })
    )
    .mutation(async ({ ctx, input }) => {
      const BATCH = 100;
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      // Get all NS_IMPORT cards
      const cards = await ctx.db.card.findMany({
        where: { cardType: "NS_IMPORT" },
        select: { id: true, nsCardId: true, stats: true },
      });

      console.log(
        `[NS Import] Batch updating stats for ${cards.length} NS cards (forceAll=${input.forceAll})`
      );

      for (let i = 0; i < cards.length; i += BATCH) {
        const batch = cards.slice(i, i + BATCH);
        const updates = [];

        for (const card of batch) {
          const existingStats = card.stats as Record<string, unknown> | null;
          if (!existingStats) {
            skipped++;
            continue;
          }

          // Skip if already has gameplay stats (unless forceAll)
          if (!input.forceAll && typeof existingStats.economic === "number") {
            skipped++;
            continue;
          }

          const gameplayStats = nsImportService.generateCardStats(
            {
              govt: existingStats.govt as string | undefined,
              marketValue: existingStats.marketValue as string | undefined,
              badge: existingStats.badge as string | undefined,
              trophies: existingStats.trophies as string | undefined,
              region: existingStats.region as string | undefined,
              category: existingStats.category as string | undefined,
              cardcategory: existingStats.cardcategory as string | undefined,
            },
            card.nsCardId ?? undefined
          );

          updates.push(
            ctx.db.card.update({
              where: { id: card.id },
              data: {
                stats: { ...existingStats, ...gameplayStats },
              },
            })
          );
        }

        if (updates.length > 0) {
          try {
            await Promise.all(updates);
            updated += updates.length;
          } catch (err) {
            errors += updates.length;
            console.error(`[NS Import] Batch error at offset ${i}:`, err);
          }
        }

        if ((i + BATCH) % 1000 === 0 || i + BATCH >= cards.length) {
          console.log(
            `[NS Import] Progress: ${Math.min(i + BATCH, cards.length)}/${cards.length} (updated: ${updated}, skipped: ${skipped})`
          );
        }
      }

      console.log(
        `[NS Import] Batch stats complete: ${updated} updated, ${skipped} skipped, ${errors} errors`
      );
      return { updated, skipped, errors, total: cards.length };
    }),

  /**
   * Refresh market values for user's 0-value NS cards by re-fetching from NS API,
   * then recalculate deckValue from actual card values.
   */
  refreshCardValues: protectedProcedure.mutation(async ({ ctx }) => {
    // Find all NS_IMPORT cards owned by the current user with 0 market value
    const ownerships = await ctx.db.cardOwnership.findMany({
      where: { userId: ctx.user.id },
      select: {
        cardId: true,
        cards: {
          select: {
            id: true,
            nsCardId: true,
            nsSeason: true,
            marketValue: true,
            cardType: true,
            stats: true,
            rarity: true,
          },
        },
      },
    });

    const valCfg = await getValuationConfig(ctx.db);
    let refreshed = 0;
    let failed = 0;

    // Fix 0-value NS cards by re-fetching from NS API
    const zeroValueCards = ownerships.filter(
      (o) =>
        o.cards.cardType === "NS_IMPORT" &&
        o.cards.marketValue === 0 &&
        o.cards.nsCardId &&
        o.cards.nsSeason
    );

    for (const ownership of zeroValueCards) {
      try {
        const info = await nsApiClient.fetchCardInfo(
          String(ownership.cards.nsCardId),
          String(ownership.cards.nsSeason)
        );
        if (info?.market_value) {
          const recomputedValue = computeCardValue(
            {
              rarity: ownership.cards.rarity,
              cardType: ownership.cards.cardType,
              nsMarketValue: parseFloat(info.market_value || "0"),
            },
            valCfg
          );
          if (recomputedValue > 0) {
            await ctx.db.card.update({
              where: { id: ownership.cards.id },
              data: {
                marketValue: recomputedValue,
                stats: {
                  ...((ownership.cards.stats as Record<string, unknown>) || {}),
                  marketValue: info.market_value,
                },
              },
            });
            refreshed++;
          }
        }
      } catch {
        failed++;
      }
    }

    // Recalculate deck value from actual card values
    const allOwned = await ctx.db.cardOwnership.findMany({
      where: { userId: ctx.user.id },
      select: { cards: { select: { marketValue: true } } },
    });

    const totalDeckValue = allOwned.reduce((sum, o) => sum + Math.max(1, o.cards.marketValue), 0);
    const totalCards = allOwned.length;

    await ctx.db.user.update({
      where: { id: ctx.user.id },
      data: {
        deckValue: totalDeckValue,
        totalCards: totalCards,
      },
    });

    return {
      refreshed,
      failed,
      totalCards,
      deckValue: totalDeckValue,
      zeroValueChecked: zeroValueCards.length,
    };
  }),
});
