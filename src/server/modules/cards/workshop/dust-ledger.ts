/**
 * Dust balances (per player and realm, account-bound) and their ledger. Every write runs in the caller's transaction.
 * A balance row is written before any capacity (7334) or serial (7331) lock: a break-down credits before it burns, and
 * a craft spends before it mints.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { DustError } from "./errors";

export { DustError };
export type DustSource = "BREAKDOWN" | "CRAFT";

export interface DustEntry {
  amount: number;
  cardId?: string;
  ownershipId?: string;
}

/** The most dust one balance holds: `CardDustBalance.balance` is an Int. */
export const MAX_DUST_BALANCE = 2_147_483_647;

const AT_LIMIT = `Your dust in this realm can't go past ${MAX_DUST_BALANCE.toLocaleString("en")}.`;

/**
 * Adds the entries' dust to one realm balance and logs one event per entry, with the balance after it. Returns the new
 * balance. One statement creates the balance or adds to it, and the add holds only while the sum stays inside the
 * column (its WHERE leaves the row as it was and returns nothing), so a credit past the limit is refused, never an
 * overflow. Entries that yield nothing get no event.
 */
export async function creditDustTx(
  tx: Pick<Prisma.TransactionClient, "$queryRaw" | "cardDustEvent">,
  args: { userId: string; realmId: string; source: DustSource; entries: DustEntry[] }
): Promise<number> {
  const entries = args.entries.filter((e) => e.amount > 0);
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  if (total > MAX_DUST_BALANCE) throw new DustError(AT_LIMIT);
  const [row] = await tx.$queryRaw<Array<{ balance: number }>>`
    INSERT INTO card_dust_balances ("userId", "realmId", balance, "updatedAt")
    VALUES (${args.userId}, ${args.realmId}, ${total}::int, now())
    ON CONFLICT ("userId", "realmId") DO UPDATE
      SET balance = card_dust_balances.balance + EXCLUDED.balance, "updatedAt" = now()
      WHERE card_dust_balances.balance <= ${MAX_DUST_BALANCE - total}::int
    RETURNING balance`;
  if (!row) throw new DustError(AT_LIMIT);
  let running = row.balance - total;
  await tx.cardDustEvent.createMany({
    data: entries.map((e) => {
      running += e.amount;
      return {
        userId: args.userId,
        realmId: args.realmId,
        delta: e.amount,
        balanceAfter: running,
        source: args.source,
        cardId: e.cardId ?? null,
        ownershipId: e.ownershipId ?? null,
      };
    }),
  });
  return row.balance;
}

/**
 * Takes dust from one realm balance only if it covers the amount (a conditional decrement), and logs the spend.
 * Returns the new balance. A free spend (0) writes nothing.
 */
export async function spendDustTx(
  tx: Pick<Prisma.TransactionClient, "cardDustBalance" | "cardDustEvent">,
  args: { userId: string; realmId: string; amount: number; source: DustSource; cardId?: string }
): Promise<number> {
  const key = { userId_realmId: { userId: args.userId, realmId: args.realmId } };
  if (args.amount === 0) {
    const held = await tx.cardDustBalance.findUnique({ where: key, select: { balance: true } });
    return held?.balance ?? 0;
  }
  const spent = await tx.cardDustBalance.updateMany({
    where: { userId: args.userId, realmId: args.realmId, balance: { gte: args.amount } },
    data: { balance: { decrement: args.amount } },
  });
  if (spent.count !== 1)
    throw new DustError(`You need ${args.amount} dust from this card's realm.`);
  const row = await tx.cardDustBalance.findUniqueOrThrow({
    where: key,
    select: { balance: true },
  });
  await tx.cardDustEvent.create({
    data: {
      userId: args.userId,
      realmId: args.realmId,
      delta: -args.amount,
      balanceAfter: row.balance,
      source: args.source,
      cardId: args.cardId ?? null,
    },
  });
  return row.balance;
}

/** The player's dust per realm, most first. */
export async function getDustBalances(
  db: Pick<PrismaClient, "cardDustBalance">,
  userId: string
): Promise<Array<{ realmId: string; realmName: string; realmSlug: string; balance: number }>> {
  const rows = await db.cardDustBalance.findMany({
    where: { userId, balance: { gt: 0 } },
    select: { realmId: true, balance: true, realm: { select: { name: true, slug: true } } },
    orderBy: [{ balance: "desc" }, { realmId: "asc" }],
  });
  return rows.map((r) => ({
    realmId: r.realmId,
    realmName: r.realm.name,
    realmSlug: r.realm.slug,
    balance: r.balance,
  }));
}
