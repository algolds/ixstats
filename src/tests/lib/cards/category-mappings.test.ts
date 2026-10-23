/** @jest-environment node */
/** The per-wiki tables from a wiki's categories and infobox templates to a lore category and subcategory. */
import {
  INFOBOX_RULES,
  SHARED_CATEGORY_RULES,
  WIKI_CATEGORY_RULES,
  categoryTargets,
  infoboxTarget,
  templateKey,
  unmappedCategories,
  unmappedInfoboxes,
} from "~/lib/cards/category-mappings";
import { isSubcategoryOf } from "~/lib/cards/category-taxonomy";

it.each([
  ["Rivers of Urcea", "GEOGRAPHY", "river-lake-or-sea"],
  ["Lakes of Caphiria", "GEOGRAPHY", "river-lake-or-sea"],
  ["Cities in Audonia", "GEOGRAPHY", "city-or-settlement"],
  ["Islands of the Sarpedon Sea", "GEOGRAPHY", "mountain-or-island"],
  ["Geography of Urcea", "GEOGRAPHY", undefined],
  ["Battles involving Caphiria", "MILITARY", "battle-or-war"],
  ["Conflicts", "MILITARY", "battle-or-war"],
  ["Military units of Urcea", "MILITARY", "unit"],
  ["Treaties of Urcea", "DIPLOMACY", "treaty"],
  ["International organizations", "DIPLOMACY", "alliance-or-organisation"],
  ["Political parties in Urcea", "GOVERNMENT", "party"],
  ["Companies of Urcea", "ECONOMY", "company"],
  ["Currencies", "ECONOMY", "currency-or-bank"],
  ["Monarchs of Urcea", "PEOPLE", "ruler-or-royal"],
  ["Politicians of Caphiria", "PEOPLE", "politician"],
  ["People", "PEOPLE", undefined],
  ["Religions", "RELIGION", "faith"],
  ["Cathedrals", "RELIGION", "holy-site"],
  ["Languages", "CULTURE", "language"],
  ["Football clubs", "CULTURE", "sport"],
  ["Newspapers", "CULTURE", "media"],
  ["History of Urcea", "HISTORY", undefined],
  ["Historical eras", "HISTORY", "era-or-period"],
  ["Countries in Audonia", "NATION", "nation"],
  ["Historical countries", "NATION", "former-state"],
  ["Universities", "SCIENCE", "institution"],
  ["Opera singers", "PEOPLE", "artist-or-writer"],
  ["Film actors", "PEOPLE", "artist-or-writer"],
  ["Ballet dancers", "PEOPLE", "artist-or-writer"],
])("reads the shared category %s as %s / %s", (name, category, subcategory) => {
  const targets = categoryTargets(`Category:${name}`, "iiwiki").filter(
    (t) => t.category === category
  );
  expect(targets).toEqual([subcategory ? { category, subcategory } : { category }]);
});

it("reads a country's own categories as a Nation and its geography as Geography, never both", () => {
  expect(categoryTargets("Countries", "iiwiki").map((t) => t.category)).toEqual(["NATION"]);
  expect(categoryTargets("Geography of Urcea", "iiwiki")).toEqual([{ category: "GEOGRAPHY" }]);
});

it("scores a category in every lore category it names", () => {
  expect(
    categoryTargets("Military History of Burgundie", "ixwiki")
      .map((t) => t.category)
      .sort()
  ).toEqual(["HISTORY", "MILITARY"]);
});

it("reads a wiki's own categories before the shared ones", () => {
  const geography = (name: string, source: "ixwiki" | "commons") =>
    categoryTargets(name, source).find((t) => t.category === "GEOGRAPHY");
  expect(geography("Subdivisions of Urcea", "ixwiki")).toEqual({
    category: "GEOGRAPHY",
    subcategory: "region-or-province",
  });
  expect(geography("Estates of Urcea", "ixwiki")).toEqual({
    category: "GEOGRAPHY",
    subcategory: "region-or-province",
  });
  expect(categoryTargets("NPC Countries", "ixwiki")).toEqual([
    { category: "NATION", subcategory: "nation" },
  ]);
  expect(categoryTargets("Brands", "ixwiki")).toEqual([
    { category: "ECONOMY", subcategory: "company" },
  ]);
  expect(categoryTargets("Brands", "iiwiki")).toEqual([]);
  for (const source of ["ixwiki", "iiwiki"] as const) {
    expect(categoryTargets("States of Cartadania", source)).toEqual([
      { category: "GEOGRAPHY", subcategory: "region-or-province" },
    ]);
  }
  expect(categoryTargets("States of Cartadania", "althistory")).toEqual([]);
  expect(categoryTargets("Timelines", "althistory")).toEqual([
    { category: "HISTORY", subcategory: "era-or-period" },
  ]);
  expect(
    categoryTargets("Flags of Ireland", "commons").find((t) => t.category === "NATION")
  ).toEqual({ category: "NATION", subcategory: "nation" });
  expect(categoryTargets("Flags of Ireland", "iiwiki")).toEqual([]);
});

it.each([
  "2023 Award winning pages",
  "Pages with broken file links",
  "Pages using duplicate arguments",
  "Articles needing citations",
  "Incomplete articles (Urcea)",
  "Canonical Article",
  "Noncanon",
  "Graphics requested",
  "Map Completion Project (Completed)",
  "Geography stubs",
  "Articles requiring cleanup",
  "Miscellaneous",
  "Common Core",
  "Hidden categories",
])("ignores the maintenance category %s", (name) => {
  expect(categoryTargets(name, "ixwiki")).toEqual([]);
});

