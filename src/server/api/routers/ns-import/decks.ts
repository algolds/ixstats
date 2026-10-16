import { z } from "zod";
import type { Card, Prisma, PrismaClient } from "@prisma/client";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { nsApiClient } from "~/lib/nationstates/api-client";
import { TRPCError } from "@trpc/server";
import {
  computeCardValue,
  getValuationConfig,
  type CardValuationConfig,
} from "~/lib/cards/valuation";
import { copyRoom } from "~/lib/cards/capacity";
import { CardFinish, CardRarity, CardType, parseCardRarity } from "~/lib/cards/enums";
import { mintCopy } from "~/lib/cards/mint";
import { nsFactsFromApi, nsFactsOf, nsNationKey, withNsFacts } from "~/lib/cards/ns-facts";
import { NS_REALM_ID } from "~/lib/realms/realm-ids";
import { getBonusConfig, grantBonus, nsImportBonus } from "~/lib/vault/vault-bonus";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { generateNSImportDescription } from "~/lib/nationstates/import-service";

type NsDeck = NonNullable<Awaited<ReturnType<typeof nsApiClient.fetchDeck>>>;
type NsCard = NsDeck["cards"][number];
type Tx = Prisma.TransactionClient;
type ImportUser = { id: string; role?: { level?: number | null } | null };

/** One import is one transaction (cards refresh §5.4); a large deck is a few hundred statements. */
const IMPORT_TRANSACTION = { timeout: 60_000, maxWait: 10_000 };
const PLACEHOLDER_ART = "/images/cards/lore-placeholder.svg";

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

const isPricedCard = (card: NsCard) =>
  Boolean(
    card.name && card.market_value && card.market_value !== "0" && card.market_value !== "0.00"
  );

/** The deck's distinct cards (a deck can hold a card twice; an import gives one copy of each). */
function distinctCards(cards: NsCard[]): NsCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.id}-${card.season}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The nation's deck with every card's name and value filled in from NationStates; outside any transaction. */
async function loadDeck(nationName: string): Promise<NsCard[]> {
  const deck = await fetchDeckOrThrow(nationName);
  if (!deck) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Failed to fetch deck from NationStates (Unknown Nation or Empty Deck).",
    });
  }
  if (deck.cards.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This nation has no cards in their deck.",
    });
  }
  const cards = distinctCards(deck.cards);
  for (const card of cards) {
    if (isPricedCard(card)) continue;
    // A card NationStates can't describe is skipped later (no name), never fatal
    const info = await nsApiClient.fetchCardInfo(card.id, card.season).catch(() => null);
    if (info) Object.assign(card, info);
  }
  return cards;
}

/** A new NS card: the nationstates realm, original text (NS text is never copied), and its facts. */
function newNsCardData(
  nsCard: NsCard,
  nationName: string,
  marketValue: number
): Prisma.CardUncheckedCreateInput {
  return {
    id: `card_ns_${nsCard.id}_s${nsCard.season}`,
    title: nsCard.name ?? `Card ${nsCard.id}`,
    description: generateNSImportDescription(nsCard),
    artwork: nsCard.flag || PLACEHOLDER_ART,
    cardType: CardType.NS,
    realmId: NS_REALM_ID,
    rarity: parseCardRarity(nsCard.rarity) ?? CardRarity.COMMON,
    season: parseInt(nsCard.season),
    nsCardId: parseInt(nsCard.id),
    nsSeason: parseInt(nsCard.season),
    wikiArticleTitle: nsCard.name ?? null,
    metadata: {
      nsData: nsFactsFromApi(nsCard),
      importedFrom: nationName,
      importedAt: new Date().toISOString(),
    },
    marketValue,
    totalSupply: 1,
  };
}

/** Finds the card's definition, refreshing its value and bank value, or creates it. */
async function upsertNsDefinition(
  tx: Tx,
  nsCard: NsCard,
  nationName: string,
  valCfg: CardValuationConfig
): Promise<Card> {
  const nsCardId = parseInt(nsCard.id);
  const nsSeason = parseInt(nsCard.season);
  const marketValue = computeCardValue(
    {
      rarity: parseCardRarity(nsCard.rarity) ?? CardRarity.COMMON,
      cardType: CardType.NS,
      nsMarketValue: parseFloat(nsCard.market_value || "0"),
    },
    valCfg
  );
  const existing = await tx.card.findFirst({ where: { nsCardId, nsSeason } });
  if (!existing) return tx.card.create({ data: newNsCardData(nsCard, nationName, marketValue) });
  if (Math.abs(existing.marketValue - marketValue) <= 0.01) return existing;
  return tx.card.update({
    where: { id: existing.id },
    data: {
      marketValue,
      metadata: withNsFacts(existing.metadata, {
        ...nsFactsOf(existing.metadata),
        market_value: nsCard.market_value,
      }),
    },
  });
}

type LedgerKey = { nsCardId: number; nsSeason: number; nation: string };

