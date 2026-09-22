import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import zlib from "zlib";

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

function decompressText(raw: any, flags: string): string {
  if (!raw) return "";
  if (flags && flags.includes("gzip") && Buffer.isBuffer(raw)) {
    try {
      return zlib.inflateRawSync(raw).toString("utf-8");
    } catch {
      try {
        return zlib.gunzipSync(raw).toString("utf-8");
      } catch {
        try {
          return zlib.inflateSync(raw).toString("utf-8");
        } catch {
          return raw.toString("utf-8");
        }
      }
    }
  }
  if (Buffer.isBuffer(raw)) return raw.toString("utf-8");
  return String(raw);
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
  console.log("==================================================================");
  console.log("AUTHORITATIVE AUDIT: Category:Politics & Related Political Lore");
  console.log("==================================================================");

  const conn = await mysql.createConnection({
    host: IXWIKI_DB_HOST,
    port: IXWIKI_DB_PORT,
    user: IXWIKI_DB_USER,
    password: IXWIKI_DB_PASSWORD,
    database: IXWIKI_DB_NAME,
    charset: "utf8mb4",
  });

  console.log("Connected to MariaDB.");

  // Root categories to explore:
  // 1. Core Category:Politics and all its descendants
  // 2. Plus explicitly discovered unparented country politics/governance categories
  const rootCategories = [
    "Politics",
    "Government",
    "Politics_of_Cartadania",
    "Politics_of_Castadilla",
    "Politics_of_Tierrador",
    "Politics_of_Great_Levantia",
    "Coburian_politics",
    "Government_of_Cartadania",
    "Government_of_Castadilla",
    "Government_of_Caphiria",
    "Government_of_Burgundie",
    "Government_of_Urcea",
    "Government_of_Nasastan",
    "Government_of_Olmeria",
    "Law_of_Cartadania",
    "Laws_of_Caphiria",
  ];

  const queue: string[] = [...rootCategories];
  const visitedCats = new Set<string>();
  const catTree: Record<string, { parentCategories: string[]; subcategories: string[]; articleCount: number }> = {};
  const articleCategoryMap = new Map<string, Set<string>>();
  const allDiscoveredPages = new Map<number, { page_id: number; title: string; namespace: number }>();

  // Track Category:Politics strict subcategories separately
  const strictPoliticsSubcats = new Set<string>();
  const strictPoliticsQueue = ["politics"];
  strictPoliticsSubcats.add("politics");

  while (strictPoliticsQueue.length > 0) {
    const cur = strictPoliticsQueue.shift()!;
    const [subrows]: any = await conn.execute(
      `SELECT CONVERT(p.page_title USING utf8mb4) as title
       FROM categorylinks cl
       JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
       JOIN page p ON cl.cl_from = p.page_id
       WHERE lt.lt_namespace = 14 
         AND LOWER(CONVERT(lt.lt_title USING utf8mb4)) = LOWER(?)
         AND p.page_namespace = 14`,
      [cur]
    );
    for (const r of subrows) {
      const t = r.title.toLowerCase();
      if (!strictPoliticsSubcats.has(t)) {
        strictPoliticsSubcats.add(t);
        strictPoliticsQueue.push(t);
      }
    }
  }
  console.log(`Strict Category:Politics subcategory tree contains: ${strictPoliticsSubcats.size} categories.`);

  // Full traversal across all political roots
  while (queue.length > 0) {
    const currentCat = queue.shift()!;
    const normKey = currentCat.toLowerCase();
    if (visitedCats.has(normKey)) continue;
    visitedCats.add(normKey);

    if (!catTree[currentCat]) {
      catTree[currentCat] = { parentCategories: [], subcategories: [], articleCount: 0 };
    }

    const [rows]: any = await conn.execute(
      `SELECT p.page_id, CONVERT(p.page_title USING utf8mb4) as title, p.page_namespace
       FROM categorylinks cl
       JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
       JOIN page p ON cl.cl_from = p.page_id
       WHERE lt.lt_namespace = 14 AND LOWER(CONVERT(lt.lt_title USING utf8mb4)) = LOWER(?)`,
      [currentCat]
    );

    for (const row of rows) {
      const title = row.title;
      const ns = row.page_namespace;

      if (ns === 14) {
        // Subcategory
        catTree[currentCat].subcategories.push(title);
        if (!catTree[title]) {
          catTree[title] = { parentCategories: [], subcategories: [], articleCount: 0 };
        }
        catTree[title].parentCategories.push(currentCat);

        if (!visitedCats.has(title.toLowerCase())) {
          // Avoid exploding into non-political trees (e.g. universities, all companies)
          const lowerTitle = title.toLowerCase();
          const skipPatterns = ["university", "universities", "football", "stadium", "railway", "airline"];
          if (!skipPatterns.some((sp) => lowerTitle.includes(sp))) {
            queue.push(title);
          }
        }
      } else if (ns === 0) {
        // Article
        catTree[currentCat].articleCount++;
        allDiscoveredPages.set(row.page_id, {
          page_id: row.page_id,
          title,
          namespace: ns,
        });

        if (!articleCategoryMap.has(title)) {
          articleCategoryMap.set(title, new Set());
        }
        articleCategoryMap.get(title)!.add(currentCat);
      }
    }
  }

  console.log(`Total explored categories: ${visitedCats.size}`);
  console.log(`Total unique articles found: ${allDiscoveredPages.size}`);

  // Fetch full wikitext + flags for all articles
  const pageIdArray = Array.from(allDiscoveredPages.keys());
  const articlesList: Array<{
    page_id: number;
    title: string;
    categories: string[];
    isStrictPolitics: boolean;
    length: number;
    wikitext: string;
    infoboxCountry?: any;
    infoboxParty?: any;
    infoboxGovernment?: any;
    infoboxMilitant?: any;
  }> = [];

  const CHUNK_SIZE = 150;
  console.log(`Fetching wikitext and decompressing for ${pageIdArray.length} articles...`);

  for (let i = 0; i < pageIdArray.length; i += CHUNK_SIZE) {
    const chunk = pageIdArray.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");

    const [rows]: any = await conn.execute(
      `SELECT p.page_id, CONVERT(p.page_title USING utf8mb4) as page_title, p.page_len, 
              t.old_flags, t.old_text
       FROM page p
       JOIN revision r ON p.page_latest = r.rev_id
       JOIN slots s ON s.slot_revision_id = r.rev_id
       JOIN content c ON s.slot_content_id = c.content_id
       JOIN text t ON t.old_id = CAST(SUBSTRING(c.content_address, 4) AS UNSIGNED)
       WHERE p.page_id IN (${placeholders})`,
      chunk
    );

    for (const r of rows) {
      const title = r.page_title;
      const flags = r.old_flags ? toUtf8(r.old_flags) : "";
      const rawText = r.old_text;
      const text = decompressText(rawText, flags);
      const cats = Array.from(articleCategoryMap.get(title) || []);
      const isStrict = cats.some((c) => strictPoliticsSubcats.has(c.toLowerCase()));

      // Infobox Country
      let infoboxCountry: any = null;
      if (text.includes("{{Infobox country") || text.includes("{{Infobox former country")) {
        const gov = text.match(/\|\s*government_type\s*=\s*([^\n|]+)/i) || text.match(/\|\s*government\s*=\s*([^\n|]+)/i);
        const leader = text.match(/\|\s*leader_title\s*=\s*([^\n|]+)/i) || text.match(/\|\s*head_of_state\s*=\s*([^\n|]+)/i);
        const leg = text.match(/\|\s*legislature\s*=\s*([^\n|]+)/i);
        infoboxCountry = {
          government_type: gov ? cleanWikitext(gov[1]) : undefined,
          leader: leader ? cleanWikitext(leader[1]) : undefined,
          legislature: leg ? cleanWikitext(leg[1]) : undefined,
        };
      }

      // Infobox Political Party
      let infoboxParty: any = null;
      if (text.includes("{{Infobox political party") || text.includes("{{Infobox political organisation")) {
        const name = text.match(/\|\s*name\s*=\s*([^\n|]+)/i);
        const ideo = text.match(/\|\s*ideology\s*=\s*([^\n|]+)/i);
        const pos = text.match(/\|\s*position\s*=\s*([^\n|]+)/i);
        const country = text.match(/\|\s*country\s*=\s*([^\n|]+)/i);
        infoboxParty = {
          name: name ? cleanWikitext(name[1]) : title.replace(/_/g, " "),
          ideology: ideo ? cleanWikitext(ideo[1]) : undefined,
          position: pos ? cleanWikitext(pos[1]) : undefined,
          country: country ? cleanWikitext(country[1]) : undefined,
        };
      }

      // Infobox Government
      let infoboxGovernment: any = null;
      if (text.includes("{{Infobox government")) {
        const name = text.match(/\|\s*government_name\s*=\s*([^\n|]+)/i);
        const country = text.match(/\|\s*country\s*=\s*([^\n|]+)/i);
        const leg = text.match(/\|\s*legislature\s*=\s*([^\n|]+)/i);
        infoboxGovernment = {
          name: name ? cleanWikitext(name[1]) : title.replace(/_/g, " "),
          country: country ? cleanWikitext(country[1]) : undefined,
          legislature: leg ? cleanWikitext(leg[1]) : undefined,
        };
      }

      // Infobox Militant / Political Movement
      let infoboxMilitant: any = null;
      if (text.includes("{{Infobox militant organization")) {
        const name = text.match(/\|\s*name\s*=\s*([^\n|]+)/i);
        const ideo = text.match(/\|\s*ideology\s*=\s*([^\n|]+)/i);
        const pos = text.match(/\|\s*position\s*=\s*([^\n|]+)/i);
        infoboxMilitant = {
          name: name ? cleanWikitext(name[1]) : title.replace(/_/g, " "),
          ideology: ideo ? cleanWikitext(ideo[1]) : undefined,
          position: pos ? cleanWikitext(pos[1]) : undefined,
        };
      }

      articlesList.push({
        page_id: r.page_id,
        title,
        categories: cats,
        isStrictPolitics: isStrict,
        length: r.page_len,
        wikitext: text,
        infoboxCountry,
        infoboxParty,
        infoboxGovernment,
        infoboxMilitant,
      });
    }
  }

  console.log(`Fetched and verified ${articlesList.length} articles.`);

  // Write comprehensive JSON dumps to data/political-audit
  const outDir = "/home/jxsig/projects/ixstats/data/political-audit";

  // 1. Category:Politics Full Audit
  const auditReport = {
    timestamp: new Date().toISOString(),
    strictPoliticsTree: {
      rootCategory: "Category:Politics",
      totalStrictSubcategories: strictPoliticsSubcats.size,
      subcategories: Array.from(strictPoliticsSubcats).sort(),
      totalStrictArticles: articlesList.filter((a) => a.isStrictPolitics).length,
    },
    totalExploredCategories: visitedCats.size,
    totalArticles: articlesList.length,
    categoryHierarchy: catTree,
    articles: articlesList.map((a) => ({
      page_id: a.page_id,
      title: a.title,
      categories: a.categories,
      isStrictPolitics: a.isStrictPolitics,
      length: a.length,
      snippet: a.wikitext.slice(0, 1200),
      infoboxCountry: a.infoboxCountry,
      infoboxParty: a.infoboxParty,
      infoboxGovernment: a.infoboxGovernment,
      infoboxMilitant: a.infoboxMilitant,
    })),
  };

  fs.writeFileSync(
    `${outDir}/category_politics_full_audit.json`,
    JSON.stringify(auditReport, null, 2)
  );

  // 2. Specific entities: Parties, Ideologies, Governments, Political Movements
  const partiesOnly = articlesList.filter(
    (a) =>
      a.infoboxParty != null ||
      a.title.toLowerCase().includes("party") ||
      a.categories.some((c) => c.toLowerCase().includes("political_parties"))
  );

  const ideologiesOnly = articlesList.filter(
    (a) =>
      a.categories.some((c) => c.toLowerCase().includes("ideolog")) ||
      a.title.toLowerCase().includes("ideology") ||
      a.title.toLowerCase().includes("socialism") ||
      a.title.toLowerCase().includes("liberalism") ||
      a.title.toLowerCase().includes("conservatism") ||
      a.title.toLowerCase().includes("nationalism") ||
      a.title.toLowerCase().includes("communism") ||
      a.title.toLowerCase().includes("republicanism") ||
      a.title.toLowerCase().includes("foralism") ||
      a.title.toLowerCase().includes("shaftonism") ||
      a.title.toLowerCase().includes("bairdism") ||
      a.title.toLowerCase().includes("kaidoism") ||
      a.title.toLowerCase().includes("kallistocracy")
  );

  const governmentsOnly = articlesList.filter(
    (a) =>
      a.infoboxGovernment != null ||
      a.title.toLowerCase().includes("government_of") ||
      a.title.toLowerCase().includes("politics_of") ||
      a.title.toLowerCase().includes("constitution")
  );

  console.log(`Discovered Entities:
    - Political Parties: ${partiesOnly.length}
    - Ideologies: ${ideologiesOnly.length}
    - Governments & Constitutions: ${governmentsOnly.length}
  `);

  fs.writeFileSync(
    `${outDir}/category_politics_entities.json`,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalParties: partiesOnly.length,
        parties: partiesOnly.map((p) => ({
          title: p.title,
          categories: p.categories,
          infobox: p.infoboxParty,
          snippet: p.wikitext.slice(0, 1000),
        })),
        totalIdeologies: ideologiesOnly.length,
        ideologies: ideologiesOnly.map((i) => ({
          title: i.title,
          categories: i.categories,
          snippet: i.wikitext.slice(0, 1000),
        })),
        totalGovernments: governmentsOnly.length,
        governments: governmentsOnly.map((g) => ({
          title: g.title,
          categories: g.categories,
          infobox: g.infoboxGovernment,
          snippet: g.wikitext.slice(0, 1000),
        })),
      },
      null,
      2
    )
  );

  console.log("Authoritative audit complete! Output written to data/political-audit/");
  await conn.end();
}

main().catch(console.error);
