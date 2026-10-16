/** Cards refresh §2.1: six rarities, five card types, twelve lore categories, and nothing legacy in the maps. */
import { CardRarity, CardType } from "~/lib/cards/enums";
import { BROWSABLE_CATEGORIES, CATEGORY_SYNONYMS, LoreCategory } from "~/lib/cards/category-enums";
import { getCategoryTheme } from "~/lib/cards/category-theme";
import { RARITY_MATERIALS } from "~/lib/cards/rarity-materials";
import { getCardTypeLabel, normalizeRarity } from "~/lib/cards/display-utils";
import { CATEGORY_ICONS } from "~/components/cards/icons/icon-paths";

describe("card vocabulary", () => {
  it("has twelve lore categories, every one browsable, themed, iconed and with synonyms", () => {
    const categories = Object.values(LoreCategory);
    expect(categories).toHaveLength(12);
    expect(BROWSABLE_CATEGORIES).toEqual(categories);
    expect(Object.keys(CATEGORY_SYNONYMS).sort()).toEqual([...categories].sort());
    expect(Object.keys(CATEGORY_ICONS).sort()).toEqual([...categories].sort());
    for (const category of categories) expect(getCategoryTheme(category).label).toBeTruthy();
  });

  it("has the six rarities in the material table, and reads a retired rarity as Common", () => {
    expect(Object.keys(RARITY_MATERIALS)).toEqual(Object.values(CardRarity));
    expect(normalizeRarity("MYTHIC")).toBe(CardRarity.COMMON);
    expect(normalizeRarity("legendary")).toBe(CardRarity.LEGENDARY);
  });

  it("labels the five card types, NS as NationStates", () => {
    expect(Object.values(CardType).map(getCardTypeLabel)).toEqual([
      "Lore",
      "Nation",
      "NationStates",
      "Special",
      "Trophy",
    ]);
  });
});
