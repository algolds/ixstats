/**
 * Card trades (spec §2.2, §2.3): a two-column table of cards and credits between two players. Whoever wrote the current
 * table is the proposer, and their give-side copies are locked; the other party accepts, rejects, or counters by
 * editing the same row (the revision goes up and the roles swap). Accepting moves every copy and credit in one
 * transaction, the claim first and then every vault it writes (M2). Notices are sent after the commit, naming the
 * sender through `nameOf`, which the router injects (card modules do not read identity).
 */
import type { Prisma, PrismaClient, TradeOffer } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { boundCopyError } from "~/lib/cards/bound";
import { notifyCard, notifyCards, type CardNotice } from "~/lib/cards/card-notify";
import { copyIdsOf } from "~/lib/cards/hub/art-visibility";
import { tradeBuilderHref } from "~/lib/cards/hub-routes";
import {
  lockCreditLegVaultsTx,
  settleCreditLegTx,
  type CreditLeg,
  type CreditLegResult,
} from "~/lib/cards/market/credit-leg";
import { royaltyNotices } from "~/lib/cards/market/royalty";
import {
  describeOffer,
  isCrossRealmTrade,
  isGift,
  sidesFor,
  validateTradeTable,
  type TradeRole,
  type TradeSide,
  type TradeTable,
} from "~/lib/cards/trade/trade-table";
import { grantCardXp, type CardXpSource } from "~/lib/cards/xp-utils";
import {
  claimPendingTradeTx,
  lockCardsTx,
  recordTradeTransfersTx,
  transferCardsTx,
  unlockCardsTx,
} from "~/lib/vault/trade-settlement";
import { utcDay } from "~/lib/vault/vault-dividend";
import { vaultsBusyError } from "~/lib/vault/vault-locks";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { refusesTradeOffer } from "~/server/shared/privacy-permissions";

export const TRADE_TTL_MS = 24 * 60 * 60 * 1000;

export interface Party {
  id: string;
  clerkUserId: string;
}

/** The name other players read for a user (`PlayerName.displayName`); null reads "A player". */
export type NameOf = (userId: string) => Promise<string | null>;

type Tx = Prisma.TransactionClient;
type Code = "BAD_REQUEST" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT";
const fail = (code: Code, message: string) => new TRPCError({ code, message });
const NONE: ReadonlySet<string> = new Set();
const STALE = "This trade changed. Review the latest table.";

/** Trading is closed during maintenance or when P2P trading is switched off. */
export function assertTradingOpen(config: Awaited<ReturnType<typeof getVaultConfig>>): void {
  if (config.isMaintenanceMode) {
    throw fail("BAD_REQUEST", "Vault economy is currently in maintenance mode.");
  }
  if (!config.isTradingEnabled)
    throw fail("BAD_REQUEST", "Card trading is switched off right now.");
}

/**
 * One transaction. A lost deadlock or write conflict (two trades or sales over the same players at once) rolled
 * everything back, so it is a CONFLICT the player can retry.
 */
async function inTransaction<T>(db: PrismaClient, work: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.$transaction(work);
  } catch (error) {
    if (error instanceof Error && vaultsBusyError(error)) {
      throw fail("CONFLICT", "Someone else was trading at the same moment. Try again.");
    }
    throw error;
  }
}

/** What a trade reads of each copy; never who signed it (only the card sheet names a signer). */
const COPY_SELECT = {
  id: true,
  isLocked: true,
  cardId: true,
  inscribedAt: true,
  cards: { select: { title: true, isBound: true, cardType: true, countryId: true, realmId: true } },
} satisfies Prisma.CardOwnershipSelect;

type TradeCopy = Prisma.CardOwnershipGetPayload<{ select: typeof COPY_SELECT }>;

/**
 * The owner's copies by id: each must be theirs and unbound, and unlocked unless this trade holds it. A copy that moved
 * or was burned (broken down, fused) since the table was written is a CONFLICT: the table changed under the player.
 */
