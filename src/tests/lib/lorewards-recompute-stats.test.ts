/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// A user's Loreward stats count each contest once: a weekly or monthly stored twice (the state file's key and the OOL
// page's first day) is one win, and twins that name different winners count for neither.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { lorewardEntry: {}, lorewardUserStats: { upsert: jest.fn() } },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { recomputeUserStats } from "~/lib/lorewards/sync";
import { entryStore, storedEntry, type StoredEntry } from "~/tests/helpers/loreward-entry-store";

const mocked = db as unknown as {
  lorewardEntry: ReturnType<typeof entryStore>;
  lorewardUserStats: { upsert: jest.Mock };
};

const weeklyTwins = (oolWinner: string, stateWinner: string): StoredEntry[] => [
  storedEntry({ id: "w-ool", type: "weekly", date: "2026-10-12", winnerUser: oolWinner }),
  storedEntry({
    id: "w-state",
    type: "weekly",
    date: "2026-W42",
    dateStart: "2026-10-12",
    dateEnd: "2026-10-18",
    winnerUser: stateWinner,
    winnerBytes: 900,
  }),
];

function store(rows: StoredEntry[]) {
  Object.assign(mocked.lorewardEntry, entryStore(rows));
}

const computedFor = (username: string) =>
  mocked.lorewardUserStats.upsert.mock.calls.find(
    ([args]: [{ where: { username: string } }]) => args.where.username === username
  )?.[0].update;

beforeEach(() => {
  mocked.lorewardUserStats.upsert.mockReset();
});

describe("recomputeUserStats", () => {
  it("counts a weekly stored twice once, with the state-keyed entry's bytes", async () => {
    store([...weeklyTwins("Urcea", "Urcea"), storedEntry({ id: "d1", winnerUser: "Urcea" })]);
    await recomputeUserStats("Urcea");
    expect(computedFor("Urcea")).toMatchObject({ weeklyWins: 1, dailyWins: 1, totalBytes: 900 });
  });

  it("counts a weekly whose twins name different winners for neither name", async () => {
    store(weeklyTwins("Urcea", "Nasastan"));
    await recomputeUserStats("Urcea");
    await recomputeUserStats("Nasastan");
    expect(computedFor("Urcea")).toMatchObject({ weeklyWins: 0 });
    expect(computedFor("Nasastan")).toMatchObject({ weeklyWins: 0 });
  });

  it("counts single entries as before", async () => {
    store([
      storedEntry({ id: "d1", winnerUser: "Urcea" }),
      storedEntry({ id: "d2", date: "2026-10-17", runnerUpUser: "Urcea" }),
      storedEntry({ id: "m1", type: "monthly", date: "2026-09-01", winnerUser: "Urcea" }),
      storedEntry({ id: "x1", date: "2026-10-18", winnerUser: "Urcea", status: "rejected" }),
    ]);
    await recomputeUserStats("Urcea");
    expect(computedFor("Urcea")).toMatchObject({
      dailyWins: 1,
      dailyRunnerUps: 1,
      weeklyWins: 0,
      monthlyWins: 1,
    });
  });
});
