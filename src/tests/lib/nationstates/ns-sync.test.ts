/** @jest-environment node */
/**
 * The NationStates card pipeline never turns a bad read into lost cards or a rewritten price. The client raises on a
 * refusal (429) or an outage (503), so a run never reads either as an empty deck; only a nation NationStates does not
 * have (404) is no deck. The CTE filter refuses an active-nations dump too small to be whole (no card read or
 * changed), and otherwise tags each card by its nation's NS name, a page at a time, keeping the rest of its metadata.
 * The region sync values a new card by the formula, refreshes an existing card's facts without ever writing its
 * value, and leaves a taken-down card alone. Folds ns-cte-filter, ns-facts-sync and stability-guardrails.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { CARD_VALUATION_DEFAULTS } from "~/lib/cards/valuation";
import { nsApiClient } from "~/lib/nationstates/api-client";
import { processCTENationFilter, upsertNSCardDefinition } from "~/lib/nationstates/sync-processor";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const nsCard = {
  id: "7",
  season: "3",
  rarity: "ultra-rare",
  name: "Heku",
  region: "Abydos",
  category: "Empire",
  govt: "Centrist",
  badge: "x",
  market_value: "0.40",
  flag: "f.png",
};

/** An active-nations set of `size` nations, holding `named` among them. */
const nations = (size: number, ...named: string[]) =>
  new Set([...named, ...Array.from({ length: size - named.length }, (_, i) => `nation ${i}`)]);
const lastRun = (activeNations: number) => ({ metadata: { activeNations, activeCount: 9 } });

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it.each([
  [429, "Too Many Requests", "RATE_LIMIT"],
  [503, "Service Unavailable", "SERVER_ERROR"],
  [404, "Not Found", null],
])("the client's fetchDeck on HTTP %d (%s) raises %s", async (status, statusText, error) => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status, statusText } as Response);
  if (error) await expect(nsApiClient.fetchDeck("testnation")).rejects.toThrow(error);
  else expect(await nsApiClient.fetchDeck("unknown_nation_xyz")).toBeNull();
});

describe("the CTE filter", () => {
  it.each([
    ["under 1,000 nations with no run before it", 999, null],
    ["under half the last run's nations", 99_999, 200_000],
  ])("refuses a dump %s, and reads and changes no card", async (_case, size, previous) => {
    jest.spyOn(nsApiClient, "fetchActiveNationsDump").mockResolvedValue(nations(size));
    const db = createMockPrisma();
    db.syncLog.findFirst.mockResolvedValue(previous === null ? null : lastRun(previous));

    await expect(processCTENationFilter(db as never, "cte_log")).rejects.toThrow(
      /too few to be whole.*No card was changed/
    );
    expect(db.card.findMany).not.toHaveBeenCalled();
    expect(db.card.update).not.toHaveBeenCalled();
    expect(db.syncLog.update).not.toHaveBeenCalled();
  });

  it("tags each card by its nation's NS name, a page at a time, keeping the rest of its metadata", async () => {
    jest
      .spyOn(nsApiClient, "fetchActiveNationsDump")
      .mockResolvedValue(nations(100_000, "heku of ix", "elm"));
    const db = createMockPrisma();
    db.syncLog.findFirst.mockResolvedValue(lastRun(200_000));
    db.card.findMany
      .mockResolvedValueOnce([
        // The card's title differs from its nation's name; the name decides.
        {
          id: "card_a",
          title: "Old title",
          metadata: { importedFrom: "x", nsData: { name: "Heku of Ix" } },
        },
        { id: "card_b", title: "Gone", metadata: null },
      ])
      .mockResolvedValueOnce([{ id: "card_c", title: " Elm ", metadata: "legacy" }])
      .mockResolvedValueOnce([]);

    await expect(processCTENationFilter(db as never, "cte_log")).resolves.toEqual({
      totalProcessed: 3,
      cteCount: 1,
      activeCount: 2,
    });
    expect(db.card.findMany.mock.calls[1]![0].where).toEqual({
      cardType: "NS",
      id: { gt: "card_b" },
    });
    const writes = new Map(
      db.card.update.mock.calls.map(([call]) => [call.where.id, call.data.metadata])
    );
    expect(writes.get("card_a")).toEqual({
      importedFrom: "x",
      nsData: { name: "Heku of Ix" },
      isCTE: false,
      cteCheckedAt: expect.any(String),
    });
    expect(writes.get("card_b")).toEqual({ isCTE: true, cteCheckedAt: expect.any(String) });
    expect(writes.get("card_c")).toEqual({ isCTE: false, cteCheckedAt: expect.any(String) });
    // The next run's size check reads how many nations this dump held
    expect(db.syncLog.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ activeNations: 100_000 }),
        }),
      })
    );
  });
});

describe("the region sync", () => {
  const db = (existing: object | null) => ({
    card: {
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ id: "card_ns_7_s3" }),
    },
  });

  it("values a new card by the formula, with its bank value term while nothing has sold", async () => {
    const valueOf = async (card: typeof nsCard) => {
      const d = db(null);
      await upsertNSCardDefinition(d as never, card, "x", CARD_VALUATION_DEFAULTS, null);
      return d.card.create.mock.calls[0]![0].data.marketValue;
    };
    // The Ultra rare floor, 300; then 500 × the 1.5 premium over the Common floor of 10
    await expect(valueOf(nsCard)).resolves.toBe(300);
    await expect(valueOf({ ...nsCard, rarity: "common", market_value: "500" })).resolves.toBe(750);
    await expect(valueOf({ ...nsCard, rarity: "common", market_value: "n/a" })).resolves.toBe(10);
  });

  it("refreshes an existing card's region and bank value facts, and never writes its value", async () => {
    const d = db({
      id: "card_ns_7_s3",
      rarity: "COMMON",
      isRetired: false,
      marketValue: 1,
      metadata: {
        importedFrom: "x",
        nsData: { name: "Heku", region: "Old", market_value: "0.01" },
      },
    });
    await upsertNSCardDefinition(
      d as never,
      { ...nsCard, rarity: "COMMON", market_value: "90" },
      "x",
      CARD_VALUATION_DEFAULTS,
      null
    );
    expect(d.card.update.mock.calls[0]![0]).toEqual({
      where: { id: "card_ns_7_s3" },
      data: {
        metadata: {
          importedFrom: "x",
          nsData: { name: "Heku", region: "Abydos", market_value: "90" },
        },
      },
    });
  });

  it("leaves a taken-down card's value and facts alone", async () => {
    const existing = {
      id: "card_ns_7_s3",
      rarity: "COMMON",
      isRetired: true,
      marketValue: 1,
      metadata: null,
    };
    const d = db(existing);
    await expect(
      upsertNSCardDefinition(
        d as never,
        { ...nsCard, market_value: "90" },
        "x",
        CARD_VALUATION_DEFAULTS,
        null
      )
    ).resolves.toEqual({ card: existing, created: false, updated: false });
    expect(d.card.update).not.toHaveBeenCalled();
  });
});
