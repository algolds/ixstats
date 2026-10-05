/**
 * The passport showcase renders real achievements, ribbons, the most valuable cards and Lorewards
 * standing, with empty states and "kept private" states for hidden sections.
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import {
  PassportShowcase,
  signatureRibbons,
} from "~/components/passport/showcase/PassportShowcase";
import type { PassportPayload, PassportRibbon } from "~/components/passport/types";

const ribbon = (key: string, rarity: string, pinned = false): PassportRibbon => ({
  key,
  title: `Ribbon ${key}`,
  description: "",
  category: "Economic",
  rarity,
  iconUrl: null,
  points: 10,
  unlockedAt: "2026-01-01T00:00:00.000Z",
  pinned,
});

const VISIBLE = {
  accolades: true,
  impact: true,
  forumStats: true,
  vaultCards: true,
  historyStream: true,
  achievements: true,
};

function payload(overrides: Partial<PassportPayload> = {}): PassportPayload {
  return {
    account: { isOwner: false },
    privacy: VISIBLE,
    wiki: {
      lorewards: {
        totalScore: 1200,
        totalBytes: 0,
        rank: 3,
        dailyWins: 2,
        dailyRunnerUps: 0,
        weeklyWins: 1,
        monthlyWins: 0,
        currentStreak: 1,
        longestStreak: 9,
      },
    },
    vault: {
      totalCards: 10,
      deckValue: 0,
      collectorLevel: 1,
      collectorXp: 0,
      xpPerLevel: 1000,
      credits: 0,
      focus: null,
      topCards: [
        {
          id: "c1",
          ownershipId: "o1",
          title: "Imperial Crown",
          rarity: "LEGENDARY",
          marketValue: 900,
        },
        {
          id: "c2",
          ownershipId: "o2",
          title: "Senate Seal",
          rarity: "ULTRA_RARE",
          marketValue: 400,
        },
      ],
    },
    showcase: {
      achievements: {
        unlockedCount: 2,
        totalCount: 76,
        points: 20,
        ribbons: [ribbon("legend", "Legendary"), ribbon("common", "Common")],
      },
    },
    ...overrides,
  } as unknown as PassportPayload;
}

describe("signatureRibbons", () => {
  it("uses pinned ribbons when there are any", () => {
    const shelf = signatureRibbons([ribbon("a", "Common", true), ribbon("b", "Legendary")]);
    expect(shelf).toEqual({ ribbons: [expect.objectContaining({ key: "a" })], pinned: true });
  });

  it("falls back to the top three ribbons", () => {
    const shelf = signatureRibbons(["a", "b", "c", "d"].map((k) => ribbon(k, "Rare")));
    expect(shelf.pinned).toBe(false);
    expect(shelf.ribbons.map((r) => r.key)).toEqual(["a", "b", "c"]);
  });
});

describe("PassportShowcase", () => {
  it("shows achievements, ribbons, the top cards by value and Lorewards standing", () => {
    render(<PassportShowcase data={payload()} cleanUsername="alex" />);
    expect(screen.getByText(/2 \/ 76\s+unlocked · 20 pts/)).toBeInTheDocument();
    expect(screen.getByText("Top ribbons")).toBeInTheDocument();
    expect(screen.getByText("Ribbon legend")).toBeInTheDocument();
    expect(screen.getByTestId("passport-ribbon-shelf").children).toHaveLength(2);
    expect(screen.getByText("Imperial Crown")).toBeInTheDocument();
    expect(screen.getByText("Ultra Rare")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();
  });

  it("shows empty states instead of invented data", () => {
    const empty = payload({
      wiki: { lorewards: null } as never,
      vault: { ...payload().vault!, topCards: [] },
      showcase: {
        achievements: { unlockedCount: 0, totalCount: 76, points: 0, ribbons: [] },
      },
    });
    render(<PassportShowcase data={empty} cleanUsername="alex" />);
    expect(screen.getByText("@alex has not unlocked any achievements yet.")).toBeInTheDocument();
    expect(screen.getByText("@alex has no IxCards yet.")).toBeInTheDocument();
    expect(screen.getByText("No Lorewards score yet.")).toBeInTheDocument();
  });

  it("says a hidden section is private", () => {
    const hidden = payload({
      privacy: { ...VISIBLE, accolades: false, vaultCards: false, achievements: false },
      vault: null,
      showcase: { achievements: null },
    });
    render(<PassportShowcase data={hidden} cleanUsername="alex" />);
    expect(screen.getByText("@alex keeps their achievements private.")).toBeInTheDocument();
    expect(screen.getByText("@alex keeps their collection private.")).toBeInTheDocument();
    expect(screen.getByText("@alex keeps their Lorewards private.")).toBeInTheDocument();
  });
});
