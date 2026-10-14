/** @jest-environment node */
jest.mock("~/lib/lorewards/scoring", () => ({ scoreDailyWikiOS: jest.fn() }));
jest.mock("~/lib/lorewards/resolve-user", () => ({ resolveLorewardUser: jest.fn() }));
jest.mock("~/lib/vault/vault-perks", () => ({ getYieldBoostMultiplier: jest.fn() }));
jest.mock("~/lib/vault/vault-service", () => ({ earnCreditsOnce: jest.fn() }));

import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "@jest/globals";
import { resolveLorewardUser } from "~/lib/lorewards/resolve-user";
import { scoreDailyWikiOS } from "~/lib/lorewards/scoring";
import { dividendKey, parseDividendMetadata } from "~/lib/vault/vault-dividend";
import { getYieldBoostMultiplier } from "~/lib/vault/vault-perks";
import { earnCreditsOnce } from "~/lib/vault/vault-service";
import {
  settleDividendDay,
  settleMissedDividends,
} from "~/server/modules/vault/vault-dividend-settle";

interface Range {
  gte: Date;
  lt: Date;
}
interface Dated {
  createdAt?: Date;
  openedAt?: Date;
  respondedAt?: Date;
}
const within = (where: { [field: string]: Range | undefined }, field: string, row: Dated) => {
  const range = where[field];
  const at = row[field as keyof Dated];
  return !range || (!!at && at >= range.gte && at < range.lt);
};

interface World {
  vaults: { userId: string; loginStreak: number; lastLoginDate: Date | null }[];
  posts: { accountId: string; createdAt: Date }[];
  accounts: { id: string; clerkUserId: string }[];
  users: { id: string; clerkUserId: string }[];
  forumPosts: { authorUserId: string; createdAt: Date }[];
  packs: { userId: string; openedAt: Date }[];
  trades: { initiatorId: string; recipientId: string; respondedAt: Date }[];
  sales: { vault: { userId: string }; createdAt: Date }[];
  ownerships: { ownerId: string; quantity: number; cards: { marketValue: number } }[];
}

const at = (iso: string) => new Date(`${iso}Z`);
const D = "2026-10-20";

let world: World;
let ledger: Set<string>;
let rows: { userId: string; amount: number; idempotencyKey: string; metadata?: object }[];
let db: PrismaClient;

function group<T extends Dated>(
  data: T[],
  field: string,
  by: keyof T & string
): (args: {
  where: { [f: string]: Range | undefined };
}) => Promise<{ [k: string]: string | { _all: number } }[]> {
  return async ({ where }) => {
    const counts = new Map<string, number>();
    for (const row of data.filter((r) => within(where, field, r)))
      counts.set(String(row[by]), (counts.get(String(row[by])) ?? 0) + 1);
    return [...counts].map(([key, n]) => ({ [by]: key, _count: { _all: n } }));
  };
}

function buildDb(): PrismaClient {
  const fake = {
    myVault: { findMany: jest.fn(async () => world.vaults) },
    thinkpagesPost: { groupBy: jest.fn(group(world.posts, "createdAt", "accountId")) },
    thinkpagesAccount: { findMany: jest.fn(async () => world.accounts) },
    user: { findMany: jest.fn(async () => world.users) },
    forumPost: { groupBy: jest.fn(group(world.forumPosts, "createdAt", "authorUserId")) },
    userPack: { groupBy: jest.fn(group(world.packs, "openedAt", "userId")) },
    tradeOffer: {
      groupBy: jest.fn(
        async (args: { by: ["initiatorId" | "recipientId"]; where: { respondedAt: Range } }) =>
          group(
            world.trades,
            "respondedAt",
            args.by[0]
          )({ where: { respondedAt: args.where.respondedAt } })
      ),
    },
    vaultTransaction: {
      findMany: jest.fn(async ({ where }: { where: { createdAt: Range } }) =>
        world.sales.filter((s) => within(where, "createdAt", s))
      ),
      findFirst: jest.fn(async ({ where }: { where: { idempotencyKey: { endsWith: string } } }) =>
        [...ledger].some((k) => k.endsWith(where.idempotencyKey.endsWith)) ? { id: "x" } : null
      ),
    },
    cardOwnership: { findMany: jest.fn(async () => world.ownerships) },
  };
  return fake as unknown as PrismaClient;
}

const rowsFor = (userId: string) => rows.filter((r) => r.userId === userId);

