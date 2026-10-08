/**
 * The passport Collection tab: collector level, deck value, IxCredits, Focus, the most valuable
 * cards, and achievements with the pinned shelf. Real data only, with empty and private states.
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import type React from "react";
import {
  PassportCollectionTab,
  signatureRibbons,
} from "~/components/passport/tabs/PassportCollectionTab";
import type {
  PassportAchievements,
  PassportRibbon,
  PassportVault,
} from "~/components/passport/types";

jest.mock("~/components/cards/display/CardDisplay", () => ({
  CardDisplay: ({ card }: { card: { title: string } }) => <div>{card.title}</div>,
}));
jest.mock("~/components/cards/display/CardDetailsModal", () => ({ CardDetailsModal: () => null }));
jest.mock("~/components/vault/IxCreditsSymbol", () => ({
  IxCreditsSymbol: () => <span data-testid="ixcredits-symbol" />,
}));

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

const vault = {
  totalCards: 10,
  deckValue: 12_400,
  collectorLevel: 3,
  collectorXp: 1200,
  xpPerLevel: 500,
  credits: 1250,
  focus: { categoryCount: 5, categoryTotal: 12, topCategory: "MILITARY" },
  topCards: [
    { id: "c1", ownershipId: "o1", title: "Imperial Crown", rarity: "LEGENDARY", marketValue: 900 },
    { id: "c2", ownershipId: "o2", title: "Senate Seal", rarity: "ULTRA_RARE", marketValue: 400 },
  ],
} as unknown as PassportVault;

const achievements: PassportAchievements = {
  unlockedCount: 2,
  totalCount: 76,
  points: 20,
  ribbons: [ribbon("legend", "Legendary"), ribbon("common", "Common")],
};

function renderTab(
  props: Partial<React.ComponentProps<typeof PassportCollectionTab>> = {}
): ReturnType<typeof render> {
  return render(
    <PassportCollectionTab
      vault={vault}
      achievements={achievements}
      handle="alex"
      isOwner={false}
      {...props}
    />
  );
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

describe("PassportCollectionTab", () => {
  it("shows level, deck value, IxCredits and Focus, with the IxCredits symbol once", () => {
    renderTab();
    expect(screen.getByText("Lv 3")).toBeInTheDocument();
    expect(screen.getByText("1,200 / 1,500 XP")).toBeInTheDocument();
    expect(screen.getByText("12,400")).toBeInTheDocument();
    expect(screen.getByText("1,250")).toBeInTheDocument();
    expect(screen.getByText("5/12")).toBeInTheDocument();
    expect(screen.getByText("Military focus")).toBeInTheDocument();
    expect(screen.getAllByTestId("ixcredits-symbol")).toHaveLength(1);
  });

  it("shows the most valuable cards and the achievements shelf", () => {
    renderTab();
    expect(screen.getByText("Imperial Crown")).toBeInTheDocument();
    expect(screen.getByText("Senate Seal")).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 76 unlocked · 20 pts/)).toBeInTheDocument();
    expect(screen.getByText("Top ribbons")).toBeInTheDocument();
    expect(screen.getByText("Ribbon legend")).toBeInTheDocument();
    expect(screen.getByTestId("passport-ribbon-shelf").children).toHaveLength(2);
  });

  it("names the shelf after pinned ribbons when the holder pinned some", () => {
    renderTab({
      achievements: { ...achievements, ribbons: [ribbon("a", "Rare", true), ribbon("b", "Rare")] },
    });
    expect(screen.getByText("Signature ribbons")).toBeInTheDocument();
  });

  it("links nowhere: there is no public vault page to send a visitor to", () => {
    renderTab();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows empty states instead of invented data", () => {
    renderTab({
      vault: { ...vault, topCards: [], totalCards: 0, focus: null },
      achievements: { unlockedCount: 0, totalCount: 76, points: 0, ribbons: [] },
    });
    expect(screen.getByText("@alex has not collected any IxCards yet.")).toBeInTheDocument();
    expect(screen.getByText("@alex has not unlocked any achievements yet.")).toBeInTheDocument();
    expect(screen.queryByText("Focus")).not.toBeInTheDocument();
  });

  it("says a hidden section is private", () => {
    renderTab({ vault: null, achievements: null });
    expect(screen.getByText("@alex keeps their collection private.")).toBeInTheDocument();
    expect(screen.getByText("@alex keeps their achievements private.")).toBeInTheDocument();
  });

  it("tells the owner where to show a hidden section", () => {
    renderTab({ vault: null, isOwner: true });
    expect(
      screen.getByText("You hide your collection. Change it on the back of your passport.")
    ).toBeInTheDocument();
  });
});
