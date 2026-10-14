/** @jest-environment node */
import { describe, it, expect } from "@jest/globals";
import { LOREWARD_PAYOUTS, lorewardBonusKey } from "~/lib/vault/vault-bonus";
import { resolveLorewardUser } from "~/lib/lorewards/resolve-user";

describe("the Loreward payout table", () => {
  it("pays winners more than runner-ups, by contest", () => {
    expect(LOREWARD_PAYOUTS).toEqual({
      daily: { winner: 500, "runner-up": 150 },
      weekly: { winner: 1500, "runner-up": 400 },
      monthly: { winner: 4000, "runner-up": 1000 },
    });
  });

  it("keeps the legacy winner key and gives the runner-up its own", () => {
    expect(lorewardBonusKey("e1", "winner")).toBe("bonus:loreward:e1");
    expect(lorewardBonusKey("e1", "runner-up")).toBe("bonus:loreward:e1:runner-up");
  });
});

describe("resolveLorewardUser", () => {
  const dbWith = (link: { userId: string } | null) => {
    const findFirst = jest.fn().mockResolvedValue(link);
    return { db: { wikiAccountLink: { findFirst } }, findFirst };
  };

  it("returns the user of the verified ixwiki link for the normalized name", async () => {
    const { db, findFirst } = dbWith({ userId: "u1" });
    expect(await resolveLorewardUser(db as never, "Kir_Republic")).toBe("u1");
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        source: "ixwiki",
        verifiedAt: { not: null },
        username: { equals: "Kir Republic", mode: "insensitive" },
      },
      select: { userId: true },
    });
  });

  it("returns null without a verified link", async () => {
    expect(await resolveLorewardUser(dbWith(null).db as never, "Nobody")).toBeNull();
  });
});
