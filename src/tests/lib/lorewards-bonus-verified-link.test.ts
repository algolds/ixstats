/** @jest-environment node */
/**
 * Loreward payouts by contest and place. A plain (MediaWiki) name pays only the owner of its VERIFIED ixwiki
 * WikiAccountLink (an exact match on the normalized name); a `wikios>Label` name pays the one WikiOS account behind
 * the label's edits to the winning page in the contest. Never to whoever holds the legacy User.wikiUsername (which
 * could be set without proof), and only for entries from the payout start on.
 */
jest.mock("~/server/db", () => {
  // The client the payout's transaction runs on: distinct from `db`, so a lock or check made on `db` is caught.
  const tx = {
    $executeRaw: jest.fn(
      async (_strings: TemplateStringsArray, ..._values: Array<string | number>) => 0
    ),
    // The contest's entries, read again inside the place's lock.
    lorewardEntry: { findMany: jest.fn() },
    // A Loreward bonus already paid for the contest place, under any of its entries' keys.
    vaultTransaction: { findFirst: jest.fn(async () => null) },
  };
  const db = {
    lorewardEntry: { findMany: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn() },
    // No winning edits mirrored: no WikiOS account is behind the place.
    wikiRevision: { groupBy: jest.fn(async () => []) },
    systemConfig: { findMany: jest.fn() },
    user: { findFirst: jest.fn() },
    vaultTransaction: { findFirst: jest.fn(async () => null) },
    $executeRaw: jest.fn(async () => 0),
    $transaction: jest.fn(async (run: (client: typeof tx) => Promise<boolean>) => run(tx)),
  };
  return { __esModule: true, db, tx };
});

