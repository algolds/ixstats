/** @jest-environment node */
/**
 * The Lorewards feeds (recent winners, a user's award history, the Passport's awards) list a weekly by its first day
 * among the dailies, not by its `YYYY-Www` key, which sorts after every `YYYY-MM-DD` of its year as a string.
 */
import { beforeEach, expect, it } from "@jest/globals";

jest.mock("~/server/db", () => ({
  db: { lorewardEntry: { findMany: jest.fn(), count: jest.fn() } },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { lorewardsAwardsRouter } from "~/server/api/routers/lorewards/awards";
import { lorewardsLeaderboardsRouter } from "~/server/api/routers/lorewards/leaderboards";
import { loadLoreAwards } from "~/server/modules/identity/identity.loaders";
import { db } from "~/server/db";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { storedEntry, type StoredEntry } from "~/tests/helpers/loreward-entry-store";

interface FeedArgs {
  where: { AND?: Array<{ type?: string | { not: string } }> };
  orderBy?: { date: "asc" | "desc" };
  take?: number;
  skip?: number;
}

const ROWS: StoredEntry[] = [
  storedEntry({
    id: "w",
    type: "weekly",
    date: "2026-W02",
    dateStart: "2026-01-05",
    winnerUser: "Ada",
  }),
  storedEntry({ id: "d1", date: "2026-10-01", winnerUser: "Ada" }),
  storedEntry({ id: "d2", date: "2026-01-01", runnerUpUser: "Ada", winnerUser: "Bo" }),
];

/** Whether `row` meets the read's type condition (the other conditions select every row here). */
function typeHolds(row: StoredEntry, args: FeedArgs): boolean {
  const condition = args.where.AND?.find((part) => part.type !== undefined)?.type;
  if (condition === undefined) return true;
  return typeof condition === "string" ? row.type === condition : row.type !== condition.not;
}

/** A read as Postgres answers it: the matching rows ordered by their `date` key as a string, then paged. */
function feedRead(args: FeedArgs): StoredEntry[] {
  const skip = args.skip ?? 0;
  return ROWS.filter((row) => typeHolds(row, args))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(skip, args.take === undefined ? undefined : skip + args.take);
}

const ctx = () => createMockRouterContext({ auth: null, user: null }) as never;

beforeEach(() => {
  jest
    .mocked(db.lorewardEntry.findMany)
    .mockImplementation((async (args: FeedArgs) => feedRead(args)) as never);
  jest.mocked(db.lorewardEntry.count).mockResolvedValue(ROWS.length as never);
});

it("recent winners list a weekly by its first day among the dailies", async () => {
  const winners = await createCallerFactory(lorewardsAwardsRouter)(ctx()).getRecentWinners({
    limit: 3,
  });
  expect(winners.map((w) => w.date)).toEqual(["2026-10-01", "2026-W02", "2026-01-01"]);
});

it("a user's award history pages the same order, and its total is the count", async () => {
  const history = await createCallerFactory(lorewardsLeaderboardsRouter)(ctx()).getUserAwardHistory(
    { username: "Ada", limit: 2, offset: 1 }
  );
  expect(history.entries.map((e) => e.date)).toEqual(["2026-W02", "2026-01-01"]);
  expect(history.total).toBe(3);
  expect(history.hasMore).toBe(false);
});

it("the Passport's awards list a weekly by its first day", async () => {
  const awards = await loadLoreAwards("Ada");
  expect(awards.map((a) => a.date)).toEqual(["2026-10-01", "2026-W02", "2026-01-01"]);
});
