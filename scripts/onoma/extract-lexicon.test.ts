// Standalone seam check (jest only scans src/, so this runs via tsx):
//   bunx tsx scripts/onoma/extract-lexicon.test.ts
import assert from "node:assert";
import { titleToName, INFOBOX_CATEGORY } from "./extract-lexicon";

// titleToName decodes MediaWiki underscores + trims.
assert.equal(titleToName("New_Venceia"), "New Venceia");
assert.equal(titleToName("Rhys_I_of_Faneria"), "Rhys I of Faneria");
assert.equal(titleToName("  Trim_Me  "), "Trim Me");

// infobox→category map: no duplicate templates, all categories valid.
const valid = new Set(["country", "city", "province", "person", "organization"]);
const templates = INFOBOX_CATEGORY.map(([t]) => t);
assert.equal(new Set(templates).size, templates.length, "duplicate infobox template");
for (const [, cat] of INFOBOX_CATEGORY) assert.ok(valid.has(cat), `bad category ${cat}`);

console.log("extract-lexicon seam: OK");