beforeEach(() => {
  world = {
    vaults: [],
    posts: [],
    accounts: [],
    users: [],
    forumPosts: [],
    packs: [],
    trades: [],
    sales: [],
    ownerships: [],
  };
  ledger = new Set();
  rows = [];
  db = buildDb();
  jest.mocked(scoreDailyWikiOS).mockResolvedValue({ candidates: [] } as never);
  jest.mocked(resolveLorewardUser).mockResolvedValue(null);
  jest.mocked(getYieldBoostMultiplier).mockResolvedValue(0);
  jest.mocked(earnCreditsOnce).mockImplementation(async (_db, input) => {
    const key = input.idempotencyKey;
    if (ledger.has(key)) return { success: true, alreadyApplied: true, newBalance: 0 };
    ledger.add(key);
    rows.push({
      userId: input.userId,
      amount: input.amount,
      idempotencyKey: key,
      metadata: input.metadata,
    });
    return { success: true, alreadyApplied: false, newBalance: input.amount };
  });
});

const vault = (userId: string, loginStreak = 0, lastLoginDate: Date | null = null) =>
  world.vaults.push({ userId, loginStreak, lastLoginDate });
const deck = (ownerId: string, marketValue: number, quantity = 1) =>
  world.ownerships.push({ ownerId, quantity, cards: { marketValue } });

describe("settleDividendDay", () => {
  it("pays a user with only interest", async () => {
    vault("u1");
    deck("u1", 2000);
    expect(await settleDividendDay(db, D)).toEqual({ paid: 1, skipped: 0 });
    expect(rowsFor("u1")).toMatchObject([{ amount: 5, idempotencyKey: dividendKey("u1", D) }]);
    expect(earnCreditsOnce).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ type: "EARN_PASSIVE", source: "VAULT_DIVIDEND", userId: "u1" })
    );
  });

  it("skips vaults with nothing to pay and users without a vault", async () => {
    vault("u1");
    vault("u2");
    deck("u2", 100); // interest rounds to 0
    deck("ghost", 100_000); // no vault
    expect(await settleDividendDay(db, D)).toEqual({ paid: 0, skipped: 0 });
    expect(rows).toEqual([]);
  });

  it("writes one row per user when the same day is settled twice", async () => {
    vault("u1");
    vault("u2");
    deck("u1", 2000);
    deck("u2", 4000);
    expect(await settleDividendDay(db, D)).toEqual({ paid: 2, skipped: 0 });
    expect(await settleDividendDay(db, D)).toEqual({ paid: 0, skipped: 2 });
    expect(rows).toHaveLength(2);
  });

  it("stores the breakdown as the row's metadata and it round-trips", async () => {
    vault("u1", 4, at("2026-10-19T08:00:00"));
    world.users.push({ id: "u1", clerkUserId: "c1" });
    world.accounts.push({ id: "a1", clerkUserId: "c1" });
    for (const hour of ["10", "11", "12"])
      world.posts.push({ accountId: "a1", createdAt: at(`2026-10-20T${hour}:00:00`) });
    deck("u1", 2000);
    await settleDividendDay(db, D);
    const meta = parseDividendMetadata(JSON.stringify(rowsFor("u1")[0]?.metadata));
    expect(meta?.day).toBe(D);
    expect(meta?.inputs).toMatchObject({ deckValue: 2000, posts: 3, streakDays: 4 });
    expect(meta?.lines.map((l) => l.key)).toEqual(["interest", "posts", "streak"]);
    expect(meta?.lines.reduce((sum, l) => sum + l.amount, 0)).toBe(rowsFor("u1")[0]?.amount);
  });

  it("counts only human ThinkPages posts and visible forum posts from the day", async () => {
    vault("u1");
    world.users.push({ id: "u1", clerkUserId: "c1" });
    world.accounts.push({ id: "a1", clerkUserId: "c1" });
    world.posts.push(
      { accountId: "a1", createdAt: at("2026-10-20T10:00:00") },
      { accountId: "a1", createdAt: at("2026-10-19T23:59:59") },
      { accountId: "a1", createdAt: at("2026-10-21T00:00:00") }
    );
    world.forumPosts.push(
      { authorUserId: "u1", createdAt: at("2026-10-20T01:00:00") },
      { authorUserId: "u1", createdAt: at("2026-10-20T23:59:59") }
    );
    await settleDividendDay(db, D);
    expect(rowsFor("u1")[0]?.amount).toBe(6); // 3 posts x 2
    expect(db.thinkpagesPost.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isAutoGenerated: false, postType: { not: "repost" } }),
      })
    );
    expect(db.forumPost.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ hidden: false }) })
    );
  });

  it("pays card activity: packs opened, trades for both sides, listings sold", async () => {
    vault("u1");
    vault("u2");
    world.packs.push({ userId: "u1", openedAt: at("2026-10-20T12:00:00") });
    world.trades.push({
      initiatorId: "u1",
      recipientId: "u2",
      respondedAt: at("2026-10-20T13:00:00"),
    });
    world.sales.push({ vault: { userId: "u1" }, createdAt: at("2026-10-20T14:00:00") });
    await settleDividendDay(db, D);
    expect(rowsFor("u1")[0]?.amount).toBe(10); // 2 + 5 + 3
    expect(rowsFor("u2")[0]?.amount).toBe(5);
    expect(db.vaultTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "EARN_CARDS",
          source: { in: ["card_sale_auction", "card_sale_buyout"] },
        }),
      })
    );
    expect(db.tradeOffer.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACCEPTED" }) })
    );
  });

  it("gives a wiki line only to editors with a verified linked account", async () => {
    vault("u1");
    vault("u2");
    jest.mocked(scoreDailyWikiOS).mockResolvedValue({
      candidates: [
        { user: "Linked", finalScore: 500 },
        { user: "Linked", finalScore: 300 },
        { user: "Stranger", finalScore: 9000 },
      ],
    } as never);
    jest
      .mocked(resolveLorewardUser)
      .mockImplementation(async (_db, name) => (name === "Linked" ? "u1" : null));
    await settleDividendDay(db, D);
    expect(scoreDailyWikiOS).toHaveBeenCalledWith(D, undefined, { enrichAll: true });
    expect(rowsFor("u1")[0]?.amount).toBe(10); // 800 / 80
    expect(rowsFor("u2")).toEqual([]);
  });

  it("scales by the effective streak and the owned upgrades", async () => {
    vault("fresh", 8, at("2026-10-19T00:00:00")); // logged in the day before: streak holds
    vault("lapsed", 8, at("2026-10-17T00:00:00")); // streak broken before the day
    vault("never", 8, null);
    for (const id of ["fresh", "lapsed", "never"])
      world.packs.push({ userId: id, openedAt: at("2026-10-20T01:00:00") });
    for (const id of ["fresh", "lapsed", "never"])
      world.packs.push({ userId: id, openedAt: at("2026-10-20T02:00:00") });
    jest
      .mocked(getYieldBoostMultiplier)
      .mockImplementation(async (id) => (id === "fresh" ? 0.5 : 0));
    await settleDividendDay(db, D);
    // 2 packs = 4 activity; fresh: streak round(4 x 0.05 x 8) = 2 -> 6, boost 3 -> 9
    expect(rowsFor("fresh")[0]?.amount).toBe(9);
    expect(rowsFor("lapsed")[0]?.amount).toBe(4);
    expect(rowsFor("never")[0]?.amount).toBe(4);
  });

  it("counts a failed payout as skipped and keeps going", async () => {
    vault("u1");
    vault("u2");
    deck("u1", 2000);
    deck("u2", 2000);
    jest.mocked(earnCreditsOnce).mockResolvedValueOnce({
      success: false,
      alreadyApplied: false,
      newBalance: 0,
      message: "off",
    });
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await settleDividendDay(db, D)).toEqual({ paid: 1, skipped: 1 });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("rejects a malformed day", async () => {
    await expect(settleDividendDay(db, "20-10-2026")).rejects.toThrow("yyyy-mm-dd");
  });
});

