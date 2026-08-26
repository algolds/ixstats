import fs from "fs";

const DEFAULT_USER_AGENT = "IxStats-Builder";
const MEDIAWIKI_URL = "https://ixwiki.com";
const API_URL = `${MEDIAWIKI_URL}/api.php`;
const REPORT_FILE = "scripts/user_country_affinity_report.md";

const TOP_AUTHORS = [
  { name: "Urcea", edits: 22394 },
  { name: "Burgundie", edits: 11628 },
  { name: "Kir", edits: 9142 },
  { name: "Heku", edits: 6649 },
  { name: "Bobbo", edits: 6538 },
  { name: "Rumahoki", edits: 4954 },
  { name: "Insui", edits: 4690 },
  { name: "Kistan", edits: 4245 },
  { name: "Tierrador", edits: 3147 },
  { name: "Arco", edits: 2658 },
  { name: "Yonderre", edits: 2301 },
  { name: "Nasastan", edits: 1865 },
  { name: "Pelaxia", edits: 1267 },
  { name: "Valcenia", edits: 1150 },
  { name: "Galata", edits: 1147 },
  { name: "Metzetta", edits: 906 },
  { name: "Caldera", edits: 871 },
  { name: "Alstin", edits: 831 },
  { name: "Carthinova", edits: 514 },
  { name: "Hendalarsk", edits: 433 },
  { name: "Eldmora", edits: 432 },
  { name: "PotatoLover", edits: 392 },
  { name: "Puertego", edits: 386 },
  { name: "Diamavya", edits: 378 },
  { name: "Nolis", edits: 333 },
  { name: "Aciria", edits: 321 },
  { name: "Ralkern", edits: 315 },
  { name: "Drasenia", edits: 310 },
  { name: "David", edits: 306 },
  { name: "Olmeria", edits: 298 },
  { name: "Fiannria", edits: 294 },
  { name: "Akcelis", edits: 292 },
  { name: "Mazz38", edits: 292 },
  { name: "Chrobby", edits: 285 },
  { name: "Argyrea", edits: 267 },
  { name: "Takatta Loa", edits: 252 },
  { name: "Lambchops", edits: 198 },
  { name: "Farmandie", edits: 184 },
  { name: "Pauldustllah", edits: 175 },
  { name: "Asteria", edits: 145 },
  { name: "Grajnidar", edits: 127 },
  { name: "Helvianir", edits: 116 },
  { name: "Syliria", edits: 108 },
  { name: "Terazta", edits: 94 },
  { name: "Ogonkai", edits: 93 },
  { name: "Asteklion", edits: 86 },
  { name: "Qubuj", edits: 76 },
  { name: "Patraja", edits: 68 },
  { name: "Almadaria", edits: 67 },
  { name: "Sakartvelos", edits: 57 },
  { name: "Sketch", edits: 55 },
  { name: "Enserlano", edits: 42 },
  { name: "Yueguo", edits: 42 },
  { name: "Kloistan", edits: 41 },
  { name: "FrustratedProgressive", edits: 40 },
  { name: "Dectroia", edits: 39 },
  { name: "Aleajayib", edits: 37 },
  { name: "Unintra", edits: 36 },
  { name: "Arthur30", edits: 28 },
  { name: "Azikoria", edits: 24 },
  { name: "Ghebeek", edits: 24 },
  { name: "Orecula", edits: 21 },
  { name: "Tifosi30", edits: 20 },
  { name: "Jakee2", edits: 17 },
  { name: "Insulam", edits: 16 },
  { name: "Sassain", edits: 14 },
  { name: "Vesta", edits: 14 },
  { name: "Arctic", edits: 13 },
  { name: "Grussland", edits: 13 },
  { name: "Dhayavastan", edits: 12 },
  { name: "Thalaia", edits: 12 },
  { name: "Yytuskia-Helvana", edits: 11 },
  { name: "Music is a Drug", edits: 10 },
];

async function fetchUserTopPages(username: string): Promise<Array<{ title: string; count: number }>> {
  const url = new URL(API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "usercontribs");
  url.searchParams.set("ucuser", username);
  url.searchParams.set("uclimit", "250");
  url.searchParams.set("ucprop", "title|comment");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const contribs = data?.query?.usercontribs || [];

    const counts = new Map<string, number>();
    for (const c of contribs) {
      const title = String(c.title || "").trim();
      if (!title || title.startsWith("User:") || title.startsWith("User talk:") || title.startsWith("Template:") || title.startsWith("Category:")) {
        continue;
      }
      counts.set(title, (counts.get(title) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  } catch (e) {
    return [];
  }
}

async function main() {
  console.log(`Analyzing ${TOP_AUTHORS.length} top authors...`);

  interface Result {
    name: string;
    edits: number;
    topPages: Array<{ title: string; count: number }>;
  }

  const results: Result[] = [];

  for (let i = 0; i < TOP_AUTHORS.length; i++) {
    const a = TOP_AUTHORS[i];
    const topPages = await fetchUserTopPages(a.name);
    results.push({ name: a.name, edits: a.edits, topPages });
    await new Promise((r) => setTimeout(r, 60));
  }

  let md = `# Comprehensive MediaWiki ↔ Nation & Lore Domain Audit\n\n`;
  md += `**Audit Timestamp**: \`${new Date().toISOString()}\`\n`;
  md += `**Source**: IxWiki API Live Contributions Ledger\n\n`;

  md += `## 1. Executive Master Table: Author Persona ↔ Nation Mapping\n\n`;
  md += `| MediaWiki Author | Total Edits | Primary Nation Affiliation / Topic Focus | Top Edited Pages & Evidence |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;

  for (const r of results) {
    const pagesStr = r.topPages.map((p) => `• \`${p.title}\` (${p.count})`).join("<br/>") || "—";
    md += `| **${r.name}** | **${r.edits.toLocaleString()}** | *(Computed below)* | ${pagesStr} |\n`;
  }

  fs.writeFileSync(REPORT_FILE, md);
  fs.writeFileSync("scripts/top_authors_data.json", JSON.stringify(results, null, 2));
  console.log(`Saved analysis to ${REPORT_FILE} and scripts/top_authors_data.json`);
}

main().catch(console.error);
