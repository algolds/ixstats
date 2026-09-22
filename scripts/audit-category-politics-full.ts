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
  console.log("=== AUDITING CATEGORY:POLITICS AND ALL SUBCATEGORIES ===");
  const conn = await mysql.createConnection({
    host: IXWIKI_DB_HOST,
    port: IXWIKI_DB_PORT,
    user: IXWIKI_DB_USER,
    password: IXWIKI_DB_PASSWORD,
    database: IXWIKI_DB_NAME,
    charset: "utf8mb4",
  });

  console.log("Connected to MariaDB.");

  // BFS Queue for Category:Politics
  const queue: string[] = ["Politics"];
  const visitedCats = new Set<string>();
  const catTree: Record<string, { parentCategories: string[]; subcategories: string[]; articleCount: number }> = {};
  const articleCategoryMap = new Map<string, Set<string>>();
  const allDiscoveredPages = new Map<number, { page_id: number; title: string; namespace: number }>();

  while (queue.length > 0) {
    const currentCat = queue.shift()!;
    const normKey = currentCat.toLowerCase();
    if (visitedCats.has(normKey)) continue;
    visitedCats.add(normKey);

    if (!catTree[currentCat]) {
      catTree[currentCat] = { parentCategories: [], subcategories: [], articleCount: 0 };
    }

    const [rows]: any = await conn.execute(
      `SELECT p.page_id, p.page_title, p.page_namespace
       FROM categorylinks cl
       JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
       JOIN page p ON cl.cl_from = p.page_id
       WHERE lt.lt_namespace = 14 AND LOWER(CONVERT(lt.lt_title USING utf8mb4)) = LOWER(?)`,
      [currentCat]
    );

    for (const row of rows) {
      const title = toUtf8(row.page_title);
      const ns = row.page_namespace;

      if (ns === 14) {
        // It is a subcategory
        catTree[currentCat].subcategories.push(title);
        if (!catTree[title]) {
          catTree[title] = { parentCategories: [], subcategories: [], articleCount: 0 };
        }
        catTree[title].parentCategories.push(currentCat);

        if (!visitedCats.has(title.toLowerCase())) {
          queue.push(title);
        }
      } else if (ns === 0) {
        // It is an article
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

  console.log(`\n=== CATEGORY TREE TRAVERSAL FINISHED ===`);
  console.log(`Total subcategories explored under Category:Politics: ${visitedCats.size}`);
  console.log(`Total unique articles (namespace 0) found: ${allDiscoveredPages.size}`);

  // Fetch full wikitext for all articles in Category:Politics tree
  const pageIdArray = Array.from(allDiscoveredPages.keys());
  const articlesList: Array<{
    page_id: number;
    title: string;
    categories: string[];
    length: number;
    wikitext: string;
    infoboxCountry?: any;
    infoboxParty?: any;
    infoboxGovernment?: any;
  }> = [];

  const CHUNK_SIZE = 150;
  console.log(`Fetching wikitext for ${pageIdArray.length} articles in chunks of ${CHUNK_SIZE}...`);

  for (let i = 0; i < pageIdArray.length; i += CHUNK_SIZE) {
    const chunk = pageIdArray.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");

    const [rows]: any = await conn.execute(
      `SELECT p.page_id, p.page_title, p.page_len, t.old_text
       FROM page p
       JOIN revision r ON p.page_latest = r.rev_id
       JOIN slots s ON s.slot_revision_id = r.rev_id
       JOIN content c ON s.slot_content_id = c.content_id
       JOIN text t ON t.old_id = CAST(SUBSTRING(c.content_address, 4) AS UNSIGNED)
       WHERE p.page_id IN (${placeholders})`,
      chunk
    );

    for (const r of rows) {
      const title = toUtf8(r.page_title);
      const text = toUtf8(r.old_text);
      const cats = Array.from(articleCategoryMap.get(title) || []);

      // Detect infoboxes
      let infoboxCountry: any = null;
      let infoboxParty: any = null;
      let infoboxGovernment: any = null;

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

      if (text.includes("{{Infobox political party") || text.includes("{{Infobox political organisation")) {
        const name = text.match(/\|\s*name\s*=\s*([^\n|]+)/i);
        const ideo = text.match(/\|\s*ideology\s*=\s*([^\n|]+)/i);
        const pos = text.match(/\|\s*position\s*=\s*([^\n|]+)/i);
        const country = text.match(/\|\s*country\s*=\s*([^\n|]+)/i);
        infoboxParty = {
          name: name ? cleanWikitext(name[1]) : title,
          ideology: ideo ? cleanWikitext(ideo[1]) : undefined,
          position: pos ? cleanWikitext(pos[1]) : undefined,
          country: country ? cleanWikitext(country[1]) : undefined,
        };
      }

      if (text.includes("{{Infobox government")) {
        const name = text.match(/\|\s*government_name\s*=\s*([^\n|]+)/i);
        const country = text.match(/\|\s*country\s*=\s*([^\n|]+)/i);
        const leg = text.match(/\|\s*legislature\s*=\s*([^\n|]+)/i);
        infoboxGovernment = {
          name: name ? cleanWikitext(name[1]) : title,
          country: country ? cleanWikitext(country[1]) : undefined,
          legislature: leg ? cleanWikitext(leg[1]) : undefined,
        };
      }

      articlesList.push({
        page_id: r.page_id,
        title,
        categories: cats,
        length: r.page_len,
        wikitext: text,
        infoboxCountry,
        infoboxParty,
        infoboxGovernment,
      });
    }
  }

  console.log(`Successfully fetched text for ${articlesList.length} articles.`);

  // Write out comprehensive Politics audit files
  const outDir = "/home/jxsig/projects/ixstats/data/political-audit";

  const auditReport = {
    rootCategory: "Category:Politics",
    totalSubcategories: visitedCats.size,
    subcategoriesList: Array.from(visitedCats),
    categoryHierarchy: catTree,
    totalArticles: articlesList.length,
    articles: articlesList.map((a) => ({
      page_id: a.page_id,
      title: a.title,
      categories: a.categories,
      length: a.length,
      snippet: a.wikitext.slice(0, 1500),
      infoboxCountry: a.infoboxCountry,
      infoboxParty: a.infoboxParty,
      infoboxGovernment: a.infoboxGovernment,
    })),
  };

  fs.writeFileSync(
    `${outDir}/category_politics_full_audit.json`,
    JSON.stringify(auditReport, null, 2)
  );

  // Extract parties specifically
  const partiesOnly = articlesList.filter(
    (a) => a.infoboxParty != null || a.title.toLowerCase().includes("party") || a.categories.some(c => c.toLowerCase().includes("political_parties"))
  );

  // Extract ideologies specifically
  const ideologiesOnly = articlesList.filter(
    (a) => a.categories.some(c => c.toLowerCase().includes("ideolog")) || a.title.toLowerCase().includes("ideology")
  );

  // Extract governments and constitutional articles specifically
  const governmentsOnly = articlesList.filter(
    (a) => a.infoboxGovernment != null || a.title.toLowerCase().includes("government_of") || a.title.toLowerCase().includes("politics_of") || a.title.toLowerCase().includes("constitution")
  );

  console.log(`Discovered under Category:Politics:
    - Political Parties: ${partiesOnly.length}
    - Ideologies: ${ideologiesOnly.length}
    - Governments & Constitutions: ${governmentsOnly.length}
  `);

  fs.writeFileSync(
    `${outDir}/category_politics_entities.json`,
    JSON.stringify(
      {
        totalParties: partiesOnly.length,
        parties: partiesOnly.map(p => ({ title: p.title, categories: p.categories, infobox: p.infoboxParty, snippet: p.wikitext.slice(0, 1000) })),
        totalIdeologies: ideologiesOnly.length,
        ideologies: ideologiesOnly.map(i => ({ title: i.title, categories: i.categories, snippet: i.wikitext.slice(0, 1000) })),
        totalGovernments: governmentsOnly.length,
        governments: governmentsOnly.map(g => ({ title: g.title, categories: g.categories, infobox: g.infoboxGovernment, snippet: g.wikitext.slice(0, 1000) }))
      },
      null,
      2
    )
  );

  console.log("Reports written to category_politics_full_audit.json and category_politics_entities.json");
  await conn.end();
}

main().catch(console.error);
