import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/components/cards/pack-opening/PackHolographicCover", () => ({
  PackHolographicCover: ({ packName }: { packName?: string }) => (
    <div data-testid="pack-art">{packName}</div>
  ),
}));

import { PackOdds } from "~/components/vault/sections/marketplace/store/PackOdds";
import {
  PackHolographicCard,
  type PackItem,
} from "~/components/vault/sections/marketplace/store/PackHolographicCard";

describe("PackOdds", () => {
  it("lists the chance per card of each rarity the pack can give, and its guarantee", () => {
    render(
      <PackOdds
        pack={{
          commonOdds: 65,
          uncommonOdds: 25,
          rareOdds: 7,
          ultraRareOdds: 2,
          epicOdds: 0.9,
          legendaryOdds: 0.1,
          guaranteedRarity: "RARE",
        }}
      />
    );
    const rows = screen.getAllByRole("row").map((row) => row.textContent);
    expect(rows).toEqual([
      "Common65%",
      "Uncommon25%",
      "Rare7%",
      "Ultra Rare2%",
      "Epic0.9%",
      "Legendary0.1%",
    ]);
    expect(screen.getByText("Every pack has at least one Rare or rarer card.")).toBeInTheDocument();
  });

  it("says nothing about a guarantee the pack does not have", () => {
    render(
      <PackOdds
        pack={{
          commonOdds: 100,
          uncommonOdds: 0,
          rareOdds: 0,
          ultraRareOdds: 0,
          epicOdds: 0,
          legendaryOdds: 0,
          guaranteedRarity: null,
        }}
      />
    );
    expect(screen.getAllByRole("row")).toHaveLength(1);
    expect(screen.queryByText(/at least one/)).toBeNull();
  });
});

describe("a pack's details in the Store", () => {
  const pack: PackItem = {
    id: "pack-1",
    name: "Ixnay starter",
    description: null,
    artwork: null,
    packType: "BASIC",
    priceCredits: 120,
    cardCount: 5,
    guaranteedRarity: "ULTRA_RARE",
    commonOdds: 60,
    uncommonOdds: 28,
    rareOdds: 10,
    ultraRareOdds: 2,
    epicOdds: 0,
    legendaryOdds: 0,
  };

  it("shows the pack's odds and its guarantee once, by the player rarity name", () => {
    render(<PackHolographicCard pack={pack} actionButton={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Pack details and odds" }));
    const dialog = screen.getByRole("dialog");
    const odds = within(dialog).getByRole("table", { name: "Odds for each card" });
    expect(
      within(odds)
        .getAllByRole("row")
        .map((row) => row.textContent)
    ).toEqual(["Common60%", "Uncommon28%", "Rare10%", "Ultra Rare2%"]);
    expect(
      within(dialog).getByText("Every pack has at least one Ultra Rare or rarer card.")
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("Guaranteed rarity")).toBeNull();
    expect(within(dialog).queryByText(/ULTRA/)).toBeNull();
  });
});