async function loadSide(
  db: Pick<Tx, "cardOwnership">,
  ids: readonly string[],
  ownerId: string,
  heldByThisTrade: ReadonlySet<string>
): Promise<TradeCopy[]> {
  if (ids.length === 0) return [];
  const rows = await db.cardOwnership.findMany({
    where: { id: { in: [...ids] }, ownerId },
    select: COPY_SELECT,
  });
  if (rows.length !== ids.length) {
    throw fail("CONFLICT", "Some cards in this trade are no longer that player's.");
  }
  if (rows.some((r) => r.cards.isBound)) throw boundCopyError();
  if (rows.some((r) => r.isLocked && !heldByThisTrade.has(r.id))) {
    throw fail("CONFLICT", "Some cards in this trade are listed, at auction or in another trade.");
  }
  return rows;
}

async function assertCanPay(db: PrismaClient, userId: string, credits: number): Promise<void> {
  if (credits <= 0) return;
  const vault = await db.myVault.findUnique({ where: { userId }, select: { credits: true } });
  if (!vault || vault.credits < credits) {
    throw fail("BAD_REQUEST", "You don't have enough IxCredits for this trade.");
  }
}

const roleOf = (trade: TradeOffer, userId: string): TradeRole =>
  userId === trade.initiatorId ? "initiator" : "recipient";
const otherParty = (trade: TradeOffer, userId: string) =>
  userId === trade.initiatorId ? trade.recipientId : trade.initiatorId;
const tableOf = (trade: TradeOffer): TradeTable => ({
  initiatorCardIds: copyIdsOf(trade.initiatorCardIds),
  recipientCardIds: copyIdsOf(trade.recipientCardIds),
  initiatorCredits: trade.initiatorCredits,
  recipientCredits: trade.recipientCredits,
});
/** What a party gives in the stored table; the proposer's cards are the locked ones. */
const givenBy = (trade: TradeOffer, userId: string): TradeSide =>
  sidesFor(tableOf(trade), roleOf(trade, userId)).give;

async function loadOpenTrade(
  db: PrismaClient,
  tradeId: string,
  userId: string,
  now: Date
): Promise<TradeOffer> {
  const trade = await db.tradeOffer.findUnique({ where: { id: tradeId } });
  if (!trade || (trade.initiatorId !== userId && trade.recipientId !== userId)) {
    throw fail("NOT_FOUND", "Trade not found.");
  }
  if (trade.status !== "PENDING" || trade.expiresAt <= now) {
    throw fail("BAD_REQUEST", "This trade is no longer open.");
  }
  return trade;
}

/** Only the party the table waits on answers it, and only the revision they saw. */
function assertResponder(trade: TradeOffer, userId: string, revision: number): void {
  if (trade.proposerId === userId) throw fail("FORBIDDEN", "Wait for the other player to respond.");
  if (trade.revision !== revision) throw fail("CONFLICT", STALE);
}

/** The sender's name for a notice; a failed lookup reads "A player", as a notice never fails the trade. */
async function senderName(nameOf: NameOf, userId: string): Promise<string> {
  try {
    return (await nameOf(userId)) ?? "A player";
  } catch (error) {
    console.warn(`[Trades] could not name ${userId}:`, error);
    return "A player";
  }
}

const offerNotice = (to: string, tradeId: string, title: string, message: string): CardNotice => ({
  userId: to,
  title,
  message,
  href: tradeBuilderHref({ tradeId }),
  priority: "high",
  metadata: { tradeId },
});

export interface CreateTradeInput {
  initiator: Party;
  partnerId: string;
  table: TradeTable;
  message?: string;
  now: Date;
  nameOf: NameOf;
}

