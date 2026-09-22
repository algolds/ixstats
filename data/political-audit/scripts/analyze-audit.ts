import fs from "fs";

interface AuditData {
  totalArticles: number;
  categoriesSummary: {
    governmentSubcats: string[];
    politicsSubcats: string[];
    ideologiesSubcats: string[];
    countriesSubcats: string[];
  };
  articles: Array<{
    title: string;
    categories: string[];
    length: number;
    snippet: string;
  }>;
}

const data: AuditData = JSON.parse(fs.readFileSync("/tmp/full_political_audit.json", "utf8"));
const entities = JSON.parse(fs.readFileSync("/tmp/political_entities.json", "utf8"));

console.log("=== CATEGORY AUDIT ===");
console.log("Ideology subcats:", data.categoriesSummary.ideologiesSubcats);
console.log("Government subcats sample (20):", data.categoriesSummary.governmentSubcats.slice(0, 20));
console.log("Politics subcats sample (20):", data.categoriesSummary.politicsSubcats.slice(0, 20));

console.log("\n=== IDEOLOGY ARTICLES ===");
console.log(`Found ${entities.ideologyCount} ideology articles:`);
for (const item of entities.ideologies) {
  console.log(`- ${item.title} (Categories: ${item.categories.join(", ")})`);
}

console.log("\n=== SAMPLE POLITICAL PARTIES ===");
console.log(`Found ${entities.partyCount} party articles:`);
const partiesByCountry: Record<string, string[]> = {};
for (const p of entities.parties) {
  const countryCat = p.categories.find(c => !c.toLowerCase().includes("part") && !c.toLowerCase().includes("politic"));
  const key = countryCat || "Other";
  if (!partiesByCountry[key]) partiesByCountry[key] = [];
  partiesByCountry[key].push(p.title);
}

for (const [country, parties] of Object.entries(partiesByCountry).slice(0, 25)) {
  console.log(`\n[${country}] (${parties.length} parties):`);
  console.log(`  ${parties.slice(0, 8).join(", ")}${parties.length > 8 ? "..." : ""}`);
}

// Search for key terms in wikitext snippets
const terms = [
  "left-wing", "right-wing", "centrist", "conservative", "liberal",
  "socialist", "syndicalist", "fascist", "nationalist", "monarchist",
  "reactionary", "communitarian", "individualist", "organic", "continuist",
  "rupture", "corporatist", "quaternalist", "triumvirate", "traditionalist"
];

const termCounts: Record<string, number> = {};
for (const term of terms) {
  const re = new RegExp(`\\b${term}\\b`, "i");
  termCounts[term] = data.articles.filter(a => re.test(a.snippet)).length;
}

console.log("\n=== DISCOURSE & TERMINOLOGY FREQUENCY IN INTROS ===");
console.table(termCounts);
