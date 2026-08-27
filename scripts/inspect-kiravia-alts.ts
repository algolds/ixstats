import fs from "fs";

const DEFAULT_USER_AGENT = "IxStats-Builder";
const MEDIAWIKI_URL = "https://ixwiki.com";
const API_URL = `${MEDIAWIKI_URL}/api.php`;

// Kiravian lore keywords and known articles
const KIRAVIA_KEYWORDS = [
  "Kiravia",
  "Kiravian",
  "North Varshan",
  "Varshan",
  "Bérasar",
  "Farravonia",
  "Caritist",
  "Mid-Atrassic",
  "Seváronsa",
  "Mérosar",
  "Merav",
  "Atrassia",
  "Carthinova",
  "Atrassic",
  "Déra",
  "Kavei",
  "Eret",
  "Savria",
  "Great Levantia",
];

async function fetchPageRevisions(
  title: string
): Promise<Array<{ user: string; timestamp: string }>> {
  const url = new URL(API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("titles", title);
  url.searchParams.set("rvprop", "user|timestamp");
  url.searchParams.set("rvlimit", "500");
  url.searchParams.set("rvdir", "older");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const pages = data?.query?.pages;
    if (!pages) return [];
    const pageKey = Object.keys(pages)[0];
    const revs = pages[pageKey]?.revisions;
    if (!Array.isArray(revs)) return [];
    return revs.map((r: any) => ({ user: r.user, timestamp: r.timestamp }));
  } catch {
    return [];
  }
}

async function main() {
  console.log("🔍 Inspecting Kiravia-related articles for author and alt accounts...");

  const targetArticles = [
    "Kiravia",
    "Constitutional history of Kiravia",
    "North Varshan",
    "Bérasar",
    "Farravonia",
    "Caritist Social Union",
    "Mid-Atrassic States",
    "Moonlight Keys",
    "Seváronsa",
    "Mérosar",
    "Merav",
    "Political ideologies in Kiravia",
    "Varshan",
    "Atrassia",
  ];

  const authorCounts = new Map<string, { totalEdits: number; pages: Set<string> }>();

  for (const title of targetArticles) {
    const revs = await fetchPageRevisions(title);
    for (const r of revs) {
      if (!r.user) continue;
      if (!authorCounts.has(r.user)) {
        authorCounts.set(r.user, { totalEdits: 0, pages: new Set() });
      }
      const rec = authorCounts.get(r.user)!;
      rec.totalEdits += 1;
      rec.pages.add(title);
    }
    await new Promise((r) => setTimeout(r, 60));
  }

  console.log("\nAuthors editing Kiravia & Atrassic Lore:");
  const sorted = Array.from(authorCounts.entries())
    .map(([user, data]) => ({ user, edits: data.totalEdits, pages: Array.from(data.pages) }))
    .sort((a, b) => b.edits - a.edits);

  for (const s of sorted) {
    console.log(`- ${s.user}: ${s.edits} edits across pages: [${s.pages.join(", ")}]`);
  }

  fs.writeFileSync("scripts/kiravia_alts_audit.json", JSON.stringify(sorted, null, 2));
}

main().catch(console.error);
