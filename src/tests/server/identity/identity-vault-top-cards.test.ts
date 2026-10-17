/** @jest-environment node */
/**
 * The Passport's collection highlight is the holder's display (`displayedCopies`): their pinned public showcase, else
 * their most valuable live copies, as faces that show their art.
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

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
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

const faceOf = (n: number) => ({
  cardId: `c${n}`,
  title: `Card ${n}`,
  rarity: "RARE",
  cardType: "LORE",
  realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
  artwork: `/art/c${n}.png`,
  silhouette: false,
  number: n,
  season: null,
  isRetired: false,
  copy: { ownershipId: `own-${n}`, finish: "FOIL", serialNumber: n, level: 2 },
});

/** The deck-value read (every live copy) and the display's top-copies read (one per card). */
function ownerships(top: ReturnType<typeof copyRow>[]) {
  jest
    .mocked(db.cardOwnership.findMany)
    .mockImplementation((async (args: { distinct?: string[] }) =>
      args.distinct ? top : [{ cards: { marketValue: 40, category: "MILITARY" } }]) as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(db.myVault.findUnique).mockResolvedValue(null);
  jest.mocked(db.cardCollection.findFirst).mockResolvedValue(null);
  ownerships([copyRow(1), copyRow(2)]);
});

describe("resolvePassportVault topCards", () => {
  it("shows the holder's pinned public showcase, as faces with their art", async () => {
    jest.mocked(db.cardCollection.findFirst).mockResolvedValue({
      id: "s1",
      name: "Best of Ixnay",
      items: [{ cardOwnership: copyRow(3) }],
    } as never);

    const vault = await resolvePassportVault("u1");
    expect(vault.topCards).toEqual([faceOf(3)]);
    expect(jest.mocked(db.cardCollection.findFirst).mock.calls[0]![0]).toMatchObject({
      where: { userId: "u1", isPublic: true, pinnedAt: { not: null } },
    });
  });

  it("falls back to the six most valuable live copies, one per card", async () => {
    const vault = await resolvePassportVault("u1");
    expect(vault.topCards).toEqual([faceOf(1), faceOf(2)]);
    const topRead = jest
      .mocked(db.cardOwnership.findMany)
      .mock.calls.map(([args]) => args)
      .find((args) => args?.distinct);
    expect(topRead).toMatchObject({
      where: { ownerId: "u1", cards: { isRetired: false } },
      distinct: ["cardId"],
      take: 6,
    });
    expect(vault).toMatchObject({ totalCards: 1, deckValue: 40, xpPerLevel: 500 });
  });

  it("has no highlight without an account", async () => {
    expect((await resolvePassportVault(null)).topCards).toEqual([]);
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });
});
