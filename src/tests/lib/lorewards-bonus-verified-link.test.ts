/** @jest-environment node */
/**
 * The 2,500 IxC Loreward bonus is paid to the owner of a VERIFIED ixwiki WikiAccountLink, never to
 * whoever holds the legacy User.wikiUsername (which could be set without proof).
 */
jest.mock("~/server/db", () => {
  const db = {
    lorewardEntry: { findMany: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
  };
  return { __esModule: true, db };
});

jest.mock("~/lib/vault/vault-bonus", () => ({
  getBonusConfig: jest.fn().mockResolvedValue({ enabled: true, loreward: 2500 }),
  grantBonus: jest.fn().mockResolvedValue({ granted: true }),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { grantBonus } from "~/lib/vault/vault-bonus";
import { grantLorewardBonuses } from "~/lib/lorewards/sync";

const mocked = db as unknown as {
  lorewardEntry: { findMany: jest.Mock };
  wikiAccountLink: { findFirst: jest.Mock };
  user: { findFirst: jest.Mock };
};

describe("grantLorewardBonuses", () => {
  beforeEach(() => {
    (grantBonus as jest.Mock).mockClear();
    mocked.user.findFirst.mockReset();
    mocked.wikiAccountLink.findFirst.mockReset();
    mocked.lorewardEntry.findMany
      .mockReset()
      .mockResolvedValue([
        { id: "e1", winnerUser: "Kir_Republic", date: "2026-09-01", type: "daily" },
      ]);
  });

  it("pays the owner of the verified ixwiki link, matching the normalized name", async () => {
    mocked.wikiAccountLink.findFirst.mockResolvedValue({ userId: "u_verified" });
    expect(await grantLorewardBonuses()).toBe(1);
    expect(mocked.wikiAccountLink.findFirst).toHaveBeenCalledWith({
      where: {
        source: "ixwiki",
        verifiedAt: { not: null },
        username: { equals: "Kir Republic", mode: "insensitive" },
      },
      select: { userId: true },
    });
    expect(grantBonus).toHaveBeenCalledWith(
      expect.anything(),
      "u_verified",
      "bonus:loreward:e1",
      2500,
      expect.objectContaining({ oneTime: true })
    );
  });

  it("pays nobody when only the legacy User.wikiUsername column matches", async () => {
    mocked.wikiAccountLink.findFirst.mockResolvedValue(null);
    mocked.user.findFirst.mockResolvedValue({ id: "u_squatter" });
    expect(await grantLorewardBonuses()).toBe(0);
    expect(grantBonus).not.toHaveBeenCalled();
    expect(mocked.user.findFirst).not.toHaveBeenCalled();
  });
});
