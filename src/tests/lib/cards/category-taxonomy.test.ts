/** @jest-environment node */
/** Each lore category's fixed subcategories (card categories design, "The taxonomy module"). */
import { BROWSABLE_CATEGORIES } from "~/lib/cards/category-enums";
import {
  CategoryChoiceSchema,
  SUBCATEGORIES,
  categoryLine,
  isSubcategoryOf,
  sameCategoryChoice,
  subcategoriesOf,
  subcategoryLabel,
} from "~/lib/cards/category-taxonomy";

describe("the subcategory lists", () => {
  it("gives every category its list, and Special none", () => {
    expect(Object.keys(SUBCATEGORIES).sort()).toEqual([...BROWSABLE_CATEGORIES].sort());
    expect(subcategoriesOf("SPECIAL")).toEqual([]);
    expect(subcategoriesOf("NATION").map((s) => s.label)).toEqual(["Nation", "Former state"]);
    expect(subcategoriesOf("MILITARY").map((s) => s.label)).toEqual([
      "Army",
      "Navy",
      "Air force",
      "Battle or war",
      "Weapon or vehicle",
      "Unit",
    ]);
  });

  it("files a country under Nation, never under Geography", () => {
    expect(subcategoriesOf("GEOGRAPHY").map((s) => s.label)).toEqual([
      "Region or province",
      "City or settlement",
      "River, lake or sea",
      "Mountain or island",
      "Landmark",
    ]);
    expect(isSubcategoryOf("GEOGRAPHY", "country")).toBe(false);
    expect(isSubcategoryOf("NATION", "nation")).toBe(true);
  });

  it("labels in sentence case, ids in kebab case, none repeated within a category", () => {
    for (const list of Object.values(SUBCATEGORIES)) {
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
      for (const { id, label } of list) {
        expect(label).toMatch(/^[A-Z][a-z]*(?:,? [a-z]+)*$/);
        expect(id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      }
    }
  });
});

describe("validation", () => {
  it("accepts a subcategory only in its own category", () => {
    expect(isSubcategoryOf("HISTORY", "event")).toBe(true);
    expect(isSubcategoryOf("HISTORY", null)).toBe(true);
    expect(isSubcategoryOf(null, null)).toBe(true);
    expect(isSubcategoryOf("MILITARY", "event")).toBe(false);
    expect(isSubcategoryOf(null, "event")).toBe(false);
    expect(isSubcategoryOf("SPECIAL", "event")).toBe(false);
  });

  it("refuses a mismatched choice in the schema every write path parses", () => {
    expect(
      CategoryChoiceSchema.safeParse({ category: "MILITARY", subcategory: "army" }).success
    ).toBe(true);
    expect(CategoryChoiceSchema.safeParse({ category: null, subcategory: null }).success).toBe(
      true
    );
    const bad = CategoryChoiceSchema.safeParse({ category: "ECONOMY", subcategory: "army" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe("That subcategory is not in that category");
    expect(CategoryChoiceSchema.safeParse({ category: "NOPE", subcategory: null }).success).toBe(
      false
    );
  });
});

it("writes the category line people read", () => {
  expect(categoryLine("HISTORY", "event")).toBe("History · Event");
  expect(categoryLine("MILITARY", null)).toBe("Military");
  expect(categoryLine(null, null)).toBe("Uncategorised");
  // A subcategory named as its category says it once
  expect(categoryLine("NATION", "nation")).toBe("Nation");
  expect(categoryLine("NATION", "former-state")).toBe("Nation · Former state");
  expect(subcategoryLabel("GEOGRAPHY", "river-lake-or-sea")).toBe("River, lake or sea");
  expect(subcategoryLabel("GEOGRAPHY", "nope")).toBeNull();
});

it("calls two choices the same only when both category and subcategory match", () => {
  const event = { category: "HISTORY" as const, subcategory: "event" };
  expect(sameCategoryChoice(event, { ...event })).toBe(true);
  expect(sameCategoryChoice(event, { ...event, subcategory: null })).toBe(false);
  expect(sameCategoryChoice(event, { ...event, category: "MILITARY" })).toBe(false);
});
