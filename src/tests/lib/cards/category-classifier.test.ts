/** @jest-environment node */
/** The classifier: real infoboxes, the wiki's own categories, then the title and excerpt; null when nothing scores. */
import {
  CATEGORY_REVIEW_THRESHOLD,
  classifierColumns,
  classifyLoreArticle,
  needsCategoryReview,
} from "~/lib/cards/category-classifier";

const LEAD = "The Battle of Kiro was fought in 1820 between the two fleets off the coast. ".repeat(
  3
);

it("reads the infobox in the raw wikitext, the signal the old call never passed", () => {
  const result = classifyLoreArticle({
    title: "Battle of Kiro",
    text: LEAD,
    wikitext: `{{Infobox military conflict\n| conflict = Battle of Kiro\n}}\n${LEAD}`,
    source: "ixwiki",
  });
  expect(result).toMatchObject({ category: "MILITARY", subcategory: "battle-or-war" });
  expect(result.confidence).toBeGreaterThanOrEqual(CATEGORY_REVIEW_THRESHOLD);
  expect(needsCategoryReview(result)).toBe(false);
});

it("takes the template titles the wiki API gives, ignoring templates that are not infoboxes", () => {
  expect(
    classifyLoreArticle({
      title: "Aldmark",
      templates: ["Template:Cite web", "Template:Infobox settlement"],
    })
  ).toMatchObject({ category: "GEOGRAPHY", subcategory: "city-or-settlement" });
});

it("counts an infobox once when both the wikitext and the template list name it", () => {
  const once = classifyLoreArticle({ title: "Qq", templates: ["Template:Infobox country"] });
  const both = classifyLoreArticle({
    title: "Qq",
    templates: ["Template:Infobox country"],
    wikitext: "{{Infobox_country\n|name = Qq\n}}",
  });
  expect(both).toEqual(once);
});

it("scores an infobox variant by its prefix, below an exact infobox", () => {
  const exact = classifyLoreArticle({ title: "Qq", templates: ["Infobox military person"] });
  const variant = classifyLoreArticle({ title: "Qq", templates: ["Infobox military person 2"] });
  expect(variant).toMatchObject({ category: "PEOPLE", subcategory: "military-figure" });
  expect(variant.confidence).toBeLessThan(exact.confidence);
});

it("scores the wiki's own categories, given as titles or as strings", () => {
  const result = classifyLoreArticle({
    title: "Ardent",
    categories: [{ title: "Category:Rivers of Urcea" }, "Category:Lakes of Urcea"],
    source: "ixwiki",
  });
  expect(result).toMatchObject({ category: "GEOGRAPHY", subcategory: "river-lake-or-sea" });
});

it("reads a country's infobox and categories as a Nation", () => {
  expect(
    classifyLoreArticle({
      title: "Urcea",
      wikitext: "{{Infobox country\n|name = Urcea\n}}",
      categories: ["Category:Countries"],
    })
  ).toMatchObject({ category: "NATION", subcategory: "nation" });
});

it("answers null, confidence 0, when nothing scores: never NATION", () => {
  expect(classifyLoreArticle({ title: "Zzyzx" })).toEqual({
    category: null,
    subcategory: null,
    confidence: 0,
  });
  expect(
    classifyLoreArticle({
      title: "Zzyzx",
      categories: ["2023 Award winning pages", "Pages with broken file links"],
    })
  ).toEqual({ category: null, subcategory: null, confidence: 0 });
  expect(classifyLoreArticle({})).toEqual({ category: null, subcategory: null, confidence: 0 });
});

it("loses confidence when two categories score alike, and sends the card to review", () => {
  const result = classifyLoreArticle({
    title: "Qq",
    categories: ["Treaties of Urcea", "Battles of Urcea"],
  });
  expect(result.category).toBe("DIPLOMACY"); // the specificity arbiter breaks the tie
  expect(result.confidence).toBe(0);
  expect(needsCategoryReview(result)).toBe(true);
});

it("takes a subcategory only from a signal for the winning category", () => {
  const result = classifyLoreArticle({
    title: "Qq",
    templates: ["Infobox person"],
    categories: ["Rivers of Urcea"],
  });
  expect(result).toMatchObject({ category: "PEOPLE", subcategory: null });
});

it("takes the subcategory with the most points, ties to the first in the taxonomy", () => {
  expect(
    classifyLoreArticle({
      title: "Qq",
      categories: ["Rivers of Urcea", "Lakes of Urcea", "Islands of Urcea"],
    }).subcategory
  ).toBe("river-lake-or-sea");
  expect(
    classifyLoreArticle({ title: "Qq", categories: ["Islands of Urcea", "Rivers of Urcea"] })
      .subcategory
  ).toBe("river-lake-or-sea");
});

it("reads keywords from the title and the lead, with no subcategory", () => {
  const result = classifyLoreArticle({ title: "Qq", text: "A cathedral and its clergy." });
  expect(result).toMatchObject({ category: "RELIGION", subcategory: null });
  expect(result.confidence).toBeGreaterThan(0);
  expect(needsCategoryReview(result)).toBe(true);
});

it("gives the importer and the backfill one shape of columns", () => {
  expect(
    classifierColumns({ category: "HISTORY", subcategory: "event", confidence: 0.31 })
  ).toEqual({
    category: "HISTORY",
    subcategory: "event",
    categorySource: "CLASSIFIER",
    categoryConfidence: 0.31,
    categoryNeedsReview: true,
  });
  expect(
    classifierColumns({ category: "MILITARY", subcategory: null, confidence: 0.9 })
      .categoryNeedsReview
  ).toBe(false);
  expect(
    classifierColumns({ category: null, subcategory: null, confidence: 0 }).categoryNeedsReview
  ).toBe(true);
});
