// scripts/cards/retire-seed-cards.ts
/**
 * One-off (card categories phase): retire the six Lore cards seeded by hand into Ixnay on 2026-02-16. They have no
 * wiki article behind them, so no category can be found for them. Each retired card gets a CARD_HIDE audit row.
 *
 *   bun scripts/cards/retire-seed-cards.ts            # dry run: lists the cards, writes nothing
 *   bun scripts/cards/retire-seed-cards.ts --apply    # retire them
 *
 * Idempotent: a card already retired is left as it is and gets no second audit row. Copies are kept; a retired
 * card's copies are worth 0 by the existing rule.
 */
import { PrismaClient } from "@prisma/client";
import { isSeedCard, SEED_CARD_DAY } from "~/lib/cards/seed-cards";
import { recordCardAudit } from "~/server/modules/cards/cards.audit";

type SeedCardDb = Pick<PrismaClient, "card" | "auditLog" | "$transaction">;

export interface SeedCardRow {
  id: string;
  title: string;
  isRetired: boolean;
}

export interface SeedCardRetirement {
  found: Array<{ id: string; title: string }>;
  retired: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Lore cards with no article created on the seed day (UTC) that `isSeedCard` accepts. */
export async function findSeedCards(db: Pick<PrismaClient, "card">): Promise<SeedCardRow[]> {
  const start = new Date(`${SEED_CARD_DAY}T00:00:00Z`);
  const rows = await db.card.findMany({
    where: {
      cardType: "LORE",
      wikiArticleTitle: null,
      createdAt: { gte: start, lt: new Date(start.getTime() + DAY_MS) },
    },
    select: {
      id: true,
      title: true,
      cardType: true,
      wikiArticleTitle: true,
      createdAt: true,
      isRetired: true,
    },
    orderBy: { title: "asc" },
  });
  return rows.filter(isSeedCard).map(({ id, title, isRetired }) => ({ id, title, isRetired }));
}

/** Lists the seed cards; with `apply`, retires those not yet retired and audits each one. */
export async function retireSeedCards(db: SeedCardDb, apply: boolean): Promise<SeedCardRetirement> {
  const cards = await findSeedCards(db);
  const found = cards.map(({ id, title }) => ({ id, title }));
  const pending = cards.filter((card) => !card.isRetired);
  if (!apply || pending.length === 0) return { found, retired: 0 };
  const retired = await db.$transaction(async (tx) => {
    const { count } = await tx.card.updateMany({
      where: { id: { in: pending.map((card) => card.id) }, isRetired: false },
      data: { isRetired: true, retiredAt: new Date() },
    });
    for (const card of pending) {
      await recordCardAudit(tx, {
        action: "CARD_HIDE",
        actor: null,
        target: card.id,
        details: `Retired the February seed card ${card.title}`,
      });
    }
    return count;
  });
  return { found, retired };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient();
  try {
    const { found, retired } = await retireSeedCards(db, apply);
    console.log(`${found.length} February seed cards:`);
    for (const card of found) console.log(`  ${card.id}  ${card.title}`);
    console.log(apply ? `${retired} retired.` : "Dry run: nothing written. Re-run with --apply.");
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