describe("settleMissedDividends", () => {
  // The job settles yesterday (2026-10-20 when it runs at 2026-10-21 00:00). Missed days are the 7 before it.
  const now = at("2026-10-21T00:00:00");

  it("settles each unsettled day from that day's own activity, not today's", async () => {
    vault("u1");
    world.users.push({ id: "u1", clerkUserId: "c1" });
    world.accounts.push({ id: "a1", clerkUserId: "c1" });
    world.posts.push(
      { accountId: "a1", createdAt: at("2026-10-18T10:00:00") }, // the missed day
      { accountId: "a1", createdAt: at("2026-10-20T10:00:00") },
      { accountId: "a1", createdAt: at("2026-10-20T11:00:00") }
    );
    ledger.add(dividendKey("u1", "2026-10-20")); // yesterday is settled
    for (const day of [
      "2026-10-19",
      "2026-10-17",
      "2026-10-16",
      "2026-10-15",
      "2026-10-14",
      "2026-10-13",
    ])
      ledger.add(dividendKey("x", day));
    const { days } = await settleMissedDividends(db, now);
    expect(days).toEqual(["2026-10-18"]);
    expect(rowsFor("u1")).toMatchObject([
      { amount: 2, idempotencyKey: dividendKey("u1", "2026-10-18") },
    ]);
  });

  it("looks back at most 7 days before yesterday, oldest first", async () => {
    expect((await settleMissedDividends(db, now)).days).toEqual([
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
    ]);
  });

  it("settles nothing when every day is already settled", async () => {
    for (let d = 13; d <= 19; d++) ledger.add(dividendKey("x", `2026-10-${d}`));
    expect((await settleMissedDividends(db, now)).days).toEqual([]);
  });
});
