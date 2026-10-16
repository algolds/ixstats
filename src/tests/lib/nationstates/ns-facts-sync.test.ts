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
  ).resolves.toEqual({
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
