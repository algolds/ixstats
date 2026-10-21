/** @jest-environment node */
/**
 * The Passport's collection highlight is the holder's display (`displayedCopies`): their pinned public showcase, else
 * their most valuable live copies, as faces that show their art, each marked by the viewer's own copies.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    myVault: { findUnique: jest.fn() },
    cardOwnership: { findMany: jest.fn() },
    cardCollection: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
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

const faceOf = (n: number, uncollected = true) => ({
  cardId: `c${n}`,
  title: `Card ${n}`,
  rarity: "RARE",
  cardType: "LORE",
  realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
  artwork: `/art/c${n}.png`,
  uncollected,
  number: n,
  season: null,
  isRetired: false,
  copy: { ownershipId: `own-${n}`, finish: "FOIL", serialNumber: n, level: 2 },
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

interface OwnershipRead {
  where: { id?: { in: string[] }; cardId?: object };
}
/**
 * The live-copy read (count and categories), the display's read of the top copies' faces, and the viewer's copies of
 * the displayed cards (`held`), in any order.
 */
function ownerships(top: ReturnType<typeof copyRow>[], held: string[] = []) {
  jest.mocked(db.cardOwnership.findMany).mockImplementation((async (args: OwnershipRead) => {
    if (args.where.cardId) return held.map((cardId) => ({ cardId }));
    return args.where.id
      ? top.filter((row) => args.where.id?.in.includes(row.id))
      : [{ cards: { category: "MILITARY" } }];
  }) as never);
}
const heldRead = () =>
  jest
    .mocked(db.cardOwnership.findMany)
    .mock.calls.map(([args]) => args)
    .find((args) => args?.where?.cardId);

const faceRead = () =>
  jest
    .mocked(db.cardOwnership.findMany)
    .mock.calls.map(([args]) => args)
    .find((args) => args?.where?.id);

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
  it("shows the holder's pinned public showcase, as faces with their art", async () => {
    jest.mocked(db.cardCollection.findFirst).mockResolvedValue({
      id: "s1",
      name: "Best of Ixnay",
      items: [{ cardOwnership: copyRow(3) }],
    } as never);

    const vault = await resolvePassportVault("u1", null);
    expect(vault.topCards).toEqual([faceOf(3)]);
    expect(jest.mocked(db.cardCollection.findFirst).mock.calls[0]![0]).toMatchObject({
      where: { userId: "u1", isPublic: true, pinnedAt: { not: null } },
    });
  });

  it("falls back to the six most valuable live copies by copy value, one per card, best first", async () => {
    const vault = await resolvePassportVault("u1", null);
    expect(vault.topCards).toEqual([faceOf(2), faceOf(1)]);
    expect(jest.mocked(topCopiesByValue).mock.calls).toEqual([[db, "u1", 6]]);
    expect(faceRead()).toMatchObject({
      where: { id: { in: ["own-2", "own-1"] }, ownerId: "u1", cards: { isRetired: false } },
    });
  });

  it("marks each face by the viewer's own copies, not the holder's", async () => {
    jest.mocked(db.user.findUnique).mockResolvedValue({ id: "u2" } as never);
    ownerships([copyRow(1), copyRow(2)], ["c1"]);
    const vault = await resolvePassportVault("u1", "clerk_u2");
    expect(vault.topCards).toEqual([faceOf(2, true), faceOf(1, false)]);
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: "clerk_u2" },
      select: { id: true },
    });
    expect(heldRead()?.where).toEqual({ ownerId: "u2", cardId: { in: ["c2", "c1"] } });
  });

  it("shows the holder their own display as collected", async () => {
    jest.mocked(db.user.findUnique).mockResolvedValue({ id: "u1" } as never);
    ownerships([copyRow(1), copyRow(2)], ["c1", "c2"]);
    const vault = await resolvePassportVault("u1", "clerk_u1");
    expect(vault.topCards).toEqual([faceOf(2, false), faceOf(1, false)]);
  });

  it("marks every face for a signed-out visitor, asking for no viewer and none of their copies", async () => {
    ownerships([copyRow(1), copyRow(2)], ["c1", "c2"]);
    const vault = await resolvePassportVault("u1", null);
    expect(vault.topCards).toEqual([faceOf(2), faceOf(1)]);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(heldRead()).toBeUndefined();
  });

  it("values the deck by the shared copy value and counts the live copies", async () => {
    const vault = await resolvePassportVault("u1", null);
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

  it("leaves out a top copy that is gone by the time its face is read", async () => {
    jest.mocked(topCopiesByValue).mockResolvedValue(ranked(3, 1));
    const vault = await resolvePassportVault("u1", null);
    expect(vault.topCards).toEqual([faceOf(1)]);
  });

  it("has no highlight without an account", async () => {
    expect((await resolvePassportVault(null, "clerk_u2")).topCards).toEqual([]);
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
    expect(deckValueOf).not.toHaveBeenCalled();
  });
});
