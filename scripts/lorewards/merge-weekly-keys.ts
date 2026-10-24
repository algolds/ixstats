/**
 * The weekly merge (design decision 18): every weekly Loreward row moves to its ISO week key, and the date-keyed
 * duplicates fold into one row per contest (`planWeeklyMerge`). The paid row survives, the losers' trophy cards move to
 * it, and a week whose rows disagree, that was paid or carded under two rows, or that holds an admin override or a row
 * not approved, is reported and left alone.
 * Dry run by default; idempotent. Run it before the new code goes live (the owner runbook in
 * docs/systems/ixnayid-passport.md), then settle each skipped week with an admin override.
 *   bun scripts/lorewards/merge-weekly-keys.ts           # dry run: prints the plan, writes nothing
 *   bun scripts/lorewards/merge-weekly-keys.ts --apply   # applies each merge in its own transaction
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { contestPlaceKey } from "~/lib/lorewards/contest-identity";
import { lockContestPlace } from "~/lib/lorewards/contest-store";
import { metaOf } from "~/lib/lorewards/trophy-cards";
import {
  planWeeklyMerge,
  type WeeklyMerge,
  type WeeklyPlan,
  type WeeklyRow,
  type WeeklySkipReason,
} from "~/lib/lorewards/week-merge";
import { isUniqueViolation } from "~/lib/prisma-error";
import { lorewardBonusKey, type LorewardPlace } from "~/lib/vault/vault-bonus";

/** Rows per page: an explicit `take` with keyset paging by id, so none is dropped. */
const PAGE = 500;
const TX_OPTIONS = { timeout: 60_000 } as const;
const PLACES: readonly LorewardPlace[] = ["winner", "runner-up"];

const WEEKLY_ROW_SELECT = {
  id: true,
  date: true,
  dateStart: true,
  dateEnd: true,
  winnerUser: true,
  winnerPage: true,
  winnerScore: true,
  winnerBytes: true,
  runnerUpUser: true,
  runnerUpPage: true,
  runnerUpScore: true,
  runnerUpBytes: true,
  editCount: true,
  metadata: true,
  status: true,
  overriddenAt: true,
} as const satisfies Record<keyof WeeklyRow, true>;

export function parseMergeArgs(argv: string[]): { apply: boolean } {
  return { apply: argv.includes("--apply") && !argv.includes("--dry-run") };
}

/** Either place's bonus key of each entry, mapped back to its entry id. */
const bonusKeysOf = (ids: readonly string[]) =>
  new Map(ids.flatMap((id) => PLACES.map((place) => [lorewardBonusKey(id, place), id] as const)));

/** One page of rows, with the entries paid under them and the editions of the cards on them. */
async function readPage(db: PrismaClient, after: string | undefined) {
  const rows = await db.lorewardEntry.findMany({
    where: { type: "weekly", ...(after ? { id: { gt: after } } : {}) },
    select: WEEKLY_ROW_SELECT,
    orderBy: { id: "asc" },
    take: PAGE,
  });
  const ids = rows.map((r) => r.id);
  const keys = bonusKeysOf(ids);
  const [payouts, cards] = await Promise.all([
    db.vaultTransaction.findMany({
      where: { type: "EARN_BONUS", source: { in: [...keys.keys()] } },
      select: { source: true },
    }),
    db.card.findMany({
      where: { lorewardEntryId: { in: ids } },
      select: { lorewardEntryId: true, lorewardEdition: true },
    }),
  ]);
  return { rows, paid: payouts.map((p) => keys.get(p.source)!), cards };
}

/** Every weekly row, any status, and the plan that folds them into ISO keys. */
export async function loadWeeklyPlan(db: PrismaClient): Promise<WeeklyPlan> {
  const rows: WeeklyRow[] = [];
  const paid = new Set<string>();
  const cards = new Map<string, string[]>();
  let after: string | undefined;
  for (;;) {
    const page = await readPage(db, after);
    rows.push(...page.rows);
    for (const id of page.paid) paid.add(id);
    for (const card of page.cards) {
      const id = card.lorewardEntryId!;
      cards.set(id, [...(cards.get(id) ?? []), card.lorewardEdition ?? ""]);
    }
    const last = page.rows.at(-1);
    if (page.rows.length < PAGE || !last) break;
    after = last.id;
  }
  return planWeeklyMerge(rows, { paid, cards });
}

