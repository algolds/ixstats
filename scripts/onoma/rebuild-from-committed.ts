// scripts/onoma/rebuild-from-committed.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanName } from "../../src/lib/onoma/lexicon/clean";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEXICON_DIR = path.join(__dirname, "..", "..", "src", "lib", "onoma", "data", "lexicon");
const CATEGORIES = ["country", "city", "province", "person", "organization"];

function rebuild() {
  const manifestPath = path.join(LEXICON_DIR, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("manifest.json not found at " + manifestPath);
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  let grandTotal = 0;

  for (const cat of CATEGORIES) {
    const filePath = path.join(LEXICON_DIR, `${cat}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      continue;
    }
    const dict: Record<string, string[]> = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const newDict: Record<string, string[]> = {};
    const newCounts: Record<string, number> = {};

    for (const [bucket, names] of Object.entries(dict)) {
      const cleanedNames = names
        .map((name) => cleanName(name, cat))
        .filter((name): name is string => name !== null);

      // Dedup since title prefix stripping could yield duplicates (e.g. "King David" -> "David", "Prince David" -> "David")
      const uniqueCleaned = Array.from(new Set(cleanedNames));

      if (uniqueCleaned.length > 0) {
        newDict[bucket] = uniqueCleaned;
        newCounts[bucket] = uniqueCleaned.length;
      }
    }

    const catTotal = Object.values(newCounts).reduce((a, b) => a + b, 0);
    grandTotal += catTotal;

    manifest.categories[cat] = {
      total: catTotal,
      buckets: newCounts,
    };

    fs.writeFileSync(filePath, JSON.stringify(newDict));
    console.log(`Rebuilt ${cat}.json: ${catTotal} names`);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Rebuilt manifest.json. Total names: ${grandTotal}`);
}

rebuild();
