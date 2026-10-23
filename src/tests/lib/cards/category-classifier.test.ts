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
  const review = (confidence: number) =>
    classifierColumns({ category: "NATION", subcategory: "nation", confidence })
      .categoryNeedsReview;
  expect([review(0.44), review(0.45)]).toEqual([true, false]);
});

describe("confidence", () => {
  it("trusts an exact infobox on its own", () => {
    const result = classifyLoreArticle({ title: "Qq", templates: ["Infobox treaty"] });
    expect(result).toMatchObject({ category: "DIPLOMACY", subcategory: "treaty" });
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("passes a Commons flag on its one Nation category", () => {
    const result = classifyLoreArticle({
      title: "Flag of Ireland",
      categories: ["Flags of Ireland", "SVG flags"],
      source: "commons",
    });
    expect(result).toMatchObject({ category: "NATION", subcategory: "nation" });
    expect(result.confidence).toBeGreaterThanOrEqual(0.45);
    expect(result.confidence).toBeLessThanOrEqual(0.55);
    expect(needsCategoryReview(result)).toBe(false);
  });

  it("never trusts keywords alone past a quarter", () => {
    const result = classifyLoreArticle({
      title: "Cathedral clergy",
      text: "The cathedral, a temple and shrine of the faith, whose clergy and priests keep its religion. ".repeat(
        5
      ),
    });
    expect(result.category).toBe("RELIGION");
    expect(result.confidence).toBeGreaterThan(0.2);
    expect(result.confidence).toBeLessThanOrEqual(0.25);
  });

  it("lowers an infobox's confidence for one contrary category", () => {
    const result = classifyLoreArticle({
      title: "Qq",
      templates: ["Infobox treaty"],
      categories: ["Battles of Urcea"],
    });
    expect(result.category).toBe("DIPLOMACY");
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThanOrEqual(0.7);
  });

  it("caps a category's lead hits at fifteen", () => {
    const text = "cathedral clergy temple shrine priest faith ".repeat(4); // 6 keywords, 3 hits each
    expect(classifyLoreArticle({ title: "Qq", text }).confidence).toBe(0.19);
  });

  it("counts one keyword at most three times in the lead", () => {
    const result = classifyLoreArticle({ title: "Qq", text: "A cathedral. ".repeat(10) });
    expect(result).toEqual({ category: "RELIGION", subcategory: null, confidence: 0.04 });
  });
});

it("matches keywords as whole words, in the title too", () => {
  expect(classifyLoreArticle({ title: "Warsaw" }).category).toBeNull();
  expect(classifyLoreArticle({ title: "War" })).toEqual({
    category: "MILITARY",
    subcategory: null,
    confidence: 0.07, // the title's keyword and its one lead hit
  });
});

it("reads keywords from the lead only", () => {
  expect(
    classifyLoreArticle({ title: "Qq", text: `${"x ".repeat(800)}cathedral` }).category
  ).toBeNull();
});

it("reads no flag as Culture: a flag is a Nation card", () => {
  expect(classifyLoreArticle({ title: "Flag", text: "A flag." }).category).toBeNull();
});

it("lets a category's subcategory beat an infobox that only defaults to one", () => {
  expect(
    classifyLoreArticle({
      title: "Royal Navy (Urcea)",
      source: "ixwiki",
      templates: ["Template:Infobox military unit"],
      categories: ["Military of Urcea", "Navies", "Urcea"],
    })
  ).toMatchObject({ category: "MILITARY", subcategory: "navy" });
  expect(
    classifyLoreArticle({
      title: "Bahia",
      source: "ixwiki",
      templates: ["Template:Infobox settlement"],
      categories: ["States of Cartadania", "Cartadania"],
    })
  ).toMatchObject({ category: "GEOGRAPHY", subcategory: "region-or-province" });
  expect(
    classifyLoreArticle({ title: "Qq", templates: ["Infobox military unit"] }).subcategory
  ).toBe("unit");
  expect(
    classifyLoreArticle({
      title: "Qq",
      templates: ["Infobox settlement"],
      categories: ["Geography of Urcea"],
    }).subcategory
  ).toBe("city-or-settlement");
  expect(
    classifyLoreArticle({
      title: "Qq",
      templates: ["Infobox settlement"],
      categories: ["Treaties of Urcea"],
    }).subcategory
  ).toBe("city-or-settlement");
});

it("reads an aircraft's infobox as Military, not Science", () => {
  expect(
    classifyLoreArticle({
      title: "Triax AB-121 Nightshade",
      source: "iiwiki",
      templates: ["Template:Infobox aircraft begin", "Template:Infobox aircraft type"],
      categories: ["Military aircraft", "Bombers"],
    })
  ).toMatchObject({ category: "MILITARY", subcategory: "weapon-or-vehicle" });
});

it("reads no template that only shares a name with an object's built-ins", () => {
  expect(classifyLoreArticle({ templates: ["constructor", "toString"] }).category).toBeNull();
});