/** Moves each loser's trophy cards to the survivor: the column and the `entryId` in the card's metadata. */
async function moveCardsTx(tx: Prisma.TransactionClient, merge: WeeklyMerge): Promise<void> {
  const cards = await tx.card.findMany({
    where: { lorewardEntryId: { in: merge.loserIds } },
    select: { id: true, metadata: true },
  });
  for (const card of cards) {
    await tx.card.update({
      where: { id: card.id },
      data: {
        lorewardEntryId: merge.survivorId,
        metadata: { ...metaOf(card.metadata), entryId: merge.survivorId },
      },
    });
  }
}

/**
 * Inside the contest's place locks (the payout and the trophy grant take them too): false when a row is gone or a
 * loser was paid since the plan was made (deleting it would free its payout key), else the merge.
 */
async function mergeTx(tx: Prisma.TransactionClient, merge: WeeklyMerge): Promise<boolean> {
  const contest = { type: "weekly", date: merge.key.date, dateStart: merge.key.dateStart };
  for (const place of PLACES) await lockContestPlace(tx, contestPlaceKey(contest, place));
  const ids = [merge.survivorId, ...merge.loserIds];
  if ((await tx.lorewardEntry.count({ where: { id: { in: ids } } })) !== ids.length) return false;
  const loserPaid = await tx.vaultTransaction.findFirst({
    where: { type: "EARN_BONUS", source: { in: [...bonusKeysOf(merge.loserIds).keys()] } },
    select: { id: true },
  });
  if (loserPaid) return false;
  await moveCardsTx(tx, merge);
  // Deleting first frees the losers' `(date, type)` key for the survivor.
  await tx.lorewardEntry.deleteMany({ where: { id: { in: merge.loserIds } } });
  await tx.lorewardEntry.update({
    where: { id: merge.survivorId },
    data: { ...merge.key, ...merge.fill },
  });
  return true;
}

/**
 * One merge in one transaction. False (nothing written) when its rows changed since the plan, or a card or key it would
 * move is taken (a card minted on the survivor meanwhile): the next run plans from what is stored.
 */
export async function applyWeeklyMerge(db: PrismaClient, merge: WeeklyMerge): Promise<boolean> {
  try {
    return await db.$transaction((tx) => mergeTx(tx, merge), TX_OPTIONS);
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

function printPlan(plan: WeeklyPlan): void {
  const skipped: Partial<Record<WeeklySkipReason, number>> = {};
  for (const s of plan.skipped) skipped[s.reason] = (skipped[s.reason] ?? 0) + 1;
  const folds = plan.merges.filter((m) => m.loserIds.length > 0);
  const counts = {
    merges: plan.merges.length,
    renames: plan.merges.length - folds.length,
    folds: folds.length,
    rowsDeleted: folds.reduce((n, m) => n + m.loserIds.length, 0),
    unchanged: plan.unchanged,
    skipped,
  };
  console.log(JSON.stringify({ counts, skipped: plan.skipped, folds }, null, 2));
}

async function main(): Promise<void> {
  const { apply } = parseMergeArgs(process.argv.slice(2));
  const db = new PrismaClient();
  try {
    const plan = await loadWeeklyPlan(db);
    printPlan(plan);
    if (!apply) {
      console.log("[merge-weekly-keys] dry run: nothing written (pass --apply to write)");
      return;
    }
    let applied = 0;
    for (const merge of plan.merges) if (await applyWeeklyMerge(db, merge)) applied += 1;
    console.log(`[merge-weekly-keys] applied ${applied} of ${plan.merges.length} merges`);
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.main) {
  main().catch((error: Error) => {
    console.error(`[merge-weekly-keys] failed: ${error.message}`);
    process.exitCode = 1;
  });
}