it.each([
  ["Template:Infobox officeholder", "PEOPLE", "politician"],
  ["Infobox_Monarch", "PEOPLE", "ruler-or-royal"],
  ["Infobox person", "PEOPLE", undefined],
  ["Infobox military conflict", "MILITARY", "battle-or-war"],
  ["Infobox ship", "MILITARY", "weapon-or-vehicle"],
  ["Infobox army", "MILITARY", "army"],
  ["Infobox treaty", "DIPLOMACY", "treaty"],
  ["Infobox subdivision", "GEOGRAPHY", "region-or-province"],
  ["Infobox religion", "RELIGION", "faith"],
  ["Infobox clergy", "RELIGION", "clergy"],
  ["Infobox political party", "GOVERNMENT", "party"],
  ["Infobox official post", "GOVERNMENT", "office-or-post"],
  ["Infobox company", "ECONOMY", "company"],
  ["Infobox university", "SCIENCE", "institution"],
  ["Infobox language", "CULTURE", "language"],
  ["Infobox football club", "CULTURE", "sport"],
  ["Infobox album", "CULTURE", "music"],
  ["Infobox royal house", "PEOPLE", "family-or-dynasty"],
  ["Infobox document", "HISTORY", "document"],
  ["Infobox historical era", "HISTORY", "era-or-period"],
  ["Infobox country", "NATION", "nation"],
  ["Infobox former country", "NATION", "former-state"],
  ["Infobox artifact", "SPECIAL", undefined],
  ["Infobox law enforcement agency", "GOVERNMENT", "agency-or-ministry"],
  ["Infobox court case", "GOVERNMENT", "constitution-or-law"],
  ["Infobox national military", "MILITARY", undefined],
  ["Infobox national football team", "CULTURE", "sport"],
  ["Infobox Olympic games", "CULTURE", "sport"],
  ["Infobox film", "CULTURE", "media"],
  ["Infobox anthem", "CULTURE", "music"],
  ["Infobox national park", "GEOGRAPHY", "landmark"],
  ["Infobox ship begin", "MILITARY", "weapon-or-vehicle"],
  ["Infobox aircraft", "MILITARY", "weapon-or-vehicle"],
  ["Infobox aircraft begin", "MILITARY", "weapon-or-vehicle"],
  ["Infobox aircraft type", "MILITARY", "weapon-or-vehicle"],
  ["Infobox military aircraft", "MILITARY", "weapon-or-vehicle"],
  ["Infobox weapon", "MILITARY", "weapon-or-vehicle"],
])("maps the infobox %s to %s / %s", (template, category, subcategory) => {
  expect(infoboxTarget(template)?.target).toEqual(
    subcategory ? { category, subcategory } : { category }
  );
});

it("matches an infobox variant by the known name it extends", () => {
  expect(infoboxTarget("Infobox military person 2")).toEqual({
    target: { category: "PEOPLE", subcategory: "military-figure" },
    exact: false,
  });
  expect(infoboxTarget("Infobox academic institution 2")).toEqual({
    target: { category: "SCIENCE", subcategory: "institution" },
    exact: false,
  });
  expect(infoboxTarget("Infobox country")?.exact).toBe(true);
  expect(infoboxTarget("Cite web")).toBeNull();
  expect(templateKey("Template:Infobox_Country ")).toBe("infobox country");
});

it.each([
  "Infobox country 2",
  "Infobox country3",
  "Infobox country (old)",
  "Infobox country/status",
])("reads %s as a variant of Infobox country", (template) => {
  expect(infoboxTarget(template)).toEqual({
    target: { category: "NATION", subcategory: "nation" },
    exact: false,
  });
});

it.each([
  "Infobox countryside",
  "Infobox country club",
  "Infobox court of appeal",
  "Infobox pitz club",
  "Infobox country (old",
  "Infobox country 2 club",
  "Infobox country (old) club",
  "Infobox country club 2",
  "Infobox xyzzyq 2",
  "constructor",
  "toString",
])("reads %s as no known infobox", (template) => {
  expect(infoboxTarget(template)).toBeNull();
});

it("marks the infoboxes whose subcategory is only a default", () => {
  expect(infoboxTarget("Infobox settlement")?.target).toEqual({
    category: "GEOGRAPHY",
    subcategory: "city-or-settlement",
    fallback: true,
  });
  expect(infoboxTarget("Infobox military unit")?.target).toEqual({
    category: "MILITARY",
    subcategory: "unit",
    fallback: true,
  });
});

it("names only subcategories the taxonomy lists", () => {
  const rules = [
    ...Object.values(INFOBOX_RULES),
    ...SHARED_CATEGORY_RULES,
    ...Object.values(WIKI_CATEGORY_RULES).flat(),
  ];
  for (const { category, subcategory } of rules) {
    expect(isSubcategoryOf(category, subcategory ?? null)).toBe(true);
  }
});

it("lists the categories no rule reads, for the backfill report", () => {
  expect(
    unmappedCategories(
      ["Category:Urcea", "Category:Rivers of Urcea", "Pages with broken file links", "Urcea"],
      "ixwiki"
    )
  ).toEqual(["Urcea"]);
});

it("lists the infoboxes no rule reads, for the backfill report", () => {
  expect(
    unmappedInfoboxes([
      "Template:Infobox country",
      "Template:Infobox wine region",
      "Infobox_wine_region",
      "Template:Infobox countryside",
      "Template:Infobox country (old)",
      "Template:Cite web",
    ])
  ).toEqual(["infobox wine region", "infobox countryside"]);
});
