/** @jest-environment node */
/** Mine (spec §2.3): every copy the player holds, retired ones too, with filters, search, sort and pages. */
jest.mock("~/lib/cards/copy-value", () => ({ loadCopyValues: jest.fn() }));

import type { z } from "zod";
import { loadCopyValues } from "~/lib/cards/copy-value";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { listMine, MineQuerySchema, type MineEntry } from "~/lib/cards/hub/mine";
import { pendingOffersNaming } from "~/lib/cards/trade/offered-copies";

const IXNAY = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };
let seq = 0;
function entry(
  card: Partial<MineEntry["row"]["cards"]>,
  copy: Partial<MineEntry["row"]> = {},
  value = 10
): MineEntry {
  seq += 1;
  const cardId = card.id ?? `c${seq}`;
  return {
    value,
    row: {
      id: `o${seq}`,
      finish: "STANDARD",
      serialNumber: seq,
      level: 1,
      cardId,
      acquiredAt: new Date(Date.UTC(2026, 9, seq)),
      isLocked: false,
      inscription: null,
      importDiscounted: false,
      ...copy,
      cards: {
        id: cardId,
        title: `Card ${seq}`,
        rarity: "COMMON",
        cardType: "LORE",
        artwork: null,
        isRetired: false,
        isBound: false,
        collectorNumber: seq,
        season: 1,
        nsSeason: null,
        realm: IXNAY,
        category: "HISTORY",
        ...card,
      },
    },
  };
}
const query = (overrides: z.input<typeof MineQuerySchema> = {}) => MineQuerySchema.parse(overrides);
describe("MineQuerySchema", () => {
  it("defaults to the newest 60 copies and bounds the page size", () => {
    expect(query()).toMatchObject({ sort: "acquired", limit: 60 });
    expect(MineQuerySchema.safeParse({ limit: 120 }).success).toBe(true);
    expect(MineQuerySchema.safeParse({ limit: 121 }).success).toBe(false);
    expect(MineQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(MineQuerySchema.safeParse({ cursor: -1 }).success).toBe(false);
    expect(MineQuerySchema.safeParse({ cursor: null }).success).toBe(true);
    expect(MineQuerySchema.safeParse({ rarities: ["MYTHIC"] }).success).toBe(false);
    expect(MineQuerySchema.safeParse({ copyId: "" }).success).toBe(false);
    expect(MineQuerySchema.safeParse({ copyId: "o".repeat(65) }).success).toBe(false);
  });
});

describe("listMine", () => {
  const valued = (ownershipId: string, value: number) => ({
    ownershipId,
    ownerId: "u1",
    cardId: "c",
    cardType: "LORE" as const,
    finish: "STANDARD" as const,
    value,
  });
  beforeEach(() => jest.mocked(loadCopyValues).mockReset());

  it("reads the rows once and values every copy in one shared copy-value load, matched by copy id", async () => {
    const db = createMockPrisma();
    const one = entry({ title: "Alpha" });
    const two = entry({ title: "Beta" });
    db.cardOwnership.findMany.mockResolvedValue([one.row, two.row]);
    jest.mocked(loadCopyValues).mockResolvedValue([valued(two.row.id, 12), valued(one.row.id, 77)]);
    const page = await listMine(db as never, "u1", query({ sort: "title" }));
    expect(db.cardOwnership.findMany).toHaveBeenCalledTimes(1);
    expect(db.cardOwnership.findMany.mock.calls[0]![0]).toMatchObject({
      where: { ownerId: "u1" },
      orderBy: [{ acquiredAt: "desc" }, { id: "asc" }],
      take: 5000,
    });
    expect(db.cardOwnership.findMany.mock.calls[0]![0].select.cards.select).not.toHaveProperty(
      "marketValue"
    );
    expect(jest.mocked(loadCopyValues)).toHaveBeenCalledTimes(1);
    expect(jest.mocked(loadCopyValues)).toHaveBeenCalledWith(db, { ownerIds: ["u1"] });
    expect(page.rows.map((r) => [r.face.title, r.value])).toEqual([
      ["Alpha", 77],
      ["Beta", 12],
    ]);
  });

  it("marks the page's copies a pending trade offer names, from one read of the page alone", async () => {
    const db = createMockPrisma();
    const offered = entry({ title: "Alpha" });
    const asked = entry({ title: "Beta" });
    const free = entry({ title: "Gamma" });
    const offPage = entry({ title: "Omega" });
    db.cardOwnership.findMany.mockResolvedValue([offered.row, asked.row, free.row, offPage.row]);
    db.tradeOffer.findMany.mockResolvedValue([
      { initiatorCardIds: [offered.row.id], recipientCardIds: [] },
      { initiatorCardIds: [], recipientCardIds: [asked.row.id, offPage.row.id] },
    ]);
    jest.mocked(loadCopyValues).mockResolvedValue([]);
    const page = await listMine(db as never, "u1", query({ sort: "title", limit: 3 }));
    expect(page.rows.map((r) => [r.face.title, r.inOffer, r.isLocked])).toEqual([
      ["Alpha", true, false],
      ["Beta", true, false],
      ["Gamma", false, false],
    ]);
    expect(db.tradeOffer.findMany).toHaveBeenCalledTimes(1);
    expect(db.tradeOffer.findMany.mock.calls[0]![0].where).toEqual(
      pendingOffersNaming([offered.row.id, asked.row.id, free.row.id])
    );
  });
  it("values a hidden (retired) copy at 0 but still lists it", async () => {
    const db = createMockPrisma();
    const hidden = entry({ title: "Hidden", isRetired: true });
    db.cardOwnership.findMany.mockResolvedValue([hidden.row]);
    // The shared copy value leaves retired cards out.
    jest.mocked(loadCopyValues).mockResolvedValue([]);
    const page = await listMine(db as never, "u1", query());
    expect(page.rows.map((r) => [r.face.title, r.value])).toEqual([["Hidden", 0]]);
  });
});
