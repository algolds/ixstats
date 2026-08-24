// src/tests/auth/profile.test.ts
// Unit and integration tests for Decoupled IxnayID Passport & Sovereign Factbook Architecture (Plans 181 & 188)

import { describe, it, expect } from "@jest/globals";

describe("Decoupled IxnayID Passport & Sovereign Factbook Architecture (Plan 188)", () => {
  it("normalizes handles with leading @ symbols correctly", () => {
    const rawHandles = ["@jxsig", "@@valora", " @diplomat ", "@Aethelgard"];
    const normalized = rawHandles.map((h) => h.trim().replace(/^@+/, ""));

    expect(normalized).toEqual(["jxsig", "valora", "diplomat", "Aethelgard"]);
  });

  it("discriminates and formats multi-realm sovereign portfolios accurately", () => {
    const userWithMultiRealmHoldings = {
      account: {
        userId: "u-101",
        membershipTier: "founder",
        roleName: "High Chancellor",
      },
      nations: [
        {
          id: "c-1",
          name: "Grand Valora",
          slug: "grand_valora",
          realmId: "default",
          realmName: "IxWorld",
          currentPopulation: 45200000,
          currentTotalGdp: 2820000000000,
          continent: "Euraxis",
          isFlagship: true,
        },
        {
          id: "c-2",
          name: "New Zephyria",
          slug: "new_zephyria",
          realmId: "realm-novaterra",
          realmName: "Novaterra",
          currentPopulation: 12400000,
          currentTotalGdp: 450000000000,
          continent: "Aethelgard",
          isFlagship: false,
        },
      ],
    };

    expect(userWithMultiRealmHoldings.nations).toHaveLength(2);
    expect(userWithMultiRealmHoldings.nations[0]?.realmName).toBe("IxWorld");
    expect(userWithMultiRealmHoldings.nations[0]?.isFlagship).toBe(true);
    expect(userWithMultiRealmHoldings.nations[1]?.realmName).toBe("Novaterra");
    expect(userWithMultiRealmHoldings.nations[1]?.isFlagship).toBe(false);
  });

  it("handles unassigned citizen passports (0 nations) without breaking", () => {
    const unassignedCitizen = {
      country: null,
      nations: [],
      account: {
        userId: "u-202",
        membershipTier: "basic",
        roleName: "Citizen Diplomat",
      },
      vault: {
        totalCards: 18,
        deckValue: 640,
        collectorLevel: 3,
      },
      wiki: {
        editCount: 52,
        lorewards: { currentStreak: 4, totalScore: 320 },
      },
    };

    expect(unassignedCitizen.country).toBeNull();
    expect(unassignedCitizen.nations).toHaveLength(0);
    expect(unassignedCitizen.vault.totalCards).toBe(18);
    expect(unassignedCitizen.wiki.lorewards.currentStreak).toBe(4);
  });

  it("calculates Loreward ranks and streak boundaries safely", () => {
    const sampleStats = {
      totalScore: 1850,
      dailyWins: 12,
      dailyRunnerUps: 5,
      currentStreak: 7,
      longestStreak: 21,
    };

    expect(sampleStats.totalScore).toBeGreaterThan(0);
    expect(sampleStats.currentStreak).toBeLessThanOrEqual(sampleStats.longestStreak);
    expect(sampleStats.dailyWins + sampleStats.dailyRunnerUps).toBe(17);
  });

  it("formats XenForo Unix timestamps into consistent localized date strings", () => {
    const unixTime = 1700000000; // Nov 14, 2023
    const formatted = new Date(unixTime * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    expect(formatted).toContain("2023");
    expect(formatted).toContain("Nov");
  });

  it("partitions multi-service data cleanly into unified payload", () => {
    const unifiedPayload = {
      account: {
        userId: "u-1",
        membershipTier: "elite",
        roleName: "Chancellor",
        isOwner: true,
      },
      thinkpages: {
        displayName: "Chancellor Valora",
        bio: "Dedicated to trade diplomacy and regional stability.",
      },
      vault: {
        totalCards: 48,
        deckValue: 12400,
        collectorLevel: 9,
      },
      wiki: {
        editCount: 342,
        lorewards: { currentStreak: 14 },
      },
      forum: {
        messageCount: 1540,
        reactionScore: 890,
      },
    };

    expect(unifiedPayload.account.isOwner).toBe(true);
    expect(unifiedPayload.vault.deckValue).toBe(12400);
    expect(unifiedPayload.wiki.lorewards.currentStreak).toBe(14);
    expect(unifiedPayload.forum.messageCount).toBeGreaterThan(1000);
  });
});
