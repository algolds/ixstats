/** @jest-environment node */
/** The category filter's choices: every lore category, and Uncategorised (card categories design, decision 4). */
import { UNCATEGORISED, isCategoryFilterValue } from "~/lib/cards/category-enums";
import { getCategoryFilterLabel } from "~/lib/cards/category-theme";

describe("isCategoryFilterValue", () => {
  it("takes Uncategorised and every lore category", () => {
    expect(isCategoryFilterValue(UNCATEGORISED)).toBe(true);
    expect(isCategoryFilterValue("HISTORY")).toBe(true);
  });

  it("refuses anything else", () => {
    for (const junk of ["", "__any", "history", "TROPHY", "UNCATEGORIZED"]) {
      expect(isCategoryFilterValue(junk)).toBe(false);
    }
  });
});

describe("getCategoryFilterLabel", () => {
  it("names Uncategorised, and a category by its own label", () => {
    expect(getCategoryFilterLabel(UNCATEGORISED)).toBe("Uncategorised");
    expect(getCategoryFilterLabel("HISTORY")).toBe("History");
  });
});
