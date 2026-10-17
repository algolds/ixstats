/** @jest-environment node */
import {
  CARD_TYPES,
  CARD_TYPE_LABELS,
  RARITIES,
  RARITY_LABELS,
  SOURCE_OPTIONS,
  labelOf,
} from "~/app/admin/cards/shared/card-labels";
import { CardRarity } from "~/lib/cards/enums";

describe("card labels", () => {
  it("offers every card source wiki by its name", () => {
    expect(SOURCE_OPTIONS).toEqual([
      ["ixwiki", "IxWiki"],
      ["iiwiki", "IIWiki"],
      ["althistory", "AltHistory Wiki"],
      ["commons", "Wikimedia Commons"],
    ]);
  });

  it("lists the rarities lowest first, as the enum does", () => {
    expect(RARITIES).toEqual(Object.values(CardRarity));
  });

  it("labels each value in sentence case, and passes unknown values through", () => {
    expect(RARITIES.map((rarity) => labelOf(RARITY_LABELS, rarity))).toEqual([
      "Common",
      "Uncommon",
      "Rare",
      "Ultra rare",
      "Epic",
      "Legendary",
    ]);
    expect(CARD_TYPES.map((type) => labelOf(CARD_TYPE_LABELS, type))).toEqual([
      "Lore",
      "Nation",
      "NationStates",
      "Special",
      "Trophy",
    ]);
    expect(labelOf(RARITY_LABELS, "MYSTERY")).toBe("MYSTERY");
    expect(labelOf(RARITY_LABELS, "constructor")).toBe("constructor");
  });
});
