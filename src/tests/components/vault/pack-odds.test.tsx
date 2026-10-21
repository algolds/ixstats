import "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/cards/pack-opening/PackHolographicCover", () => ({
  PackHolographicCover: ({ packName }: { packName?: string }) => (
    <div data-testid="pack-art">{packName}</div>
  ),
}));
import { PackOdds } from "~/components/vault/sections/marketplace/store/PackOdds";
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
});