export async function createTradeOffer(
  db: PrismaClient,
  input: CreateTradeInput
): Promise<TradeOffer> {
  assertTradingOpen(await getVaultConfig(db));
  const { initiator, table } = input;
  const problem = validateTradeTable(table);
  if (problem) throw fail("BAD_REQUEST", problem);
  if (input.partnerId === initiator.id)
    throw fail("BAD_REQUEST", "Choose another player to trade with.");
  const partner = await db.user.findUnique({
    where: { id: input.partnerId },
    select: { id: true, clerkUserId: true },
  });
  if (!partner) throw fail("NOT_FOUND", "Player not found.");
  if (await refusesTradeOffer(db, initiator.clerkUserId, partner.clerkUserId)) {
    throw fail("FORBIDDEN", "This player isn't taking trade offers from you.");
  }
  await loadSide(db, table.initiatorCardIds, initiator.id, NONE);
  await loadSide(db, table.recipientCardIds, partner.id, NONE);
  await assertCanPay(db, initiator.id, table.initiatorCredits);

  const trade = await inTransaction(db, async (tx) => {
    await lockCardsTx(tx, table.initiatorCardIds, initiator.id);
    return tx.tradeOffer.create({
      data: {
        initiatorId: initiator.id,
        recipientId: partner.id,
        proposerId: initiator.id,
        ...table,
        message: input.message ?? null,
        status: "PENDING",
        expiresAt: new Date(input.now.getTime() + TRADE_TTL_MS),
      },
    });
  });
  const name = await senderName(input.nameOf, initiator.id);
  await notifyCard(
    db,
    offerNotice(
      partner.id,
      trade.id,
      "New trade offer",
      `${name} sent you a trade offer: ${describeOffer(table, "initiator")}.`
    )
  );
  return trade;
}

export interface CounterTradeInput {
  user: Party;
  tradeId: string;
  revision: number;
  table: TradeTable;
  message?: string;
  now: Date;
  nameOf: NameOf;
}

/**
 * The responder writes a new table on the same row and becomes the proposer: the revision goes up, the 24-hour clock
 * restarts, the old proposer's cards unlock and the counterer's lock. The write is a compare-and-swap on the revision
 * and proposer it read, so of two answers to one table only the first lands.
 */
export async function counterTradeOffer(
  db: PrismaClient,
  input: CounterTradeInput
): Promise<TradeOffer> {
  assertTradingOpen(await getVaultConfig(db));
  const trade = await loadOpenTrade(db, input.tradeId, input.user.id, input.now);
  assertResponder(trade, input.user.id, input.revision);
  const problem = validateTradeTable(input.table);
  if (problem) throw fail("BAD_REQUEST", problem);

  const role = roleOf(trade, input.user.id);
  const otherId = otherParty(trade, input.user.id);
  const { give: mine, get: theirs } = sidesFor(input.table, role);
  // The old proposer's cards this trade holds locked; the new table may ask for them
  const theirLocked = givenBy(trade, otherId).cardIds;
  await loadSide(db, mine.cardIds, input.user.id, NONE);
  await loadSide(db, theirs.cardIds, otherId, new Set(theirLocked));
  await assertCanPay(db, input.user.id, mine.credits);

  const updated = await inTransaction(db, async (tx) => {
    const claimed = await tx.tradeOffer.updateMany({
      where: {
        id: trade.id,
        status: "PENDING",
        revision: trade.revision,
        proposerId: otherId,
        expiresAt: { gt: input.now },
      },
      data: {
        ...input.table,
        message: input.message ?? null,
        proposerId: input.user.id,
        revision: { increment: 1 },
        expiresAt: new Date(input.now.getTime() + TRADE_TTL_MS),
        // When this table was written: accepting compares signatures against it
        updatedAt: input.now,
      },
    });
    if (claimed.count !== 1) throw fail("CONFLICT", STALE);
    await unlockCardsTx(tx, theirLocked, otherId);
    await lockCardsTx(tx, mine.cardIds, input.user.id);
    return tx.tradeOffer.findUniqueOrThrow({ where: { id: trade.id } });
  });
  const name = await senderName(input.nameOf, input.user.id);
  await notifyCard(
    db,
    offerNotice(
      otherId,
      trade.id,
      "Counter-offer",
      `${name} countered: ${describeOffer(input.table, role)}.`
    )
  );
  return updated;
}

const royaltyCard = (c: TradeCopy) => ({
  cardId: c.cardId,
  cardType: c.cards.cardType,
  countryId: c.cards.countryId,
});
const realmsOf = (copies: TradeCopy[]) => copies.map((c) => c.cards.realmId);

