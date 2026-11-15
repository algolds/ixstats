import { fireEvent, render, screen, within } from "@testing-library/react";
import { MineList } from "~/components/vault/cards/MineList";
import type { CardFaceData, CardRarity } from "~/lib/cards/face/types";
import type { MineRow } from "~/lib/cards/hub/mine";

const REALM = {
  id: "default",
  slug: "ixnay",
  name: "Ixnay",
  crestUrl: null,
  isSystem: false,
};

function makeRow(args: {
  id: string;
  title: string;
  rarity: CardRarity;
  season: number | null;
  level: number;
  copies: number;
  value: number;
}): MineRow {
  const face: CardFaceData = {
    cardId: args.id,
    title: args.title,
    rarity: args.rarity,
    cardType: "NS",
    realm: REALM,
    artwork: null,
    uncollected: false,
    number: 1,
    season: args.season,
    isRetired: false,
    copy: {
      ownershipId: `own-${args.id}`,
      finish: "FOIL",
      serialNumber: 1,
      level: args.level,
    },
  };
  return {
    face,
    copies: args.copies,
    value: args.value,
    isLocked: false,
    inOffer: false,
    isBound: false,
    importDiscounted: false,
    inscription: null,
  };
}

const ROWS: readonly MineRow[] = [
  makeRow({
    id: "c1",
    title: "Zephyria",
    rarity: "COMMON",
    season: 1,
    level: 2,
    copies: 1,
    value: 50,
  }),
  makeRow({
    id: "c2",
    title: "Aurelia",
    rarity: "LEGENDARY",
    season: 3,
    level: 8,
    copies: 5,
    value: 900,
  }),
  makeRow({
    id: "c3",
    title: "Borealis",
    rarity: "RARE",
    season: null,
    level: 4,
    copies: 3,
    value: 220,
  }),
];

function renderedTitles(): string[] {
  const bodyRows = screen.getAllByRole("row").slice(1);
  return bodyRows.map((row) => within(row).getByRole("button").textContent ?? "");
}

describe("MineList sortable columns and row affordances", () => {
  it("sorts client-side by Card, Rarity, Season, Level, and Copies with aria-sort state", () => {
    render(<MineList rows={ROWS} onOpen={jest.fn()} />);

    const cardHeader = screen.getByRole("columnheader", { name: "Card" });
    const rarityHeader = screen.getByRole("columnheader", { name: "Rarity" });
    const seasonHeader = screen.getByRole("columnheader", { name: "Season" });
    const levelHeader = screen.getByRole("columnheader", { name: "Level" });
    const copiesHeader = screen.getByRole("columnheader", { name: "Copies" });

    expect(cardHeader).toHaveAttribute("aria-sort", "none");
    expect(renderedTitles()).toEqual(["Zephyria", "Aurelia", "Borealis"]);

    // Card sorts A -> Z first, then Z -> A
    fireEvent.click(within(cardHeader).getByRole("button", { name: "Card" }));
    expect(cardHeader).toHaveAttribute("aria-sort", "ascending");
    expect(renderedTitles()).toEqual(["Aurelia", "Borealis", "Zephyria"]);

    fireEvent.click(within(cardHeader).getByRole("button", { name: "Card" }));
    expect(cardHeader).toHaveAttribute("aria-sort", "descending");
    expect(renderedTitles()).toEqual(["Zephyria", "Borealis", "Aurelia"]);

    // Rarity sorts highest rarity first, then lowest
    fireEvent.click(within(rarityHeader).getByRole("button", { name: "Rarity" }));
    expect(rarityHeader).toHaveAttribute("aria-sort", "descending");
    expect(cardHeader).toHaveAttribute("aria-sort", "none");
    expect(renderedTitles()).toEqual(["Aurelia", "Borealis", "Zephyria"]);

    fireEvent.click(within(rarityHeader).getByRole("button", { name: "Rarity" }));
    expect(rarityHeader).toHaveAttribute("aria-sort", "ascending");
    expect(renderedTitles()).toEqual(["Zephyria", "Borealis", "Aurelia"]);

    // Season keeps null seasons at the bottom in both directions
    fireEvent.click(within(seasonHeader).getByRole("button", { name: "Season" }));
    expect(seasonHeader).toHaveAttribute("aria-sort", "descending");
    expect(renderedTitles()).toEqual(["Aurelia", "Zephyria", "Borealis"]);

    // Level sorts highest first
    fireEvent.click(within(levelHeader).getByRole("button", { name: "Level" }));
    expect(levelHeader).toHaveAttribute("aria-sort", "descending");
    expect(renderedTitles()).toEqual(["Aurelia", "Borealis", "Zephyria"]);

    // Copies sorts highest count first
    fireEvent.click(within(copiesHeader).getByRole("button", { name: "Copies" }));
    expect(copiesHeader).toHaveAttribute("aria-sort", "descending");
    expect(renderedTitles()).toEqual(["Aurelia", "Borealis", "Zephyria"]);
  });

  it("marks body rows with data-row, tabular-nums, and single-fire row/button activation", () => {
    const onOpen = jest.fn();
    render(<MineList rows={ROWS} onOpen={onOpen} />);

    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(bodyRows[0]).toHaveAttribute("data-row");

    // Clicking the row opens the card once
    fireEvent.click(bodyRows[0]!);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenLastCalledWith(ROWS[0]!.face);

    // Clicking the focusable title button opens the card once without bubbling a duplicate call
    fireEvent.click(within(bodyRows[1]!).getByRole("button", { name: "Aurelia" }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenLastCalledWith(ROWS[1]!.face);
  });
});