type ImportedCard = {
  id: string;
  title: string;
  artwork: string;
  rarity: string;
  season: number;
  marketValue: number;
};

interface DeckImport {
  userId: string;
  nationName: string;
  cards: NsCard[];
  room: number;
  valCfg: CardValuationConfig;
}

interface DeckImportOutcome {
  imported: ImportedCard[];
  alreadyImported: number;
  skipped: string[];
}

/**
 * Mints one copy of each claimed card in cardId order, as a pack open does: `mintCopy` holds its per-card serial
 * lock until commit, so two transactions minting the same cards in different orders would deadlock.
 */
async function mintClaimed(
  tx: Tx,
  userId: string,
  claimed: ReadonlyArray<{ card: Card; key: LedgerKey }>
) {
  const mintOrder = [...claimed].sort((a, b) => a.card.id.localeCompare(b.card.id));
  for (const { card, key } of mintOrder) {
    const copy = await mintCopy(tx, {
      cardId: card.id,
      ownerId: userId,
      finish: CardFinish.STANDARD,
      source: "NS_DECK_IMPORT",
    });
    await tx.nSImportLedger.update({
      where: { nsCardId_nsSeason_nation: key },
      data: { ownershipId: copy.id },
    });
  }
}

/**
 * The import itself, inside one transaction: for each card the ledger claims (NS card, season, nation) once ever,
 * across all accounts (cards refresh §2.2), and only a fresh claim mints a copy.
 */
async function importDeckTx(tx: Tx, run: DeckImport): Promise<DeckImportOutcome> {
  const nation = nsNationKey(run.nationName);
  const outcome: DeckImportOutcome = { imported: [], alreadyImported: 0, skipped: [] };
  const claimed: Array<{ card: Card; key: LedgerKey }> = [];
  for (const nsCard of run.cards) {
    if (!nsCard.name) {
      outcome.skipped.push(`Card ${nsCard.id} S${nsCard.season}`);
      continue;
    }
    if (claimed.length >= run.room) {
      outcome.skipped.push(`${nsCard.name} (Inventory Full)`);
      continue;
    }
    const card = await upsertNsDefinition(tx, nsCard, run.nationName, run.valCfg);
    const key = { nsCardId: parseInt(nsCard.id), nsSeason: parseInt(nsCard.season), nation };
    const claim = await tx.nSImportLedger.createMany({
      data: [{ ...key, userId: run.userId }],
      skipDuplicates: true,
    });
    if (claim.count === 0) outcome.alreadyImported += 1;
    else claimed.push({ card, key });
  }
  await mintClaimed(tx, run.userId, claimed);
  outcome.imported = claimed.map(({ card }) => ({
    id: card.id,
    title: card.title,
    artwork: card.artwork ?? "",
    rarity: card.rarity,
    season: card.season,
    marketValue: card.marketValue,
  }));
  return outcome;
}

/**
 * Everything an import does before its bonus: the deck from NationStates (network, outside any transaction), then
 * the import in one transaction. Any failure here leaves nothing behind.
 */
async function importVerifiedDeck(db: PrismaClient, user: ImportUser, nationName: string) {
  const cards = await loadDeck(nationName);
  const run: DeckImport = {
    userId: user.id,
    nationName,
    cards,
    room: await copyRoom(db, { id: user.id, roleLevel: user.role?.level }),
    valCfg: await getValuationConfig(db),
  };
  return db.$transaction((tx) => importDeckTx(tx, run), IMPORT_TRANSACTION);
}

/** The deck-import bonus: per imported card, capped, and paid once per nation whichever account imports it. */
async function payImportBonus(db: PrismaClient, userId: string, nationName: string, count: number) {
  const amount = nsImportBonus(await getBonusConfig(db), count);
  if (amount <= 0) return 0;
  const bonus = await grantBonus(db, userId, "bonus:ns_deck_import", amount, {
    onceKey: `bonus:ns_deck_import:${nsNationKey(nationName)}`,
    metadata: { nationName, cardsImported: count },
  });
  return bonus.granted ? amount : 0;
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
   *
   * The nation is one the caller verified. One transaction, one copy per card, and each nation's card once ever
   * across all accounts (cards refresh §2.2, §5.4).
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

      // Nothing was imported: give the verification back.
      const outcome = await importVerifiedDeck(ctx.db, ctx.user, nationName).catch(
        async (error: Error) => {
          await releaseClaim();
          throw error;
        }
      );

      const bonusCredits = await payImportBonus(
        ctx.db,
        ctx.user.id,
        nationName,
        outcome.imported.length
      );
      if (outcome.imported.length > 0) queueAchievementCheck(ctx.user.id);

      return {
        success: true,
        cardsImported: outcome.imported.length,
        cardsAlreadyImported: outcome.alreadyImported,
        cardsSkipped: outcome.skipped.length,
        bonusCredits,
        nation: nationName,
        cards: outcome.imported,
      };
    }),
});