jest.mock("~/lib/vault/vault-bonus", () => ({
  ...jest.requireActual("~/lib/vault/vault-bonus"),
  getBonusConfig: jest.fn(),
  grantBonusTx: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { LedgerError } from "~/lib/vault/vault-ledger";
import { matches, storedEntry } from "~/tests/helpers/loreward-entry-store";
import { getBonusConfig, grantBonusTx, LOREWARD_PAYOUT_START } from "~/lib/vault/vault-bonus";
import { grantLorewardBonuses } from "~/lib/lorewards/sync";

const mocked = db as unknown as {
  lorewardEntry: { findMany: jest.Mock };
  wikiAccountLink: { findFirst: jest.Mock };
  wikiRevision: { groupBy: jest.Mock };
  systemConfig: { findMany: jest.Mock };
  user: { findFirst: jest.Mock };
  vaultTransaction: { findFirst: jest.Mock };
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
};

/** The transaction client the `$transaction` mock hands the payout. */
const { tx } = jest.requireMock<{
  tx: {
    $executeRaw: jest.Mock<Promise<number>, [TemplateStringsArray, ...Array<string | number>]>;
    lorewardEntry: { findMany: jest.Mock };
    vaultTransaction: { findFirst: jest.Mock };
  };
}>("~/server/db");

type Entry = {
  id: string;
  type: string;
  date: string;
  dateStart?: string | null;
  dateEnd: string | null;
  winnerUser: string | null;
  winnerPage?: string | null;
  runnerUpUser: string | null;
  runnerUpPage?: string | null;
};

const daily = (over: Partial<Entry> = {}): Entry => ({
  id: "e1",
  type: "daily",
  date: "2026-10-16",
  dateStart: null,
  dateEnd: null,
  winnerUser: "Kir_Republic",
  runnerUpUser: null,
  ...over,
});

/** The entries the run lists; by default the lock's re-read finds the same ones, through the real `where`. */
let listed: Entry[] = [];
function listing(rows: Entry[]) {
  listed = rows;
  mocked.lorewardEntry.findMany.mockResolvedValue(rows);
}
const reread = async ({ where }: { where: Parameters<typeof matches>[1] }) =>
  listed.filter((row) => matches(storedEntry(row), where)).map((row) => ({ id: row.id }));

/** A fresh transaction client per test, and nothing carried over from an earlier test. */
function resetTransaction() {
  mocked.$transaction.mockClear();
  mocked.$executeRaw.mockClear();
  mocked.vaultTransaction.findFirst.mockClear();
  tx.$executeRaw.mockClear();
  tx.lorewardEntry.findMany.mockReset().mockImplementation(reread);
  tx.vaultTransaction.findFirst.mockReset().mockResolvedValue(null);
}

function grants() {
  return jest
    .mocked(grantBonusTx)
    .mock.calls.map(([, userId, source, amount]) => [userId, source, amount]);
}

describe("grantLorewardBonuses page metadata", () => {
  beforeEach(() => {
    jest.mocked(grantBonusTx).mockReset().mockResolvedValue(true);
    jest
      .mocked(getBonusConfig)
      .mockReset()
      .mockResolvedValue({ enabled: 1 } as never);
    mocked.systemConfig.findMany.mockReset().mockResolvedValue([]);
    mocked.wikiAccountLink.findFirst.mockReset().mockResolvedValue({ userId: "u_verified" });
    resetTransaction();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  const metadataOf = (call: number) => jest.mocked(grantBonusTx).mock.calls[call]?.[4];

  it("records each place's own page, and omits a missing one", async () => {
    listing([
      daily({
        winnerPage: "Kir Republic",
        runnerUpUser: "Other",
        runnerUpPage: "Other page",
      }),
      // Another day: two dailies of one date cannot exist (the (date, type) key).
      daily({ id: "e2", date: "2026-10-17", winnerUser: "NoPage", winnerPage: null }),
    ]);
    await grantLorewardBonuses();
    expect(metadataOf(0)).toMatchObject({ place: "winner", page: "Kir Republic" });
    expect(metadataOf(1)).toMatchObject({ place: "runner-up", page: "Other page" });
    expect(metadataOf(2)).not.toHaveProperty("page");
  });
});

describe("grantLorewardBonuses", () => {
  beforeEach(() => {
    jest.mocked(grantBonusTx).mockReset().mockResolvedValue(true);
    jest
      .mocked(getBonusConfig)
      .mockReset()
      .mockResolvedValue({ enabled: 1 } as never);
    mocked.user.findFirst.mockReset();
    mocked.systemConfig.findMany.mockReset().mockResolvedValue([]);
    mocked.wikiAccountLink.findFirst.mockReset().mockResolvedValue({ userId: "u_verified" });
    mocked.lorewardEntry.findMany.mockReset();
    listing([daily()]);
    mocked.wikiRevision.groupBy.mockReset().mockResolvedValue([]);
    resetTransaction();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  /** A weekly stored twice: by its first day (the OOL page) and as `2026-W43` with its range (the state file). */
  const weeklyTwins = (oolWinner: string, stateWinner: string) => [
    daily({
      id: "w-ool",
      type: "weekly",
      date: "2026-10-19",
      dateEnd: null,
      winnerUser: oolWinner,
    }),
    daily({
      id: "w-state",
      type: "weekly",
      date: "2026-W43",
      dateStart: "2026-10-19",
      dateEnd: "2026-10-25",
      winnerUser: stateWinner,
    }),
  ];

  it("pays an agreeing weekly pair once, through its state-keyed entry", async () => {
    listing(weeklyTwins("Kir_Republic", "Kir_Republic"));
    expect(await grantLorewardBonuses()).toBe(1);
    expect(grants()).toEqual([["u_verified", "bonus:loreward:w-state", 1500]]);
    expect(tx.vaultTransaction.findFirst).toHaveBeenCalledWith({
      where: {
        type: "EARN_BONUS",
        source: { in: ["bonus:loreward:w-ool", "bonus:loreward:w-state"] },
      },
      select: { id: true },
    });
  });

  it("does not pay a pair again when one entry was already paid under its own key", async () => {
    listing(weeklyTwins("Kir_Republic", "Kir_Republic"));
    tx.vaultTransaction.findFirst.mockResolvedValue({ id: "paid" });
    expect(await grantLorewardBonuses()).toBe(0);
    expect(grantBonusTx).not.toHaveBeenCalled();
  });

  it("pays a contest place once: a later holder of the same entry is not paid", async () => {
    // The ledger the payout reads: a source is paid once the grant wrote it.
    const paid = new Set<string>();
    jest.mocked(grantBonusTx).mockImplementation(async (_tx, _user, source) => {
      paid.add(source);
      return true;
    });
    tx.vaultTransaction.findFirst.mockImplementation(
      async ({ where }: { where: { source: { in: string[] } } }) =>
        where.source.in.some((source) => paid.has(source)) ? { id: "paid" } : null
    );

    expect(await grantLorewardBonuses()).toBe(1);
    // An OOL write (or an override) names another holder on the same row before the next run.
    listing([daily({ winnerUser: "Other" })]);
    mocked.wikiAccountLink.findFirst.mockResolvedValue({ userId: "u_other" });
    expect(await grantLorewardBonuses()).toBe(0);

    expect(grants()).toEqual([["u_verified", "bonus:loreward:e1", 500]]);
  });

  it("locks the place by its identity key, then re-reads, checks and pays, all on the transaction's client", async () => {
    await grantLorewardBonuses();

    const [strings, ...values] = tx.$executeRaw.mock.calls[0]!;
    expect(strings.join("?")).toContain("pg_advisory_xact_lock");
    expect(values).toContain("daily:2026-10-16:winner");
    const order = [
      tx.$executeRaw.mock.invocationCallOrder[0],
      tx.lorewardEntry.findMany.mock.invocationCallOrder[0],
      tx.vaultTransaction.findFirst.mock.invocationCallOrder[0],
      jest.mocked(grantBonusTx).mock.invocationCallOrder[0],
    ];
    expect(order.every((at) => at !== undefined)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a! - b!));
    expect(jest.mocked(grantBonusTx).mock.calls[0]![0]).toBe(tx);
    // Neither the lock nor the check runs on the root client.
    expect(mocked.$executeRaw).not.toHaveBeenCalled();
    expect(mocked.vaultTransaction.findFirst).not.toHaveBeenCalled();
  });

  it("does not pay a place the lock's re-read finds paid under a twin this run never listed", async () => {
    // Run B listed [ool, state] and paid under the state entry's key; run A listed only [ool], then waited.
    const [ool] = weeklyTwins("Kir_Republic", "Kir_Republic");
    listing([ool!]);
    tx.lorewardEntry.findMany.mockResolvedValueOnce([{ id: "w-ool" }, { id: "w-state" }]);
    tx.vaultTransaction.findFirst.mockImplementation(
      async ({ where }: { where: { source: { in: string[] } } }) =>
        where.source.in.includes("bonus:loreward:w-state") ? { id: "paid-by-b" } : null
    );

    expect(await grantLorewardBonuses()).toBe(0);
    expect(grantBonusTx).not.toHaveBeenCalled();
  });

  it("reads only the entries a payout can reach, in pages, from the payout start on", async () => {
    await grantLorewardBonuses();
    expect(mocked.lorewardEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "approved",
          OR: [
            { type: "daily", date: { gte: "2026-10-15" } },
            { type: { in: ["weekly", "monthly"] }, dateEnd: { gte: "2026-10-15" } },
            // A first-day twin of a weekly or monthly that ends after the start began at most a month before it.
            { type: { in: ["weekly", "monthly"] }, dateEnd: null, date: { gte: "2026-09-14" } },
          ],
        },
        orderBy: { id: "asc" },
        take: 500,
      })
    );
  });

  it("logs a ledger refusal once per run, as a warning, and pays nothing", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    listing([daily({ runnerUpUser: "Second_Place" })]);
    jest
      .mocked(grantBonusTx)
      .mockRejectedValue(new LedgerError("EARNING_DISABLED", "Earning credits is off."));

    expect(await grantLorewardBonuses()).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toEqual(expect.stringContaining("refused 2 Loreward bonuses"));
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it("pays neither entry of a pair that disagrees on a place, and logs both", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    listing(weeklyTwins("Urcea", "Nasastan"));
    expect(await grantLorewardBonuses()).toBe(0);
    expect(grantBonusTx).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining("w-ool (2026-10-19) names Urcea")
    );
    expect(warn.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining("w-state (2026-W43) names Nasastan")
    );
    // Settled at the source: an override of one copy is rewritten by the next sync.
    expect(warn.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining("the bot's state file or the OOL page")
    );
    warn.mockRestore();
  });

  it("pays the owner of the verified ixwiki link, matching the normalized name", async () => {
    expect(await grantLorewardBonuses()).toBe(1);
    // A contest stored once is checked for an earlier payment of its place too, then paid as before.
    expect(tx.vaultTransaction.findFirst).toHaveBeenCalledWith({
      where: { type: "EARN_BONUS", source: { in: ["bonus:loreward:e1"] } },
      select: { id: true },
    });
    expect(mocked.wikiAccountLink.findFirst).toHaveBeenCalledWith({
      where: { source: "ixwiki", username: "Kir Republic", verifiedAt: { not: null } },
      select: { userId: true },
    });
    expect(grantBonusTx).toHaveBeenCalledWith(
      expect.anything(),
      "u_verified",
      "bonus:loreward:e1",
      500,
      expect.objectContaining({ entryId: "e1", type: "daily", place: "winner" })
    );
  });

  it("pays nobody when only the legacy User.wikiUsername column matches", async () => {
    mocked.wikiAccountLink.findFirst.mockResolvedValue(null);
    mocked.user.findFirst.mockResolvedValue({ id: "u_squatter" });
    expect(await grantLorewardBonuses()).toBe(0);
    expect(grantBonusTx).not.toHaveBeenCalled();
    expect(mocked.user.findFirst).not.toHaveBeenCalled();
  });

  it("pays a wikios> winner's WikiOS account for the label's edits to the page in the contest", async () => {
    listing([daily({ winnerUser: "wikios>Kir_Republic", winnerPage: "Seneca front" })]);
    mocked.wikiRevision.groupBy.mockResolvedValue([{ authorId: "u_wikios" }]);
    expect(await grantLorewardBonuses()).toBe(1);
    expect(mocked.wikiRevision.groupBy).toHaveBeenCalledWith({
      by: ["authorId"],
      where: {
        source: "ixwiki",
        author: "Kir_Republic",
        createdAt: {
          gte: new Date("2026-10-16T00:00:00.000Z"),
          lt: new Date("2026-10-17T06:00:00.000Z"),
        },
        article: { source: "ixwiki", title: "Seneca front", redirectTargetSlug: null },
      },
    });
    // A link never applies to a wikios> name.
    expect(mocked.wikiAccountLink.findFirst).not.toHaveBeenCalled();
    expect(grants()).toEqual([["u_wikios", "bonus:loreward:e1", 500]]);
  });

  it("pays nobody for a wikios> place whose label two accounts, or a MediaWiki editor, used", async () => {
    listing([daily({ winnerUser: "wikios>Kir_Republic", winnerPage: "Seneca front" })]);
    mocked.wikiRevision.groupBy.mockResolvedValue([{ authorId: "u_wikios" }, { authorId: null }]);
    expect(await grantLorewardBonuses()).toBe(0);
    expect(grantBonusTx).not.toHaveBeenCalled();
  });

  it("pays nobody for a plain name without a link, and never reads its edits", async () => {
    mocked.wikiAccountLink.findFirst.mockResolvedValue(null);
    listing([daily({ winnerPage: "Seneca front" })]);
    mocked.wikiRevision.groupBy.mockResolvedValue([{ authorId: "u_wikios" }]);
    expect(await grantLorewardBonuses()).toBe(0);
    expect(mocked.wikiRevision.groupBy).not.toHaveBeenCalled();
  });

  it("pays nobody for a wikios> weekly with no recorded range", async () => {
    listing([
      daily({
        id: "w1",
        type: "weekly",
        date: "2026-10-19",
        dateEnd: "2026-10-25",
        winnerUser: "wikios>Kir_Republic",
        winnerPage: "Seneca front",
      }),
    ]);
    mocked.wikiRevision.groupBy.mockResolvedValue([{ authorId: "u_wikios" }]);
    expect(await grantLorewardBonuses()).toBe(0);
    expect(mocked.wikiRevision.groupBy).not.toHaveBeenCalled();
  });

  it("pays the winner and the runner-up of a daily by place, under distinct keys", async () => {
    listing([daily({ runnerUpUser: "Second_Place" })]);
    mocked.wikiAccountLink.findFirst
      .mockResolvedValueOnce({ userId: "u_win" })
      .mockResolvedValueOnce({ userId: "u_run" });

    expect(await grantLorewardBonuses()).toBe(2);
    expect(grants()).toEqual([
      ["u_win", "bonus:loreward:e1", 500],
      ["u_run", "bonus:loreward:e1:runner-up", 150],
    ]);
    expect(jest.mocked(grantBonusTx).mock.calls[1]?.[4]).toMatchObject({
      entryId: "e1",
      place: "runner-up",
      type: "daily",
    });
  });

  it("pays weekly and monthly winners their own amounts", async () => {
    listing([
      daily({ id: "w1", type: "weekly", date: "2026-W43", dateEnd: "2026-10-25" }),
      daily({ id: "m1", type: "monthly", date: "2026-10-01", dateEnd: "2026-10-31" }),
    ]);
    await grantLorewardBonuses();
    expect(grants()).toEqual([
      ["u_verified", "bonus:loreward:w1", 1500],
      ["u_verified", "bonus:loreward:m1", 4000],
    ]);
  });

  it("pays a recorded weekly runner-up its amount", async () => {
    listing([
      daily({
        id: "w1",
        type: "weekly",
        date: "2026-W43",
        dateEnd: "2026-10-25",
        winnerUser: null,
        runnerUpUser: "R",
      }),
    ]);
    await grantLorewardBonuses();
    expect(grants()).toEqual([["u_verified", "bonus:loreward:w1:runner-up", 400]]);
  });

  it("pays nothing for entries before the payout start, comparing date for dailies and dateEnd for the rest", async () => {
    expect(LOREWARD_PAYOUT_START).toBe("2026-10-15");
    listing([
      daily({ id: "old", date: "2026-10-14", runnerUpUser: "R" }),
      daily({ id: "w-old", type: "weekly", date: "2026-W41", dateEnd: "2026-10-11" }),
      daily({ id: "w-straddle", type: "weekly", date: "2026-W42", dateEnd: "2026-10-18" }),
      daily({ id: "first-day", date: "2026-10-15" }),
    ]);
    await grantLorewardBonuses();
    expect(grants()).toEqual([
      ["u_verified", "bonus:loreward:w-straddle", 1500],
      ["u_verified", "bonus:loreward:first-day", 500],
    ]);
  });

  it("skips annual entries and entries with nobody recorded", async () => {
    listing([
      daily({ id: "a1", type: "annual", date: "2026-12-31" }),
      daily({ id: "n1", winnerUser: null }),
    ]);
    expect(await grantLorewardBonuses()).toBe(0);
    expect(grantBonusTx).not.toHaveBeenCalled();
  });

  it("reads SystemConfig overrides per type and place, and skips a place set to zero", async () => {
    mocked.systemConfig.findMany.mockResolvedValue([
      { key: "vault_bonus_loreward_daily_winner", value: "700" },
      { key: "vault_bonus_loreward_daily_runner_up", value: "0" },
      { key: "vault_bonus_loreward_weekly_winner", value: "not a number" },
    ]);
    listing([daily({ runnerUpUser: "R" })]);
    await grantLorewardBonuses();
    expect(mocked.systemConfig.findMany).toHaveBeenCalledWith({
      where: { key: { startsWith: "vault_bonus_loreward_" } },
      select: { key: true, value: true },
    });
    expect(grants()).toEqual([["u_verified", "bonus:loreward:e1", 700]]);
  });

  it("pays nothing while bonuses are switched off", async () => {
    jest.mocked(getBonusConfig).mockResolvedValue({ enabled: 0 } as never);
    expect(await grantLorewardBonuses()).toBe(0);
    expect(mocked.lorewardEntry.findMany).not.toHaveBeenCalled();
  });
});
