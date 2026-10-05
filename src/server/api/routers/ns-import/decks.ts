import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import {
  createTRPCRouter,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { nsApiClient } from "~/lib/nationstates/api-client";
import { TRPCError } from "@trpc/server";
import { getVaultConfig, vaultService } from "~/lib/vault/vault-service";
import { computeCardValue, getValuationConfig } from "~/lib/cards/valuation";
import { baseCardCapacity } from "~/lib/cards/general-settings";
import { getBonusConfig, grantBonus, nsImportBonus } from "~/lib/vault/vault-bonus";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { generateNSImportDescription } from "~/lib/nationstates/import-service";

type NsDeck = NonNullable<Awaited<ReturnType<typeof nsApiClient.fetchDeck>>>;
type NsCard = NsDeck["cards"][number];
type ImportUser = { id: string; role?: { level?: number | null } | null };

/** Translate an NS API failure into the TRPCError the client shows. */
function nsFetchError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg === "RATE_LIMIT") {
    return new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "NationStates API rate limit exceeded. Please wait a few minutes and try again.",
    });
  }
  if (msg === "SERVER_ERROR") {
    return new TRPCError({
      code: "BAD_GATEWAY",
      message: "NationStates API is currently unavailable. Please try again later.",
    });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `NationStates API error: ${msg}`,
  });
}

const fetchDeckOrThrow = (nationName: string) =>
  nsApiClient.fetchDeck(nationName).catch((error: unknown) => {
    throw nsFetchError(error);
  });

/** Original card text and NS data for a newly created IxCards definition (never copies NS-authored text verbatim). */
function newNsCardData(nsCard: NsCard, name: string, nationName: string, marketValue: number) {
  return {
    id: `card_ns_${nsCard.id}_s${nsCard.season}`,
    title: name,
    description: generateNSImportDescription(nsCard),
    // Use NS flag as artwork, fallback to placeholder
    artwork: nsCard.flag || "/images/cards/lore-placeholder.svg",
    artworkVariants: nsCard.flag
      ? {
          original: nsCard.flag,
          thumbnail: nsCard.flag,
          large: nsCard.flag,
          flagUrl: nsCard.flag,
        }
      : undefined,
    cardType: "NS_IMPORT",
    rarity: nsCard.rarity,
    season: parseInt(nsCard.season),
    nsCardId: parseInt(nsCard.id),
    nsSeason: parseInt(nsCard.season),
    wikiSource: null,
    wikiArticleTitle: name,
    countryId: null,
    stats: {
      region: nsCard.region,
      category: nsCard.category,
      govt: nsCard.govt,
      cardcategory: nsCard.cardcategory,
      marketValue: nsCard.market_value,
      badge: nsCard.badge,
      trophies: nsCard.trophies,
    },
    metadata: {
      nsData: {
        id: nsCard.id,
        season: nsCard.season,
        rarity: nsCard.rarity,
        name: nsCard.name,
        region: nsCard.region,
        category: nsCard.category,
        govt: nsCard.govt,
        type: nsCard.type,
        cardcategory: nsCard.cardcategory,
        slogan: nsCard.slogan,
        motto: nsCard.motto,
        description: nsCard.description,
        badge: nsCard.badge,
        trophies: nsCard.trophies,
        market_value: nsCard.market_value,
        flag: nsCard.flag,
      },
      importedFrom: nationName,
      importedAt: new Date().toISOString(),
    },
    marketValue,
    totalSupply: 1,
    level: 1,
    enhancements: undefined,
  };
}

type ImportedCard = {
  id: string;
  title: string;
  artwork: string;
  rarity: string;
  season: number;
  marketValue: number;
};

type CardImportOutcome =
  { kind: "skipped"; label: string } | { kind: "owned" } | { kind: "imported"; card: ImportedCard };

