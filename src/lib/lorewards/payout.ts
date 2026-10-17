/**
 * payout.ts
 * Pays the Loreward IxCredit bonuses: the winner and the runner-up of each approved contest, once per place.
 */

import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  getBonusConfig,
  getLorewardPayouts,
  grantBonusTx,
  LOREWARD_PAYOUT_START,
  lorewardBonusKey,
  type LorewardPlace,
  type LorewardType,
} from "~/lib/vault/vault-bonus";
import {
  contestHolder,
  contestPlaceKey,
  describeConflict,
  groupByContest,
  type Contest,
} from "./contest-identity";
import {
  contestEntryIds,
  findContestEntries,
  lockContestPlace,
  type StoredContestEntry,
} from "./contest-store";
import { placeOf, resolveLorewardPlace } from "./resolve-user";
import { LedgerError } from "~/lib/vault/vault-ledger";

const PAID_PLACES: LorewardPlace[] = ["winner", "runner-up"];

function isPaidType(type: string): type is LorewardType {
  return type === "daily" || type === "weekly" || type === "monthly";
}

/** The day an entry counts from for the payout start: a daily's `date`, a weekly or monthly's `dateEnd`. */
function payoutDay(entry: { type: string; date: string; dateEnd: string | null }): string {
  return entry.type === "daily" ? entry.date : (entry.dateEnd ?? entry.date);
}

/**
 * A month before `day`: the earliest first day of a weekly or monthly that ends on or after it, so a first-day twin
 * (no range) of a contest that ends after the payout start is read with its state-keyed entry.
 */
const monthBefore = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) - 31 * 86_400_000).toISOString().slice(0, 10);

/**
 * The approved entries a payout can reach: a payout day (a daily's date, a weekly's or monthly's `dateEnd`) on or
 * after `LOREWARD_PAYOUT_START`, plus the first-day twins of the contests that end after it. Read in pages, so the
 * 1,000-row cap never drops one.
 */
function paidEntries(): Promise<StoredContestEntry[]> {
  const ranged = { type: { in: ["weekly", "monthly"] } };
  return findContestEntries(db, {
    status: "approved",
    OR: [
      { type: "daily", date: { gte: LOREWARD_PAYOUT_START } },
      { ...ranged, dateEnd: { gte: LOREWARD_PAYOUT_START } },
      { ...ranged, dateEnd: null, date: { gte: monthBefore(LOREWARD_PAYOUT_START) } },
    ],
  });
}

/**
 * Whether a Loreward bonus was paid for this place already, to anyone, under the key of any of `entryIds` (the
 * contest's entries, read inside the place's lock). A place pays once, whoever holds it now.
 */
async function contestPlacePaid(
  tx: Prisma.TransactionClient,
  entryIds: string[],
  place: LorewardPlace
): Promise<boolean> {
  const paid = await tx.vaultTransaction.findFirst({
    where: {
      type: "EARN_BONUS",
      source: { in: entryIds.map((id) => lorewardBonusKey(id, place)) },
    },
    select: { id: true },
  });
  return paid !== null;
}

/** What paying one place came to: paid, refused by the ledger (earning off, maintenance), or not paid. */
type PlaceOutcome = "paid" | "refused" | "unpaid";

/**
 * Pay one place of one contest, once, through the entry `contestHolder` chooses: in one transaction that takes the
 * place's advisory lock, then reads the contest's entries again and pays only when none was paid for the place, so
 * overlapping or successive runs that listed different entries pay it at most once.
 */
async function payPlace(
  contest: Contest<StoredContestEntry>,
  place: LorewardPlace,
  payouts: Awaited<ReturnType<typeof getLorewardPayouts>>
): Promise<PlaceOutcome> {
  const holder = contestHolder(contest, place);
  if ("conflict" in holder) {
    console.warn(
      `[Lorewards] Not paying ${describeConflict(holder.conflict, place)}: the entries disagree. Settle it at the source (the bot's state file or the OOL page); an overrideWinner on one copy is rewritten by the next sync.`
    );
    return "unpaid";
  }
  const e = holder.entry;
  const recorded = placeOf(e, place);
  if (!isPaidType(e.type) || !recorded) return "unpaid";
  const amount = payouts[e.type][place];
  if (amount <= 0) return "unpaid";
  const userId = await resolveLorewardPlace(db, recorded);
  if (!userId) return "unpaid"; // no account can be told behind the place: skip

  const metadata = {
    entryId: e.id,
    date: e.date,
    type: e.type,
    place,
    wikiUser: recorded.wikiUser,
    winnerUser: e.winnerUser,
    ...(recorded.page ? { page: recorded.page } : {}),
  };
  try {
    const paid = await db.$transaction(async (tx) => {
      await lockContestPlace(tx, contestPlaceKey(e, place));
      if (await contestPlacePaid(tx, await contestEntryIds(tx, e), place)) return false;
      return grantBonusTx(tx, userId, lorewardBonusKey(e.id, place), amount, metadata);
    });
    return paid ? "paid" : "unpaid";
  } catch (error) {
    // The ledger refusing an earn (earning switched off, maintenance) rolls the payment back: the key stays free.
    if (error instanceof LedgerError) return "refused";
    console.error(`[Lorewards] Paying ${contestPlaceKey(e, place)} failed:`, error);
    return "unpaid";
  }
}

/**
 * Pay the winner and the runner-up of every approved daily, weekly and monthly contest from the payout start
 * (`LOREWARD_PAYOUT_START`) on, by contest and place (`resolveLorewardPlace`). A plain name pays only the exact holder
 * of its VERIFIED ixwiki `WikiAccountLink`; a `wikios>Label` name pays the one WikiOS account behind the label's
 * edits to the winning page in the contest. Anything else pays no one. A contest stored twice (`groupByContest`)
 * pays each place once, through its state-keyed entry, and not at all while its entries name different holders.
 * Entries before the start are never paid, so an account found later does not back-pay history. Idempotent and
 * safe to overlap: each place pays inside one transaction holding its advisory lock (`contestPlaceKey`), and only
 * when no entry of the contest was paid for it yet, to anyone, under `lorewardBonusKey(entryId, place)`. So a place
 * pays its first holder only; a later holder (an OOL write, a twin, an admin override after payment) is not paid.
 * Returns the number of newly-granted bonuses.
 */
export async function grantLorewardBonuses(): Promise<number> {
  const cfg = await getBonusConfig(db);
  if (!cfg.enabled) return 0;
  const payouts = await getLorewardPayouts(db);
  const entries = await paidEntries();

  const outcomes: PlaceOutcome[] = [];
  for (const contest of groupByContest(entries.filter((e) => isPaidType(e.type)))) {
    // The contest's payout day is read from its state-keyed entry (the one with a range), as it pays through it.
    const lead = contest.find((e) => e.dateStart !== null) ?? contest[0];
    if (payoutDay(lead) < LOREWARD_PAYOUT_START) continue;
    for (const place of PAID_PLACES) outcomes.push(await payPlace(contest, place, payouts));
  }
  const granted = outcomes.filter((outcome) => outcome === "paid").length;
  const refused = outcomes.filter((outcome) => outcome === "refused").length;
  if (refused > 0) {
    console.warn(
      `[Lorewards] The ledger refused ${refused} Loreward bonuses (earning is off or in maintenance); their places stay unpaid and are tried again on the next run.`
    );
  }
  console.log(`[Lorewards] Granted ${granted} new Loreward bonuses.`);
  return granted;
}