/**
 * The responder's copies were not locked by the offer, so one can be signed while the trade waits. Accepting refuses a
 * copy signed after the current table was written (`updatedAt`, which the offer and each counter stamp), so
 * a trade never settles an inscription the proposer has not seen. Signing itself is never blocked; a counter-offer
 * with the same cards shows the signature. The proposer's copies are locked from the table on, and a locked copy
 * cannot be signed.
 */
function assertUnsignedSince(copies: TradeCopy[], tableWrittenAt: Date): void {
  if (copies.some((c) => (c.inscribedAt?.getTime() ?? 0) > tableWrittenAt.getTime())) {
    throw fail(
      "CONFLICT",
      "A card you would give was signed after this offer was made. Send a counter-offer so the other player sees it."
    );
  }
}

/** The cross-realm XP bonus applies once per trading partner per UTC day (spec §2.2). */
async function crossRealmBonusUsedTx(tx: Tx, trade: TradeOffer, now: Date): Promise<boolean> {
  const pair = [trade.initiatorId, trade.recipientId];
  const earlier = await tx.tradeOffer.count({
    where: {
      id: { not: trade.id },
      status: "ACCEPTED",
      isCrossRealm: true,
      respondedAt: { gte: new Date(`${utcDay(now)}T00:00:00.000Z`) },
      initiatorId: { in: pair },
      recipientId: { in: pair },
    },
  });
  return earlier > 0;
}

interface Move {
  fromId: string;
  toId: string;
  action: "TRADE" | "GIFT";
  xp: CardXpSource;
  tradeId: string;
  now: Date;
}

/** Card XP for each moved copy (inside its daily cap), and the moves in the copies' trails. */
async function logMovesTx(tx: Tx, copies: TradeCopy[], move: Move): Promise<void> {
  for (const copy of copies) {
    await grantCardXp(tx, copy.id, move.xp, JSON.stringify({ tradeId: move.tradeId }), move.now);
  }
  await recordTradeTransfersTx(tx, {
    ids: copies.map((c) => c.id),
    fromId: move.fromId,
    toId: move.toId,
    action: move.action,
  });
}

interface Settled {
  accepted: TradeOffer;
  legs: CreditLegResult[];
  titles: ReadonlyMap<string, string>;
}

/**
 * Settles an accepted table inside its transaction: the claim (the revision the responder saw), every vault the credit
 * legs write in user-id order, then both sides' copies, their XP and trail rows, the credits, and the cross-realm flag.
 * Any failure rolls all of it back.
 */
async function settleTradeTx(
  tx: Tx,
  trade: TradeOffer,
  responderId: string,
  now: Date
): Promise<Settled> {
  const proposerId = trade.proposerId;
  const proposerGives = givenBy(trade, proposerId);
  const responderGives = givenBy(trade, responderId);
  await claimPendingTradeTx(tx, {
    tradeId: trade.id,
    next: "ACCEPTED",
    now,
    revision: trade.revision,
  });
  const proposerCopies = await loadSide(
    tx,
    proposerGives.cardIds,
    proposerId,
    new Set(proposerGives.cardIds)
  );
  const responderCopies = await loadSide(tx, responderGives.cardIds, responderId, NONE);
  assertUnsignedSince(responderCopies, trade.updatedAt);
  // Each leg pays for the cards its payer receives (the royalty follows them)
  const legs: CreditLeg[] = [
    {
      fromUserId: proposerId,
      toUserId: responderId,
      amount: proposerGives.credits,
      tradeId: trade.id,
      paidFor: responderCopies.map(royaltyCard),
    },
    {
      fromUserId: responderId,
      toUserId: proposerId,
      amount: responderGives.credits,
      tradeId: trade.id,
      paidFor: proposerCopies.map(royaltyCard),
    },
  ];
  await lockCreditLegVaultsTx(tx, legs);
  await transferCardsTx(tx, {
    ids: proposerGives.cardIds,
    fromId: proposerId,
    toId: responderId,
    expectLocked: true,
    now,
  });
  await transferCardsTx(tx, {
    ids: responderGives.cardIds,
    fromId: responderId,
    toId: proposerId,
    expectLocked: false,
    now,
  });

  const isCrossRealm = isCrossRealmTrade(realmsOf(proposerCopies), realmsOf(responderCopies));
  const doubled = isCrossRealm && !(await crossRealmBonusUsedTx(tx, trade, now));
  const move = {
    action: isGift(tableOf(trade)) ? "GIFT" : "TRADE",
    xp: doubled ? "CROSS_REALM_TRADE" : "TRADE",
    tradeId: trade.id,
    now,
  } as const;
  await logMovesTx(tx, proposerCopies, { ...move, fromId: proposerId, toId: responderId });
  await logMovesTx(tx, responderCopies, { ...move, fromId: responderId, toId: proposerId });

  const settled: CreditLegResult[] = [];
  for (const leg of legs) settled.push(await settleCreditLegTx(tx, leg));
  const accepted = await tx.tradeOffer.update({ where: { id: trade.id }, data: { isCrossRealm } });
  const titles = new Map(
    [...proposerCopies, ...responderCopies].map((c) => [c.cardId, c.cards.title])
  );
  return { accepted, legs: settled, titles };
}

