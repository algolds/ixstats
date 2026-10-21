/**
 * Cards refresh §2.1: twelve lore categories, and nothing legacy in their maps. The rarities, types and their labels
 * are pinned in card-enums.test.ts and face/face-libs.test.ts.
 */
import { BROWSABLE_CATEGORIES, CATEGORY_SYNONYMS, LoreCategory } from "~/lib/cards/category-enums";
import { getCategoryLabel } from "~/lib/cards/category-theme";

describe("card vocabulary", () => {
  it("has twelve lore categories, every one browsable, labelled and with synonyms", () => {
    const categories = Object.values(LoreCategory);
    expect(categories).toHaveLength(12);
    expect(BROWSABLE_CATEGORIES).toEqual(categories);
    expect(Object.keys(CATEGORY_SYNONYMS).sort()).toEqual([...categories].sort());
    expect(categories.map(getCategoryLabel)).toEqual([
      "Military",
      "Diplomacy",
      "Geography",
      "Religion",
      "Culture",
      "Government",
      "People",
      "Economy",
      "Science",
      "History",
      "Nation",
      "Special",
    ]);
  });
});
