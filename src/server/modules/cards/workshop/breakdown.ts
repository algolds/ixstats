/** Breaking copies down for their home realm's dust (cards refresh §2.2). */
import type { PrismaClient } from "@prisma/client";
import { copyBlocker, dustYield } from "~/lib/cards/dust";
import { getEconomyConfig, type CardEconomyConfig } from "~/lib/cards/economy-config";
import {
  burnCopiesTx,
  judgedCopiesTx,
  precondition,
  readOwnCopiesTx,
  type WorkshopRow,
} from "./copies";
import { creditDustTx, type DustEntry } from "./dust-ledger";

/** One ledger entry per copy, grouped by home realm in realm-id order (the order their balances lock in). */
function dustByRealm(rows: WorkshopRow[], cfg: CardEconomyConfig): Array<[string, DustEntry[]]> {
  const byRealm = new Map<string, DustEntry[]>();
  for (const row of rows) {
    const entries = byRealm.get(row.cards.realmId) ?? [];
    entries.push({
      amount: dustYield(
        { rarity: row.cards.rarity, finish: row.finish, importDiscounted: row.importDiscounted },
        cfg
      ),
      cardId: row.cardId,
      ownershipId: row.id,
    });
    byRealm.set(row.cards.realmId, entries);
  }
  return [...byRealm].sort(([a], [b]) => (a < b ? -1 : 1));
}

/**
 * Burns the player's copies for dust, all or none: refused when any copy can't be broken down (bound, Serialised,
 * signed, listed, auctioned or in a trade offer). Each realm's dust is credited before the burn, so its balance row
 * locks before the serial locks, as a craft spends dust before it mints; a burn that loses a race rolls the credit
 * back.
 */
export async function breakDownCopies(
  db: PrismaClient,
  input: { userId: string; ownershipIds: string[] }
): Promise<{ broken: number; dust: Array<{ realmId: string; amount: number }> }> {
  const ids = [...new Set(input.ownershipIds)];
  const cfg = await getEconomyConfig(db);
  return db.$transaction(async (tx) => {
    const rows = await readOwnCopiesTx(tx, input.userId, ids);
    for (const copy of await judgedCopiesTx(tx, rows)) {
      const blocked = copyBlocker(copy, "break down");
      if (blocked) throw precondition(blocked);
    }
    const dust: Array<{ realmId: string; amount: number }> = [];
    for (const [realmId, entries] of dustByRealm(rows, cfg)) {
      await creditDustTx(tx, { userId: input.userId, realmId, source: "BREAKDOWN", entries });
      dust.push({ realmId, amount: entries.reduce((sum, e) => sum + e.amount, 0) });
    }
    await burnCopiesTx(tx, input.userId, rows, "BREAKDOWN");
    return { broken: rows.length, dust };
  });
}
