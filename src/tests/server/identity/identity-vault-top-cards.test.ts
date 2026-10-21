/** @jest-environment node */
/**
 * The Passport's collection highlight is the holder's display (`displayedCopies`): their pinned public showcase, else
 * their most valuable live copies, as faces that show their art in full colour to every visitor.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    myVault: { findUnique: jest.fn() },
    cardOwnership: { findMany: jest.fn() },
    cardCollection: { findFirst: jest.fn() },
  },
}));
jest.mock("~/lib/vault/vault-perks", () => ({
  VAULT_CONFIG_DEFAULTS: { xpPerLevel: 1000 },
  getVaultConfig: jest.fn(async () => ({ xpPerLevel: 500 })),
}));
jest.mock("~/lib/cards/copy-value", () => ({
  deckValueOf: jest.fn(),
  topCopiesByValue: jest.fn(),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { deckValueOf, topCopiesByValue } from "~/lib/cards/copy-value";
import { resolvePassportVault } from "~/server/modules/identity/identity.vault";

const IXNAY = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };

/** A copy with the fields its face reads. */
const copyRow = (n: number) => ({
  id: `own-${n}`,
  finish: "FOIL",
  serialNumber: n,
  level: 2,
  cards: {
    id: `c${n}`,
    title: `Card ${n}`,
    rarity: "RARE",
    cardType: "LORE",
    artwork: `/art/c${n}.png`,
    isRetired: false,
    collectorNumber: n,
    season: null,
    nsSeason: null,
    realm: IXNAY,
  },
});
/** The top copies by value, best first, as the shared copy value ranks them. */
const ranked = (...ns: number[]) =>
  ns.map((n) => ({
    ownershipId: `own-${n}`,
    ownerId: "u1",
    cardId: `c${n}`,
    cardType: "LORE" as const,
    finish: "FOIL" as const,
    value: 100 - n,
  }));

/** The live-copy read (count and categories) and the display's read of the top copies' faces, in any order. */
function ownerships(top: ReturnType<typeof copyRow>[]) {
  jest
    .mocked(db.cardOwnership.findMany)
    .mockImplementation((async (args: { where: { id?: { in: string[] } } }) =>
      args.where.id
        ? top.filter((row) => args.where.id?.in.includes(row.id))
        : [{ cards: { category: "MILITARY" } }]) as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(db.myVault.findUnique).mockResolvedValue(null);
  jest.mocked(db.cardCollection.findFirst).mockResolvedValue(null);
  // Different figures, so showing the trophy-free figure instead of the display total fails.
  jest.mocked(deckValueOf).mockResolvedValue({ total: 290, exTrophy: 40 });
  jest.mocked(topCopiesByValue).mockResolvedValue(ranked(2, 1));
  ownerships([copyRow(1), copyRow(2)]);
});

describe("resolvePassportVault topCards", () => {
  it("shows the display in full colour to every visitor, reading none of the visitor's copies", async () => {
    const vault = await resolvePassportVault("u1");
    expect(vault.topCards.map((face) => face.uncollected)).toEqual([false, false]);
    const reads = jest.mocked(db.cardOwnership.findMany).mock.calls.map(([args]) => args?.where);
    expect(reads.some((where) => where && "cardId" in where)).toBe(false);
  });

  it("values the deck by the shared copy value and counts the live copies", async () => {
    const vault = await resolvePassportVault("u1");
    expect(vault).toMatchObject({ totalCards: 1, deckValue: 290, xpPerLevel: 500 });
    expect(jest.mocked(deckValueOf).mock.calls).toEqual([[db, "u1"]]);
    const liveRead = jest
      .mocked(db.cardOwnership.findMany)
      .mock.calls.map(([args]) => args)
      .find((args) => !args?.where?.id);
    expect(liveRead).toEqual({
      where: { ownerId: "u1", cards: { isRetired: false } },
      select: { cards: { select: { category: true } } },
    });
  });
});