/** Import one NS card for the user: find/refresh/create its definition, then grant ownership. */
async function importNsCard(
  db: PrismaClient,
  userId: string,
  nsCard: NsCard,
  nationName: string,
  valCfg: Awaited<ReturnType<typeof getValuationConfig>>
): Promise<CardImportOutcome> {
  // Fetch full card info since deck API may only provide id, season, rarity
  if (
    !nsCard.name ||
    !nsCard.market_value ||
    nsCard.market_value === "0" ||
    nsCard.market_value === "0.00"
  ) {
    console.log(`[NS Import] Fetching card info for ${nsCard.id} S${nsCard.season}`);
    const cardInfo = await nsApiClient.fetchCardInfo(nsCard.id, nsCard.season);
    // Only overwrite fields that cardInfo actually provides
    if (cardInfo) Object.assign(nsCard, cardInfo);
  }

  if (!nsCard.name) {
    console.error(`[NS Import] Could not fetch name for card ${nsCard.id} S${nsCard.season}`);
    return { kind: "skipped", label: `Card ${nsCard.id} S${nsCard.season}` };
  }

  const valuedMarketValue = computeCardValue(
    {
      rarity: nsCard.rarity || "COMMON",
      cardType: "NS_IMPORT",
      nsMarketValue: parseFloat(nsCard.market_value || "0"),
    },
    valCfg
  );

  let card = await db.card.findFirst({
    where: { nsCardId: parseInt(nsCard.id), nsSeason: parseInt(nsCard.season) },
  });

  if (!card) {
    card = await db.card.create({
      data: newNsCardData(nsCard, nsCard.name, nationName, valuedMarketValue),
    });
  } else if (Math.abs(card.marketValue - valuedMarketValue) > 0.01) {
    // Refresh an existing card's value if the recomputed value differs
    card = await db.card.update({
      where: { id: card.id },
      data: {
        marketValue: valuedMarketValue,
        stats: {
          ...(card.stats as Record<string, unknown> | null),
          marketValue: nsCard.market_value,
        },
      },
    });
  }

  const existingOwnership = await db.cardOwnership.findFirst({
    where: { userId, cardId: card.id },
  });
  // Already in the collection: nothing new to import, count or pay for
  if (existingOwnership) return { kind: "owned" };

  const maxSerial = await db.cardOwnership.findFirst({
    where: { cardId: card.id },
    orderBy: { serialNumber: "desc" },
    select: { serialNumber: true },
  });

  await db.cardOwnership.create({
    data: {
      id: `own_${Date.now()}_${userId}_${card.id}`,
      userId,
      cardId: card.id,
      ownerId: userId,
      serialNumber: (maxSerial?.serialNumber || 0) + 1,
      isLocked: false,
    },
  });

  await db.user.update({
    where: { id: userId },
    data: { totalCards: { increment: 1 }, deckValue: { increment: card.marketValue } },
  });

  return {
    kind: "imported",
    card: {
      id: card.id,
      title: card.title,
      artwork: card.artwork ?? "",
      rarity: card.rarity,
      season: card.season ?? parseInt(nsCard.season),
      marketValue: card.marketValue,
    },
  };
}

/**
 * A verification pays for one import: claim it atomically (expire it now) so a repeated or
 * concurrent call can't import and collect the bonus again. `releaseClaim` gives it back when
 * nothing was imported.
 */
async function claimVerification(db: PrismaClient, user: ImportUser, verificationId: string) {
  const verification = await db.nSVerification.findUnique({ where: { id: verificationId } });

  if (!verification) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Verification not found" });
  }
  if (verification.userId !== user.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your verification" });
  }
  if (!verification.verified) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Nation ownership not verified. Please complete verification first.",
    });
  }

  const claimedAt = new Date();
  const claim = await db.nSVerification.updateMany({
    where: { id: verification.id, userId: user.id, verified: true, expiresAt: { gt: claimedAt } },
    data: { expiresAt: claimedAt },
  });
  if (claim.count !== 1) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This verification has expired or was already used. Please verify again.",
    });
  }

  const releaseClaim = () =>
    db.nSVerification
      .update({ where: { id: verification.id }, data: { expiresAt: verification.expiresAt } })
      .catch(() => {});
  return { verification, releaseClaim };
}

