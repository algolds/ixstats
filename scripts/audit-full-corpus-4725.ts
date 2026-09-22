import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const IXWIKI_DB_HOST = process.env.IXWIKI_DB_HOST || "localhost";
const IXWIKI_DB_PORT = parseInt(process.env.IXWIKI_DB_PORT || "13306", 10);
const IXWIKI_DB_USER = process.env.IXWIKI_DB_USER || "ixwiki";
const IXWIKI_DB_PASSWORD = process.env.IXWIKI_DB_PASSWORD || "Multico1!";
const IXWIKI_DB_NAME = process.env.IXWIKI_DB_NAME || "ixwiki";

function toUtf8(val: any): string {
  if (val == null) return "";
  if (Buffer.isBuffer(val)) return val.toString("utf8");
  return String(val);
}

function cleanWikitext(text: string): string {
  return text
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/'''''/g, "")
    .replace(/'''/g, "")
    .replace(/''/g, "")
    .trim();
}

async function main() {
  console.log("=== STARTING FULL CORPUS AUDIT (ALL ARTICLES) ===");
  console.log("Connecting to MariaDB on port", IXWIKI_DB_PORT);
  const conn = await mysql.createConnection({
    host: IXWIKI_DB_HOST,
    port: IXWIKI_DB_PORT,
    user: IXWIKI_DB_USER,
    password: IXWIKI_DB_PASSWORD,
    database: IXWIKI_DB_NAME,
    charset: "utf8mb4",
  });

  console.log("Connected to MariaDB.");

  // 1. Fetch ALL non-redirect pages in namespace 0
  const [pages]: any = await conn.execute(
    `SELECT page_id, page_title, page_len, page_latest 
     FROM page 
     WHERE page_namespace = 0 AND page_is_redirect = 0 
     ORDER BY page_id ASC`
  );

  console.log(`Total non-redirect articles in entire wiki: ${pages.length}`);

  // 2. Fetch all category links for all pages
  console.log("Fetching all category links...");
  const pageCategories = new Map<number, string[]>();
  const [catRows]: any = await conn.execute(
    `SELECT cl.cl_from, lt.lt_title
     FROM categorylinks cl
     JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
     WHERE lt.lt_namespace = 14`
  );

  for (const row of catRows) {
    const pageId = row.cl_from;
    const catTitle = toUtf8(row.lt_title);
    if (!pageCategories.has(pageId)) {
      pageCategories.set(pageId, []);
    }
    pageCategories.get(pageId)!.push(catTitle);
  }
  console.log(`Mapped category links for ${pageCategories.size} pages.`);

  // 3. Define comprehensive vocabulary to scan
  const vocabulary = [
    // Institutions & Governance forms
    "monarchy", "republic", "federation", "confederation", "empire", "imperium",
    "theocracy", "stratocracy", "directorate", "thalattocracy", "diarchy", "tetrarchy",
    "consociational", "unitary", "fueros", "parliament", "senate", "diet", "assembly",
    "synod", "council", "directorate", "landsmeet", "corcillum", "pacta conventa",
    
    // Civic & Social Status
    "subject", "citizen", "estate", "ordo", "caste", "guild", "nobility", "patrician",
    "plebeian", "vestiary", "sumptuary", "aristocracy", "commons", "bourgeois", "clans",
    
    // Economic & Property Concepts
    "commonweal", "distributism", "socialism", "syndicalism", "capitalism", "mercantilism",
    "corporatism", "tripartism", "dirigisme", "free trade", "protectionism", "cooperative",
    "common ownership", "employee stock", "model economy", "sodalitates", "monopoly", "cartel",
    
    // Religious & Philosophical Traditions
    "catholic", "apostolic", "shaftonism", "devinism", "zmoric", "kallistocracy", "lakhe'zic",
    "organicism", "foralism", "crown liberalism", "nolanism", "kirosocialism", "bairdism",
    "secularism", "moral law", "divine right", "social contract", "anti-clerical",
    
    // Regional & Civilizational Spheres
    "levantia", "sarpedon", "crona", "audonia", "orient", "coscivia", "occident", "latin",
    "gothic", "gaelic", "fiannrian", "daxian", "kiravian", "caphirian", "urcean", "burgoignesc"
  ];

  const termCounts: Record<string, number> = {};
  const termArticles: Record<string, string[]> = {};
  const cooccurrence: Record<string, Record<string, number>> = {};

  for (const term of vocabulary) {
    termCounts[term] = 0;
    termArticles[term] = [];
    cooccurrence[term] = {};
  }

  // 4. Containers for discovered entities
  const countriesDiscovered: Array<{
    page_id: number;
    title: string;
    government_type?: string;
    leader?: string;
    legislature?: string;
    religion?: string;
    region?: string;
    categories: string[];
    snippet: string;
  }> = [];

  const partiesDiscovered: Array<{
    page_id: number;
    title: string;
    party_name?: string;
    ideology?: string;
    position?: string;
    country?: string;
    categories: string[];
    snippet: string;
  }> = [];

  const ideologyArticlesDiscovered: Array<{
    page_id: number;
    title: string;
    categories: string[];
    snippet: string;
  }> = [];

  // Regional distribution tracking
  const regionalBreakdown: Record<string, number> = {
    Levantia: 0,
    Sarpedon: 0,
    Crona: 0,
    Audonia: 0,
    Orient: 0,
    Coscivia: 0,
    Other: 0,
  };

  console.log("Fetching wikitext in chunks across all 4,725 articles...");
  const CHUNK_SIZE = 150;
  let processedCount = 0;

  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    const chunk = pages.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");
    const pageIds = chunk.map((p: any) => p.page_id);

    const [rows]: any = await conn.execute(
      `SELECT p.page_id, p.page_title, t.old_text
       FROM page p
       JOIN revision r ON p.page_latest = r.rev_id
       JOIN slots s ON s.slot_revision_id = r.rev_id
       JOIN content c ON s.slot_content_id = c.content_id
       JOIN text t ON t.old_id = CAST(SUBSTRING(c.content_address, 4) AS UNSIGNED)
       WHERE p.page_id IN (${placeholders})`,
      pageIds
    );

    for (const r of rows) {
      const pageId = r.page_id;
      const title = toUtf8(r.page_title);
      const text = toUtf8(r.old_text);
      const lowerText = text.toLowerCase();
      const cats = pageCategories.get(pageId) || [];

      // Determine regional affiliation
      let matchedRegion = false;
      if (lowerText.includes("levantia") || cats.some(c => c.toLowerCase().includes("levant"))) {
        regionalBreakdown.Levantia++;
        matchedRegion = true;
      }
      if (lowerText.includes("sarpedon") || cats.some(c => c.toLowerCase().includes("sarpedon"))) {
        regionalBreakdown.Sarpedon++;
        matchedRegion = true;
      }
      if (lowerText.includes("crona") || cats.some(c => c.toLowerCase().includes("crona"))) {
        regionalBreakdown.Crona++;
        matchedRegion = true;
      }
      if (lowerText.includes("audonia") || cats.some(c => c.toLowerCase().includes("audonia"))) {
        regionalBreakdown.Audonia++;
        matchedRegion = true;
      }
      if (lowerText.includes("orient") || lowerText.includes("daxia") || cats.some(c => c.toLowerCase().includes("daxia"))) {
        regionalBreakdown.Orient++;
        matchedRegion = true;
      }
      if (lowerText.includes("kiravia") || lowerText.includes("cosciv") || cats.some(c => c.toLowerCase().includes("krv") || c.toLowerCase().includes("kiravia"))) {
        regionalBreakdown.Coscivia++;
        matchedRegion = true;
      }
      if (!matchedRegion) {
        regionalBreakdown.Other++;
      }

      // Check for country infobox
      if (text.includes("{{Infobox country") || text.includes("{{Infobox former country")) {
        const govM = text.match(/\|\s*government_type\s*=\s*([^\n|]+)/i) || text.match(/\|\s*government\s*=\s*([^\n|]+)/i);
        const leaderM = text.match(/\|\s*leader_title\s*=\s*([^\n|]+)/i) || text.match(/\|\s*head_of_state\s*=\s*([^\n|]+)/i);
        const legM = text.match(/\|\s*legislature\s*=\s*([^\n|]+)/i);
        const relM = text.match(/\|\s*religion\s*=\s*([^\n|]+)/i);

        countriesDiscovered.push({
          page_id: pageId,
          title,
          government_type: govM ? cleanWikitext(govM[1]) : undefined,
          leader: leaderM ? cleanWikitext(leaderM[1]) : undefined,
          legislature: legM ? cleanWikitext(legM[1]) : undefined,
          religion: relM ? cleanWikitext(relM[1]) : undefined,
          categories: cats,
          snippet: text.slice(0, 1000),
        });
      }

      // Check for political party infobox or title
      if (text.includes("{{Infobox political party") || title.toLowerCase().includes("party") || cats.some(c => c.toLowerCase().includes("political_parties"))) {
        const ideoM = text.match(/\|\s*ideology\s*=\s*([^\n|]+)/i);
        const posM = text.match(/\|\s*position\s*=\s*([^\n|]+)/i);
        const countryM = text.match(/\|\s*country\s*=\s*([^\n|]+)/i);
        const nameM = text.match(/\|\s*name\s*=\s*([^\n|]+)/i);

        partiesDiscovered.push({
          page_id: pageId,
          title,
          party_name: nameM ? cleanWikitext(nameM[1]) : title,
          ideology: ideoM ? cleanWikitext(ideoM[1]) : undefined,
          position: posM ? cleanWikitext(posM[1]) : undefined,
          country: countryM ? cleanWikitext(countryM[1]) : undefined,
          categories: cats,
          snippet: text.slice(0, 1200),
        });
      }

      // Check for ideology article
      if (cats.some(c => c.toLowerCase().includes("ideolog")) || lowerText.includes("is an ideology") || lowerText.includes("is a political philosophy")) {
        ideologyArticlesDiscovered.push({
          page_id: pageId,
          title,
          categories: cats,
          snippet: text.slice(0, 1500),
        });
      }

      // Vocabulary scanning and co-occurrence
      const matchedInDoc: string[] = [];
      for (const term of vocabulary) {
        const re = new RegExp(`\\b${term}\\b`, "i");
        if (re.test(lowerText)) {
          termCounts[term]++;
          matchedInDoc.push(term);
          if (termArticles[term].length < 15) {
            termArticles[term].push(title);
          }
        }
      }

      // Co-occurrence
      for (let m1 = 0; m1 < matchedInDoc.length; m1++) {
        for (let m2 = m1 + 1; m2 < matchedInDoc.length; m2++) {
          const t1 = matchedInDoc[m1];
          const t2 = matchedInDoc[m2];
          cooccurrence[t1][t2] = (cooccurrence[t1][t2] || 0) + 1;
          cooccurrence[t2][t1] = (cooccurrence[t2][t1] || 0) + 1;
        }
      }
    }

    processedCount += chunk.length;
    if (processedCount % 600 === 0 || processedCount >= pages.length) {
      console.log(`Processed ${processedCount} / ${pages.length} articles (${Math.round((processedCount / pages.length) * 100)}%)...`);
    }
  }

  console.log("=== FULL CORPUS SCAN COMPLETE ===");
  console.log(`Discovered:
    - Total Non-Redirect Articles: ${pages.length}
    - Country Entities: ${countriesDiscovered.length}
    - Political Parties: ${partiesDiscovered.length}
    - Political Ideologies: ${ideologyArticlesDiscovered.length}
  `);
  console.log("Regional mentions across corpus:", regionalBreakdown);

  // Write out authoritative data dumps to data/political-audit/
  const outDir = "/home/jxsig/projects/ixstats/data/political-audit";

  // 1. Full corpus statistics
  fs.writeFileSync(
    `${outDir}/entire_wiki_spectrum_stats.json`,
    JSON.stringify(
      {
        totalArticlesAudited: pages.length,
        regionalDistribution: regionalBreakdown,
        termCounts,
        termSamples: termArticles,
        topCooccurrences: Object.entries(cooccurrence).map(([term, pairs]) => ({
          term,
          topCorrelations: Object.entries(pairs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([pairTerm, count]) => ({ term: pairTerm, count })),
        })),
      },
      null,
      2
    )
  );

  // 2. Extracted political entities across entire wiki
  fs.writeFileSync(
    `${outDir}/entire_wiki_political_entities.json`,
    JSON.stringify(
      {
        totalCountries: countriesDiscovered.length,
        countries: countriesDiscovered,
        totalParties: partiesDiscovered.length,
        parties: partiesDiscovered,
        totalIdeologies: ideologyArticlesDiscovered.length,
        ideologies: ideologyArticlesDiscovered,
      },
      null,
      2
    )
  );

  // 3. Deep dive comparative text file across all continents
  let deepText = `=== ENTIRE WIKI CORPUS AUDIT (${pages.length} ARTICLES) ===\n`;
  deepText += `Date: ${new Date().toISOString()}\n\n`;
  deepText += `=== REGIONAL DISTRIBUTION ===\n${JSON.stringify(regionalBreakdown, null, 2)}\n\n`;
  deepText += `=== ALL DISCOVERED IDEOLOGIES (${ideologyArticlesDiscovered.length}) ===\n`;
  for (const ideo of ideologyArticlesDiscovered) {
    deepText += `\n[IDEOLOGY] ${ideo.title}\n`;
    deepText += `Categories: ${ideo.categories.join(", ")}\n`;
    deepText += `Snippet:\n${ideo.snippet}\n-----------------------------------------\n`;
  }

  deepText += `\n\n=== SAMPLE OF COUNTRIES ACROSS ALL REGIONS (${countriesDiscovered.length} TOTAL) ===\n`;
  for (const c of countriesDiscovered) {
    deepText += `\n[COUNTRY] ${c.title} | Gov: ${c.government_type || "N/A"} | Leader: ${c.leader || "N/A"} | Leg: ${c.legislature || "N/A"}\n`;
    deepText += `Categories: ${c.categories.join(", ")}\n`;
  }

  deepText += `\n\n=== SAMPLE OF POLITICAL PARTIES (${partiesDiscovered.length} TOTAL) ===\n`;
  for (const p of partiesDiscovered) {
    deepText += `\n[PARTY] ${p.title} | Party: ${p.party_name || "N/A"} | Country: ${p.country || "N/A"} | Ideology: ${p.ideology || "N/A"} | Position: ${p.position || "N/A"}\n`;
  }

  fs.writeFileSync(`${outDir}/entire_wiki_deep_dive.txt`, deepText);

  console.log(`Saved comprehensive audits to:
    - ${outDir}/entire_wiki_spectrum_stats.json
    - ${outDir}/entire_wiki_political_entities.json
    - ${outDir}/entire_wiki_deep_dive.txt
  `);

  await conn.end();
}

main().catch(console.error);