export interface AcceptedTrade {
  trade: TradeOffer;
  /** Nation owners the credit legs paid a royalty to (their cached balances are stale). */
  royaltyRecipientIds: string[];
}

export async function acceptTradeOffer(
  db: PrismaClient,
  input: { user: Party; tradeId: string; revision: number; now: Date; nameOf: NameOf }
): Promise<AcceptedTrade> {
  assertTradingOpen(await getVaultConfig(db));
  const trade = await loadOpenTrade(db, input.tradeId, input.user.id, input.now);
  assertResponder(trade, input.user.id, input.revision);
  const result = await inTransaction(db, (tx) =>
    settleTradeTx(tx, trade, input.user.id, input.now)
  );

  const royalties = result.legs.flatMap((leg) => leg.royalties);
  const name = await senderName(input.nameOf, input.user.id);
  await notifyCards(db, [
    {
      userId: trade.proposerId,
      title: "Trade accepted",
      message: `${name} accepted your trade.`,
      type: "success",
      href: tradeBuilderHref({ tradeId: trade.id }),
      metadata: { tradeId: trade.id },
    },
    ...royaltyNotices(royalties, result.titles),
  ]);
  return { trade: result.accepted, royaltyRecipientIds: royalties.map((r) => r.recipientId) };
}

/** Ends the table at the revision read (a counter meanwhile changes whose cards are locked) and frees the proposer's. */
async function endTrade(
  db: PrismaClient,
  trade: TradeOffer,
  next: "REJECTED" | "CANCELLED",
  now: Date
): Promise<TradeOffer> {
  return inTransaction(db, async (tx) => {
    await claimPendingTradeTx(tx, { tradeId: trade.id, next, now, revision: trade.revision });
    await unlockCardsTx(tx, givenBy(trade, trade.proposerId).cardIds, trade.proposerId);
    return tx.tradeOffer.findUniqueOrThrow({ where: { id: trade.id } });
  });
}

/** The responder turns the current table down. Open while trading is closed, so cards can always be freed. */
export async function rejectTradeOffer(
  db: PrismaClient,
  input: { user: Party; tradeId: string; now: Date }
): Promise<TradeOffer> {
  const trade = await loadOpenTrade(db, input.tradeId, input.user.id, input.now);
  if (trade.proposerId === input.user.id)
    throw fail("FORBIDDEN", "Withdraw your own offer instead.");
  return endTrade(db, trade, "REJECTED", input.now);
}

/** The proposer withdraws their table. Open while trading is closed. */
export async function cancelTradeOffer(
  db: PrismaClient,
  input: { user: Party; tradeId: string; now: Date }
): Promise<TradeOffer> {
  const trade = await loadOpenTrade(db, input.tradeId, input.user.id, input.now);
  if (trade.proposerId !== input.user.id) {
    throw fail("FORBIDDEN", "Only the player whose offer it is can withdraw it.");
  }
  return endTrade(db, trade, "CANCELLED", input.now);
}
