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
  const dbWith = (link: { userId: string } | null, edit: { authorId: string } | null = null) => {
    const findFirst = jest.fn().mockResolvedValue(link);
    const revision = jest.fn().mockResolvedValue(edit);
    return {
      db: { wikiAccountLink: { findFirst }, wikiRevision: { findFirst: revision } },
      findFirst,
      revision,
    };
  };

  it("returns the user of the verified ixwiki link for the normalized name", async () => {
    const { db, findFirst, revision } = dbWith({ userId: "u1" });
    expect(await resolveLorewardUser(db as never, "Kir_Republic")).toBe("u1");
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        source: "ixwiki",
        verifiedAt: { not: null },
        username: { equals: "Kir Republic", mode: "insensitive" },
      },
      select: { userId: true },
    });
    expect(revision).not.toHaveBeenCalled();
  });

  it("falls back to the WikiOS account whose edits carry the name", async () => {
    const { db, revision } = dbWith(null, { authorId: "u2" });
    expect(await resolveLorewardUser(db as never, "Kir_Republic")).toBe("u2");
    expect(revision).toHaveBeenCalledWith({
      where: { author: { in: ["Kir_Republic", "Kir Republic"] }, authorId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { authorId: true },
    });
  });

  it("returns null with no verified link and no WikiOS edits", async () => {
    expect(await resolveLorewardUser(dbWith(null).db as never, "Nobody")).toBeNull();
  });
});
