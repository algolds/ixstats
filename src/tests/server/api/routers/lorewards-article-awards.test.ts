/** @jest-environment node */
/** An article's Loreward award names the winner's trophy card once it is minted. */
import { beforeEach, describe, expect, it } from "@jest/globals";

jest.mock("~/lib/lorewards", () => ({ syncCurrentWinners: jest.fn() }));
jest.mock("~/server/db", () => ({
  db: {
    lorewardEntry: { findMany: jest.fn() },
    wikiArticleAward: { findMany: jest.fn() },
    card: { findMany: jest.fn() },
  },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { lorewardsAwardsRouter } from "~/server/api/routers/lorewards/awards";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";

const caller = createCallerFactory(lorewardsAwardsRouter)(
  createMockRouterContext({ auth: null, user: null }) as never
);

const entry = (id: string, date: string) => ({
  id,
  date,
  type: "daily",
  winnerUser: "Ada",
  winnerPage: "Seastead Law",
  metadata: null,
});

beforeEach(() => {
  jest
    .mocked(db.lorewardEntry.findMany)
    .mockResolvedValue([entry("e2", "2026-10-20"), entry("e1", "2026-10-10")] as never);
  jest.mocked(db.wikiArticleAward.findMany).mockResolvedValue([
    {
      id: "w1",
      category: "FEATURED",
      name: "Featured article",
      description: null,
      recipientUsers: [],
      awardedAt: new Date("2026-09-01"),
      metadata: null,
    },
  ] as never);
  jest
    .mocked(db.card.findMany)
    .mockResolvedValue([{ id: "card-e1", lorewardEntryId: "e1" }] as never);
});

describe("lorewards.getArticleAwardsAndAchievements", () => {
  it("carries the winner's trophy card id on a Loreward award once it is minted", async () => {
    const { awards } = await caller.getArticleAwardsAndAchievements({ title: "Seastead Law" });
    const byId = new Map(awards.map((a) => [a.id, a.trophyCardId]));

    expect(byId.get("e1")).toBe("card-e1");
    expect(byId.get("e2")).toBeNull();
    expect(byId.get("w1")).toBeNull();
  });

  it("looks only for the winner's card of this article's entries", async () => {
    await caller.getArticleAwardsAndAchievements({ title: "Seastead Law" });
    expect(db.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lorewardEntryId: { in: ["e2", "e1"] }, lorewardEdition: "winner" },
      })
    );
  });
});
