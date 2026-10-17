import { z } from "zod";
import type { Card, Prisma, PrismaClient } from "@prisma/client";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { nsApiClient } from "~/lib/nationstates/api-client";
import { TRPCError } from "@trpc/server";
import { getValuationConfig, type CardValuationConfig } from "~/lib/cards/valuation";
import { copyRoom } from "~/lib/cards/capacity";
import { CardFinish } from "~/lib/cards/enums";
import { mintCopy } from "~/lib/cards/mint";
import { nsNationKey } from "~/lib/cards/ns-facts";
import { getBonusConfig, grantBonus, nsImportBonus } from "~/lib/vault/vault-bonus";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { upsertNSCardDefinition } from "~/lib/nationstates/sync-processor";

type NsDeck = NonNullable<Awaited<ReturnType<typeof nsApiClient.fetchDeck>>>;
type NsCard = NsDeck["cards"][number];
type Tx = Prisma.TransactionClient;
type ImportUser = { id: string; role?: { level?: number | null } | null };

/** One import is one transaction (cards refresh §5.4); a large deck is a few hundred statements. */
const IMPORT_TRANSACTION = { timeout: 60_000, maxWait: 10_000 };

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

/** A card as the ledger and the library key it: NS card id and season. */
const nsKey = (nsCardId: number | null, nsSeason: number | null) => `${nsCardId}-${nsSeason}`;
const deckKey = (card: NsCard) => nsKey(parseInt(card.id), parseInt(card.season));
const cardLabel = (card: NsCard) => card.name ?? `Card ${card.id} S${card.season}`;

/** The deck's distinct cards (a deck can hold a card twice; an import gives one copy of each). */
function distinctCards(cards: NsCard[]): NsCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = deckKey(card);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The nation's distinct deck cards, as NationStates lists them (no names); outside any transaction. */
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
  return distinctCards(deck.cards);
}

type PlanDb = Pick<PrismaClient, "nSImportLedger" | "card">;

/** The deck's cards this nation has not imported yet. Read-only: the transaction's ledger claim stays the authority. */
async function notYetImported(db: PlanDb, nationName: string, cards: NsCard[]): Promise<NsCard[]> {
  const rows = await db.nSImportLedger.findMany({
    where: { nation: nsNationKey(nationName) },
    select: { nsCardId: true, nsSeason: true },
  });
  const imported = new Set(rows.map((row) => nsKey(row.nsCardId, row.nsSeason)));
  return cards.filter((card) => !imported.has(deckKey(card)));
}

/** The library's NS card definitions for these cards, by key: a known card needs no card info call. */
async function knownCards(db: PlanDb, cards: NsCard[]) {
  const ids = [...new Set(cards.map((card) => parseInt(card.id)).filter(Number.isInteger))];
  const rows = await db.card.findMany({
    where: { nsCardId: { in: ids } },
    select: { nsCardId: true, nsSeason: true, title: true, isRetired: true },
  });
  return new Map(rows.map((row) => [nsKey(row.nsCardId, row.nsSeason), row]));
}

/** Names each card the library does not know from NationStates, one card info call each. */
async function fetchUnknownCards(cards: NsCard[]) {
  for (const card of cards) {
    if (isPricedCard(card)) continue;
    // Null is a failed request (429, 5xx, network): import all of the deck or none of it. A card NationStates
    // answers for without a name is skipped later.
    const info = await nsApiClient.fetchCardInfo(card.id, card.season);
    if (!info) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "NationStates didn't answer for every card in the deck. Please try again.",
      });
    }
    Object.assign(card, info);
  }
}

interface DeckPlan {
  /** What the transaction imports: at most the player's room. */
  cards: NsCard[];
  alreadyImported: number;
  skipped: string[];
}

/**
 * What an import takes from the deck, before its transaction: the cards this nation has not imported, cut to the
 * player's room. A known card takes its name from its Card row (a taken-down one takes no room), so NationStates is
 * asked only for the unknown cards that fit: at most `room` calls, at the client's rate limit, whatever the deck's size.
 */
async function planDeckImport(
  db: PlanDb,
  nationName: string,
  deck: NsCard[],
  room: number
): Promise<DeckPlan> {
  const fresh = await notYetImported(db, nationName, deck);
  const known = await knownCards(db, fresh);
  const skipped: string[] = [];
  const open: NsCard[] = [];
  for (const card of fresh) {
    const row = known.get(deckKey(card));
    const named = row ? { ...card, name: card.name ?? row.title } : card;
    if (row?.isRetired) skipped.push(`${cardLabel(named)} (Taken down)`);
    else open.push(named);
  }
  const cards = open.slice(0, room);
  skipped.push(...open.slice(cards.length).map((card) => `${cardLabel(card)} (Inventory Full)`));
  await fetchUnknownCards(cards);
  return { cards, alreadyImported: deck.length - fresh.length, skipped };
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
    const label = cardLabel(nsCard);
    // A card the library lacks is created waiting for review; the player's copy is minted all the same
    const definition = await upsertNSCardDefinition(tx, nsCard, run.nationName, run.valCfg, null);
    if (!definition) {
      outcome.skipped.push(label);
      continue;
    }
    // A taken-down card mints no new copies; unclaimed, it can import again if it is restored
    if (definition.card.isRetired) {
      outcome.skipped.push(`${label} (Taken down)`);
      continue;
    }
    const { card } = definition;
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
 * Everything an import does before its bonus: the deck and the unknown cards' info from NationStates (network,
 * outside any transaction), then the import in one transaction. Any failure here leaves nothing behind.
 */
async function importVerifiedDeck(
  db: PrismaClient,
  user: ImportUser,
  nationName: string
): Promise<DeckImportOutcome> {
  const deck = await loadDeck(nationName);
  const room = await copyRoom(db, { id: user.id, roleLevel: user.role?.level });
  const plan = await planDeckImport(db, nationName, deck, room);
  const run: DeckImport = {
    userId: user.id,
    nationName,
    cards: plan.cards,
    valCfg: await getValuationConfig(db),
  };
  const outcome = await db.$transaction((tx) => importDeckTx(tx, run), IMPORT_TRANSACTION);
  return {
    imported: outcome.imported,
    alreadyImported: plan.alreadyImported + outcome.alreadyImported,
    skipped: [...plan.skipped, ...outcome.skipped],
  };
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
