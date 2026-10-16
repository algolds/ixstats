/** @jest-environment node */
/** Cards refresh §2.1: the region sync writes NS cards with their home realm and facts, never stats. */
import { upsertNSCardDefinition } from "~/lib/nationstates/sync-processor";
import { CARD_VALUATION_DEFAULTS } from "~/lib/cards/valuation";

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

it("creates an NS card in the nationstates realm with only its facts", async () => {
  const db = {
    card: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
  };
  await expect(
    upsertNSCardDefinition(db as never, nsCard, "region:abydos", CARD_VALUATION_DEFAULTS)
  ).resolves.toMatchObject({
    created: true,
    updated: false,
  });
  const data = db.card.create.mock.calls[0]![0].data;
  expect(data).toMatchObject({
    cardType: "NS",
    realmId: "nationstates",
    rarity: "ULTRA_RARE",
    nsCardId: 7,
    nsSeason: 3,
  });
  expect(data.metadata.nsData).toEqual({
    id: "7",
    name: "Heku",
    flag: "f.png",
    region: "Abydos",
    category: "Empire",
    season: "3",
    market_value: "0.40",
  });
  expect(data).not.toHaveProperty("stats");
  expect(data).not.toHaveProperty("artworkVariants");
});

it("refreshes an existing card's value and its region and bank value facts", async () => {
  const existing = {
    id: "card_ns_7_s3",
    rarity: "COMMON",
    isRetired: false,
    marketValue: 1,
    metadata: { importedFrom: "x", nsData: { name: "Heku", region: "Old", market_value: "0.01" } },
  };
  const db = {
    card: {
      findFirst: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  await upsertNSCardDefinition(
    db as never,
    { ...nsCard, rarity: "COMMON", market_value: "90" },
    "x",
    CARD_VALUATION_DEFAULTS
  );
  expect(db.card.update.mock.calls[0]![0].data.metadata).toEqual({
    importedFrom: "x",
    nsData: { name: "Heku", region: "Abydos", market_value: "90" },
  });
});

it("leaves a taken-down card's value and facts alone, and returns it", async () => {
  const existing = {
    id: "card_ns_7_s3",
    rarity: "COMMON",
    isRetired: true,
    marketValue: 1,
    metadata: null,
  };
  const db = { card: { findFirst: jest.fn().mockResolvedValue(existing), update: jest.fn() } };

  await expect(
    upsertNSCardDefinition(
      db as never,
      { ...nsCard, market_value: "90" },
      "x",
      CARD_VALUATION_DEFAULTS
    )
  ).resolves.toEqual({ card: existing, created: false, updated: false });
  expect(db.card.update).not.toHaveBeenCalled();
});

it("returns null for a card without a valid id or a name, and writes nothing", async () => {
  const db = { card: { findFirst: jest.fn(), create: jest.fn() } };

  for (const bad of [
    { ...nsCard, id: "x" },
    { ...nsCard, season: "" },
    { ...nsCard, name: undefined },
  ]) {
    await expect(
      upsertNSCardDefinition(db as never, bad, "x", CARD_VALUATION_DEFAULTS)
    ).resolves.toBeNull();
  }
  expect(db.card.findFirst).not.toHaveBeenCalled();
  expect(db.card.create).not.toHaveBeenCalled();
});

it("returns the card it created, which has no wiki article title", async () => {
  const created = { id: "card_ns_7_s3" };
  const db = {
    card: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
    },
  };

  const result = await upsertNSCardDefinition(db as never, nsCard, "x", CARD_VALUATION_DEFAULTS);

  expect(result?.card).toBe(created);
  expect(db.card.create.mock.calls[0]![0].data).not.toHaveProperty("wikiArticleTitle");
});