export const nsImportDecksRouter = createTRPCRouter({
  /**
   * Fetch a nation's deck (public - no auth required)
   */
  fetchPublicDeck: publicProcedure
    .input(
      z.object({
        nationName: z.string().min(1).max(100),
      })
    )
    .query(async ({ input }) => {
      const deckData = await fetchDeckOrThrow(input.nationName);

      if (!deckData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Failed to fetch deck from NationStates (Unknown Nation or Empty Deck)",
        });
      }

      // Deduplicate cards and track quantities
      const cardMap = new Map<string, { card: NsCard; quantity: number }>();
      for (const card of deckData.cards) {
        const key = `${card.id}-${card.season}`;
        const existing = cardMap.get(key);
        if (existing) {
          existing.quantity += 1;
        } else {
          cardMap.set(key, { card, quantity: 1 });
        }
      }

      // Get unique cards (limit to first 20 unique cards)
      const uniqueCards = Array.from(cardMap.values()).slice(0, 20);

      console.log(
        `[NS Import] Deduplicated ${deckData.cards.length} cards to ${uniqueCards.length} unique cards`
      );

      // Fetch detailed info for unique cards only
      // Process sequentially to respect rate limits
      const cardsWithInfo = [];
      for (const { card, quantity } of uniqueCards) {
        const info = card.name
          ? null
          : await nsApiClient.fetchCardInfo(card.id, card.season).catch((error: unknown) => {
              console.error(`[NS Import] Failed to fetch card info for ${card.id}:`, error);
              return null;
            });
        cardsWithInfo.push({ ...card, ...info, quantity });
      }

      return {
        nation: deckData.nation,
        cards: cardsWithInfo,
        totalCards: deckData.num_cards,
        uniqueCards: cardMap.size,
        deckValue: deckData.deck_value,
      };
    }),

  /**
   * Import trading cards from a NationStates nation
   */
  importDeck: rateLimitedMutationProcedure
    .input(
      z.object({
        verificationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { verification, releaseClaim } = await claimVerification(
        ctx.db,
        ctx.user,
        input.verificationId
      );
      const nationName = verification.nationName;

      // If the deck can't be fetched, nothing was imported: give the verification back.
      const reject = async (code: "NOT_FOUND" | "BAD_REQUEST", message: string) => {
        await releaseClaim();
        throw new TRPCError({ code, message });
      };

      const deckData = await fetchDeckOrThrow(nationName).catch(async (error: unknown) => {
        await releaseClaim();
        throw error;
      });
      if (!deckData) {
        return reject(
          "NOT_FOUND",
          "Failed to fetch deck from NationStates (Unknown Nation or Empty Deck)."
        );
      }
      if (deckData.cards.length === 0) {
        return reject("BAD_REQUEST", "This nation has no cards in their deck.");
      }

      const imported: ImportedCard[] = [];
      const skippedCards: string[] = [];
      let alreadyOwned = 0;

      // Get vault config and calculate user's maximum capacity limit
      const config = await getVaultConfig(ctx.db as any);
      const valCfg = await getValuationConfig(ctx.db);
      const capacityBoost = await vaultService.getCardCapacityBoost(ctx.user.id, ctx.db as any);
      const maxCards = (await baseCardCapacity(ctx.db)) + capacityBoost;

      // Exempt when role level <= 20 and the exemption toggle is enabled
      const isExempt = config.exemptStaffFromLimit && (ctx.user.role?.level ?? 100) <= 20;

      const currentCardsCount = await ctx.db.cardOwnership.count({
        where: { userId: ctx.user.id },
      });

      for (const nsCard of deckData.cards) {
        // Enforce inventory capacity limit check (only if not exempt)
        if (!isExempt && currentCardsCount + imported.length >= maxCards) {
          console.warn(
            `[NS Import] User ${ctx.user.id} hit capacity limit of ${maxCards} cards during deck import.`
          );
          const cardLabel = nsCard.name || `Card ${nsCard.id} S${nsCard.season}`;
          skippedCards.push(`${cardLabel} (Inventory Full)`);
          continue;
        }
        try {
          const outcome = await importNsCard(ctx.db, ctx.user.id, nsCard, nationName, valCfg);
          if (outcome.kind === "imported") imported.push(outcome.card);
          else if (outcome.kind === "owned") alreadyOwned++;
          else skippedCards.push(outcome.label);
        } catch (error) {
          console.error(`[NS Import] Failed to import card ${nsCard.name ?? "unknown"}:`, error);
          if (nsCard.name) {
            skippedCards.push(nsCard.name);
          }
        }
      }

      // Award bonus IxCredits for newly imported cards (per-card, capped — config-tunable),
      // once per nation whichever account imports it
      const bcfg = await getBonusConfig(ctx.db);
      let bonusAmount = nsImportBonus(bcfg, imported.length);
      if (bonusAmount > 0) {
        const bonus = await grantBonus(ctx.db, ctx.user.id, "bonus:ns_deck_import", bonusAmount, {
          onceKey: `bonus:ns_deck_import:${nationName.trim().toLowerCase().replace(/\s+/g, "_")}`,
          metadata: { nationName, cardsImported: imported.length },
        });
        if (!bonus.granted) bonusAmount = 0;
      }
      if (imported.length > 0) queueAchievementCheck(ctx.user.id);

      return {
        success: true,
        cardsImported: imported.length,
        cardsAlreadyOwned: alreadyOwned,
        cardsSkipped: skippedCards.length,
        bonusCredits: bonusAmount,
        nation: nationName,
        cards: imported,
      };
    }),
});
