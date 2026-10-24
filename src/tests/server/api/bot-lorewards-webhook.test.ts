/** @jest-environment node */
/**
 * The Discord bot's Lorewards webhook (`/api/bot/lorewards/sync`): only the bot key gets in (roadmap M0 item 18, PL-20),
 * an admin override keeps its places, a weekly is keyed by its ISO week (409 when the key holds another week), and an
 * approved result settles its contest (design decisions 16 and 17).
 */
jest.mock("~/lib/lorewards/sync", () => ({ recomputeUserStats: jest.fn() }));
jest.mock("~/lib/lorewards/settle", () => ({
  settleLorewardPlaces: jest
    .fn()
    .mockResolvedValue({ minted: 1, granted: 1, paid: 1, refused: 0, payoutsEnabled: true }),
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({ invalidateCache: jest.fn() }));

import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { settleLorewardPlaces } from "~/lib/lorewards/settle";
import { entryStore, storedEntry, type StoredEntry } from "~/tests/helpers/loreward-entry-store";

const KEY = "bot-s3cret";
const SETTLED = { minted: 1, granted: 1, paid: 1, refused: 0, payoutsEnabled: true };
const { db } = jest.requireMock<{ db: { lorewardEntry?: object } }>("~/server/db");

let POST: (req: Request) => Promise<Response>;
beforeAll(async () => {
  process.env.BOT_API_KEY = KEY;
  ({ POST } = await import("~/app/api/bot/lorewards/sync/route"));
});

beforeEach(() => {
  jest.mocked(settleLorewardPlaces).mockClear().mockResolvedValue(SETTLED);
});

/** The bot posts `body` with the right key onto the `rows` stored. */
async function post(rows: StoredEntry[], body: object) {
  const store = entryStore(rows);
  db.lorewardEntry = store;
  const res = await POST(
    new Request("http://localhost/api/bot/lorewards/sync", {
      method: "POST",
      headers: { "x-bot-api-key": KEY },
      body: JSON.stringify(body),
    })
  );
  return { res, store };
}

describe("/api/bot/lorewards/sync", () => {
  const call = (headers: Record<string, string>) =>
    POST(new Request("http://localhost/api/bot/lorewards/sync", { method: "POST", headers }));

  it("rejects a wrong bot key", async () => {
    expect((await call({ authorization: "Bearer bot-s3creT" })).status).toBe(401);
    expect((await call({ "x-bot-api-key": "nope" })).status).toBe(401);
  });
});

describe("/api/bot/lorewards/sync over an admin override", () => {
  const OVERRIDDEN = new Date("2026-10-17T12:00:00.000Z");

  /** The bot pushes the daily of 16 October, naming Amy and Bee, onto the `rows` stored. */
  async function push(rows: StoredEntry[]) {
    const { res, store } = await post(rows, {
      date: "2026-10-16",
      type: "daily",
      winnerUser: "Amy",
      winnerPage: "Amy's page",
      winnerScore: 90,
      runnerUpUser: "Bee",
      metadata: "[]",
    });
    expect(res.status).toBe(200);
    return { rows, store };
  }

  /** The daily of 16 October as an override left it: Cy and Dee, withheld, marked. */
  const overridden = storedEntry({
    id: "d1",
    winnerUser: "Cy",
    winnerPage: "Cy's page",
    runnerUpUser: "Dee",
    status: "withheld",
    overriddenAt: OVERRIDDEN,
  });

  it("keeps the places and the status of an entry an override wrote: only its metadata and syncedAt update", async () => {
    const {
      rows: [row],
    } = await push([{ ...overridden }]);

    expect(row).toMatchObject({
      winnerUser: "Cy",
      winnerPage: "Cy's page",
      runnerUpUser: "Dee",
      status: "withheld",
      overriddenAt: OVERRIDDEN,
      metadata: "[]",
      syncedAt: expect.any(Date),
    });
  });

  it("checks for the override in the write itself, so one that commits meanwhile is never written over", async () => {
    const { store } = await push([{ ...overridden }]);

    expect(store.updateMany).toHaveBeenCalledWith({
      where: { date: "2026-10-16", type: "daily", overriddenAt: null },
      data: expect.objectContaining({ winnerUser: "Amy", status: "approved" }),
    });
    expect(store.upsert.mock.calls[0]![0].update).toEqual({
      metadata: "[]",
      syncedAt: expect.any(Date),
    });
  });

  it("does not settle an entry an override withheld, whatever status the bot sends", async () => {
    await push([{ ...overridden }]);

    expect(settleLorewardPlaces).not.toHaveBeenCalled();
  });
});

describe("/api/bot/lorewards/sync settles its contest", () => {
  const daily = { date: "2026-10-16", type: "daily", winnerUser: "Amy", runnerUpUser: "Bee" };

  it("settles the contest of an approved result", async () => {
    const { res } = await post([], daily);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(settleLorewardPlaces).toHaveBeenCalledWith({ entryIds: [body.entry.id] });
    expect(body.settled).toEqual(SETTLED);
  });

  it("does not settle a result that is not approved", async () => {
    const { res } = await post([], { ...daily, status: "pending" });

    expect(res.status).toBe(200);
    expect(settleLorewardPlaces).not.toHaveBeenCalled();
    expect((await res.json()).settled).toBeNull();
  });

  it("answers 200 when settling fails: the result stands and the next sync pays", async () => {
    jest.mocked(settleLorewardPlaces).mockRejectedValue(new Error("ledger down"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const rows: StoredEntry[] = [];

    const { res } = await post(rows, daily);

    expect(res.status).toBe(200);
    expect((await res.json()).settled).toBeNull();
    expect(error).toHaveBeenCalled();
    expect(rows[0]).toMatchObject({ winnerUser: "Amy", runnerUpUser: "Bee" });
    error.mockRestore();
  });
});

describe("/api/bot/lorewards/sync weekly keys", () => {
  /** The weekly of 23 March 2026 stored under its ISO week, won by Rumahoki. */
  const week13 = () =>
    storedEntry({
      id: "w13",
      date: "2026-W13",
      type: "weekly",
      dateStart: "2026-03-23",
      dateEnd: "2026-03-29",
      winnerUser: "Rumahoki",
    });

  it("stores a new weekly under its ISO week, with its range", async () => {
    const rows: StoredEntry[] = [];
    const { res } = await post(rows, { date: "2026-08-17", type: "weekly", winnerUser: "Urcea" });

    expect(res.status).toBe(200);
    expect(rows[0]).toMatchObject({
      date: "2026-W34",
      type: "weekly",
      dateStart: "2026-08-17",
      dateEnd: "2026-08-23",
      winnerUser: "Urcea",
    });
  });

  it("answers 400 for a weekly date it cannot read", async () => {
    const { res, store } = await post([], { date: "34", type: "weekly", winnerUser: "Urcea" });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(
      "A weekly date is an ISO week (2026-W34) or the week's first day (2026-08-17)."
    );
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it("answers 409 and writes nothing when the week's key holds another contest", async () => {
    const rows = [week13()];

    const { res, store } = await post(rows, {
      date: "2026-03-22",
      type: "weekly",
      winnerUser: "Urcea",
    });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      "Week 2026-W13 is stored as the week from 2026-03-23. Settle it with an admin override."
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.winnerUser).toBe("Rumahoki");
    expect(store.updateMany).not.toHaveBeenCalled();
    expect(store.upsert).not.toHaveBeenCalled();
    expect(settleLorewardPlaces).not.toHaveBeenCalled();
  });

  it("writes a weekly over the stored row of the same week and keeps its range", async () => {
    const rows = [week13()];

    const { res } = await post(rows, { date: "2026-W13", type: "weekly", winnerUser: "Urcea" });

    expect(res.status).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ winnerUser: "Urcea", dateStart: "2026-03-23" });
    expect(settleLorewardPlaces).toHaveBeenCalledWith({ entryIds: ["w13"] });
  });
});
