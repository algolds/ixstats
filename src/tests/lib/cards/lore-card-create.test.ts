/** @jest-environment node */
// `jest` is the ambient global: the hoisted factories call jest.fn().
/** Cards refresh §5.1 and §5.3: one Lore card per article, in its home realm, with no stats. */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    card: { create: jest.fn(), findFirst: jest.fn() },
    // getCurrentIxCardSeason reads one key; no row means season 1
    systemConfig: { findUnique: async () => null, findMany: async () => [] },
  },
  isDatabaseReadOnly: false,
}));
jest.mock("~/lib/cards/home-realm", () => ({
  articleHomeRealm: jest.fn().mockResolvedValue("eurth"),
}));

import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { wikiLoreCardGenerator } from "~/lib/cards/lore-card-generator";

const candidate = {
  title: "Battle of Kiro",
  description: "d",
  fullExcerpt: "e",
  artwork: "a.png",
  rarity: "RARE" as const,
  wikiSource: "iiwiki",
  wikiArticleTitle: "battle_of_Kiro",
  wikiUrl: "/wiki/x",
  category: "HISTORY" as const,
  qualityScore: 61,
};

describe("createCard", () => {
  it("stores the canonical title and the home realm, and no stats", async () => {
    jest.mocked(db.card.create).mockResolvedValue({ id: "c1" } as never);
    await expect(wikiLoreCardGenerator.createCard(candidate)).resolves.toBe("c1");
    const data = jest.mocked(db.card.create).mock.calls[0]![0].data;
    expect(data).toMatchObject({
      cardType: "LORE",
      realmId: "eurth",
      wikiArticleTitle: "Battle of Kiro",
    });
    expect(data).not.toHaveProperty("stats");
    expect(data.metadata).toMatchObject({ qualityScore: 61 });
    expect(data.metadata).not.toHaveProperty("loreStats");
  });

  it("turns a lost race on the natural key into 'already exists'", async () => {
    jest.mocked(db.card.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
      })
    );
    await expect(wikiLoreCardGenerator.createCard(candidate)).rejects.toThrow(/already exists/);
  });
});
