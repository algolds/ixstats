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
  console.log("AUDITING CATEGORY:COUNTRIES AND ALL SUBCATEGORIES (GOVERNANCE FOCUS)");
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

  // 1. Build in-memory category graph for high-speed complete traversal
  console.log("Building category graph from categorylinks & linktarget...");
  const [catLinks]: any = await conn.execute(`
    SELECT p.page_id, CONVERT(p.page_title USING utf8mb4) as from_title, p.page_namespace,
           CONVERT(lt.lt_title USING utf8mb4) as target_cat
    FROM categorylinks cl
    JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
    JOIN page p ON cl.cl_from = p.page_id
    WHERE lt.lt_namespace = 14
  `);

  console.log(`Loaded ${catLinks.length} category links into memory.`);

  // subcatMap: targetCategory (lowercase) -> array of subcategories (ns=14)
  const subcatMap = new Map<string, Array<{ page_id: number; title: string }>>();
  // articleMap: targetCategory (lowercase) -> array of articles (ns=0)
  const articleMap = new Map<string, Array<{ page_id: number; title: string }>>();

  for (const row of catLinks) {
    const target = (row.target_cat || "").toLowerCase();
    const title = row.from_title || "";
    const ns = row.page_namespace;

    if (ns === 14) {
      if (!subcatMap.has(target)) subcatMap.set(target, []);
      subcatMap.get(target)!.push({ page_id: row.page_id, title });
    } else if (ns === 0) {
      if (!articleMap.has(target)) articleMap.set(target, []);
      articleMap.get(target)!.push({ page_id: row.page_id, title });
    }
  }

  // 2. BFS Traversal starting at "countries"
  const queue: string[] = ["countries"];
  const visitedSubcats = new Set<string>();
  visitedSubcats.add("countries");

  const countryCatHierarchy: Record<string, { parentCategories: string[]; subcategories: string[]; articleCount: number }> = {};
  countryCatHierarchy["countries"] = { parentCategories: [], subcategories: [], articleCount: articleMap.get("countries")?.length || 0 };

  const allCountryArticles = new Map<number, { page_id: number; title: string; categories: Set<string> }>();

  // Helper to add articles to master set
  function collectArticles(catKey: string, originalName: string) {
    const arts = articleMap.get(catKey) || [];
    for (const a of arts) {
      if (!allCountryArticles.has(a.page_id)) {
        allCountryArticles.set(a.page_id, {
          page_id: a.page_id,
          title: a.title,
          categories: new Set(),
        });
      }
      allCountryArticles.get(a.page_id)!.categories.add(originalName);
    }
  }

  collectArticles("countries", "Countries");

  // Skip sub-trees that blow up into non-geographic topics
  const skipKeywords = [
    "sport",
    "football",
    "university",
    "universities",
    "people",
    "births",
    "deaths",
    "stadium",
    "album",
    "song",
    "musician",
    "actor",
    "school",
    "schools",
    "hospital",
    "railway",
    "airline",
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const lowerCurrent = current.toLowerCase();
    const children = subcatMap.get(lowerCurrent) || [];

    if (!countryCatHierarchy[current]) {
      countryCatHierarchy[current] = { parentCategories: [], subcategories: [], articleCount: 0 };
    }

    for (const child of children) {
      const childTitle = child.title;
      const lowerChild = childTitle.toLowerCase();

      countryCatHierarchy[current].subcategories.push(childTitle);
      if (!countryCatHierarchy[childTitle]) {
        countryCatHierarchy[childTitle] = { parentCategories: [], subcategories: [], articleCount: 0 };
      }
      countryCatHierarchy[childTitle].parentCategories.push(current);

      collectArticles(lowerChild, childTitle);
      countryCatHierarchy[childTitle].articleCount = articleMap.get(lowerChild)?.length || 0;

      if (!visitedSubcats.has(lowerChild)) {
        visitedSubcats.add(lowerChild);
        if (!skipKeywords.some((k) => lowerChild.includes(k))) {
          queue.push(childTitle);
        }
      }
    }
  }

  console.log(`\n=== CATEGORY:COUNTRIES TRAVERSAL SUMMARY ===`);
  console.log(`Total subcategories explored under Category:Countries: ${visitedSubcats.size}`);
  console.log(`Total unique articles under Category:Countries and all subcategories: ${allCountryArticles.size}`);

  // 3. Filter articles with focus on:
  // - "Government of..." / "Politics of..."
  // - Constitutions, legislatures, laws, ministries, monarchies
  // - Country main pages (matching category names or infobox country)
  const allArticleArray = Array.from(allCountryArticles.values());

  const govPatterns = [
    /^government_of_/i,
    /^politics_of_/i,
    /^constitution_of_/i,
    /constitution/i,
    /^law_of_/i,
    /^laws_of_/i,
    /^legislature_of_/i,
    /^parliament_of_/i,
    /^congress_of_/i,
    /^senate_of_/i,
    /^council_of_/i,
    /^monarchy_of_/i,
    /^prime_minister_of_/i,
    /^president_of_/i,
    /ministry_of_/i,
    /^cabinet_of_/i,
    /^judiciary_of_/i,
    /^supreme_court_of_/i,
    /^elections_in_/i,
    /^political_parties_in_/i,
  ];

  // Discovered country names from category titles (e.g. "Category:Caphiria" -> "Caphiria")
  const directCountryNames = new Set(
    (subcatMap.get("countries") || []).map((c) => c.title)
  );

  const targetedArticles = allArticleArray.filter((art) => {
    const t = art.title;
    if (govPatterns.some((pat) => pat.test(t))) return true;
    if (directCountryNames.has(t)) return true;
    // Articles in a government or politics category
    const cats = Array.from(art.categories);
    if (cats.some((c) => /government|politics|law|parliament|constitution|election/i.test(c))) {
      return true;
    }
    return false;
  });

  console.log(`Targeted governance & country articles for full wikitext extraction: ${targetedArticles.length}`);

  // 4. Fetch full wikitext and decompress for all targeted articles
  const CHUNK_SIZE = 150;
  const pageIds = targetedArticles.map((a) => a.page_id);
  const fetchedArticles: Array<{
    page_id: number;
    title: string;
    categories: string[];
    length: number;
    wikitext: string;
    infoboxCountry?: any;
    infoboxGovernment?: any;
    infoboxLegislature?: any;
    governanceClassification?: any;
  }> = [];

  console.log(`Fetching wikitext & decompressing ${pageIds.length} articles in chunks of ${CHUNK_SIZE}...`);

  for (let i = 0; i < pageIds.length; i += CHUNK_SIZE) {
    const chunk = pageIds.slice(i, i + CHUNK_SIZE);
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
      const text = decompressText(r.old_text, flags);
      const cats = Array.from(allCountryArticles.get(r.page_id)?.categories || []);

      // Infobox Country
      let infoboxCountry: any = null;
      if (text.includes("{{Infobox country") || text.includes("{{Infobox former country")) {
        const gov = text.match(/\|\s*government_type\s*=\s*([^\n|]+)/i) || text.match(/\|\s*government\s*=\s*([^\n|]+)/i);
        const leaderTitle = text.match(/\|\s*leader_title\s*=\s*([^\n|]+)/i) || text.match(/\|\s*head_of_state\s*=\s*([^\n|]+)/i);
        const leaderName = text.match(/\|\s*leader_name\s*=\s*([^\n|]+)/i);
        const leader2Title = text.match(/\|\s*leader_title2\s*=\s*([^\n|]+)/i) || text.match(/\|\s*head_of_government\s*=\s*([^\n|]+)/i);
        const leader2Name = text.match(/\|\s*leader_name2\s*=\s*([^\n|]+)/i);
        const legislature = text.match(/\|\s*legislature\s*=\s*([^\n|]+)/i);
        const upperHouse = text.match(/\|\s*upper_house\s*=\s*([^\n|]+)/i);
        const lowerHouse = text.match(/\|\s*lower_house\s*=\s*([^\n|]+)/i);
        const established = text.match(/\|\s*sovereignty_type\s*=\s*([^\n|]+)/i) || text.match(/\|\s*established_event1\s*=\s*([^\n|]+)/i);

        infoboxCountry = {
          government_type: gov ? cleanWikitext(gov[1]) : undefined,
          head_of_state_title: leaderTitle ? cleanWikitext(leaderTitle[1]) : undefined,
          head_of_state_name: leaderName ? cleanWikitext(leaderName[1]) : undefined,
          head_of_gov_title: leader2Title ? cleanWikitext(leader2Title[1]) : undefined,
          head_of_gov_name: leader2Name ? cleanWikitext(leader2Name[1]) : undefined,
          legislature: legislature ? cleanWikitext(legislature[1]) : undefined,
          upper_house: upperHouse ? cleanWikitext(upperHouse[1]) : undefined,
          lower_house: lowerHouse ? cleanWikitext(lowerHouse[1]) : undefined,
          sovereignty_type: established ? cleanWikitext(established[1]) : undefined,
        };
      }

      // Infobox Government
      let infoboxGovernment: any = null;
      if (text.includes("{{Infobox government")) {
        const govName = text.match(/\|\s*government_name\s*=\s*([^\n|]+)/i);
        const country = text.match(/\|\s*country\s*=\s*([^\n|]+)/i);
        const doc = text.match(/\|\s*document\s*=\s*([^\n|]+)/i);
        const leaderTitle = text.match(/\|\s*leader_title\s*=\s*([^\n|]+)/i);
        const mainOrgan = text.match(/\|\s*main_organ\s*=\s*([^\n|]+)/i);
        const legislature = text.match(/\|\s*legislature\s*=\s*([^\n|]+)/i);

        infoboxGovernment = {
          government_name: govName ? cleanWikitext(govName[1]) : title.replace(/_/g, " "),
          country: country ? cleanWikitext(country[1]) : undefined,
          founding_document: doc ? cleanWikitext(doc[1]) : undefined,
          leader_title: leaderTitle ? cleanWikitext(leaderTitle[1]) : undefined,
          main_organ: mainOrgan ? cleanWikitext(mainOrgan[1]) : undefined,
          legislature: legislature ? cleanWikitext(legislature[1]) : undefined,
        };
      }

      // Infobox Legislature
      let infoboxLegislature: any = null;
      if (text.includes("{{Infobox legislature")) {
        const name = text.match(/\|\s*name\s*=\s*([^\n|]+)/i);
        const type = text.match(/\|\s*type\s*=\s*([^\n|]+)/i);
        const houses = text.match(/\|\s*houses\s*=\s*([^\n|]+)/i);
        const leader = text.match(/\|\s*leader1\s*=\s*([^\n|]+)/i) || text.match(/\|\s*speaker\s*=\s*([^\n|]+)/i);

        infoboxLegislature = {
          name: name ? cleanWikitext(name[1]) : title.replace(/_/g, " "),
          type: type ? cleanWikitext(type[1]) : undefined,
          houses: houses ? cleanWikitext(houses[1]) : undefined,
          speaker: leader ? cleanWikitext(leader[1]) : undefined,
        };
      }

      fetchedArticles.push({
        page_id: r.page_id,
        title,
        categories: cats,
        length: r.page_len,
        wikitext: text,
        infoboxCountry,
        infoboxGovernment,
        infoboxLegislature,
      });
    }
  }

  console.log(`Successfully fetched and parsed ${fetchedArticles.length} articles.`);

  // 5. Build structured Country Governance Profiles
  // For each country found under Category:Countries, aggregate:
  // - Main article
  // - Government of [Country] article
  // - Politics of [Country] article
  // - Constitution of [Country] article
  // - Legislature article
  const countryProfiles: Record<string, any> = {};

  // Initialize profiles for all direct country subcategories
  for (const cTitle of directCountryNames) {
    countryProfiles[cTitle] = {
      countryName: cTitle.replace(/_/g, " "),
      mainArticle: null,
      governmentArticle: null,
      politicsArticle: null,
      constitutionArticle: null,
      legislatureArticle: null,
      otherGovArticles: [],
      governanceData: {
        governmentType: null,
        headOfState: null,
        headOfGovernment: null,
        legislature: null,
        constitution: null,
      },
    };
  }

  for (const art of fetchedArticles) {
    const t = art.title;
    const cats = art.categories;

    // Check if it matches a direct country main page
    if (countryProfiles[t]) {
      countryProfiles[t].mainArticle = {
        title: t,
        length: art.length,
        infoboxCountry: art.infoboxCountry,
        snippet: art.wikitext.slice(0, 1000),
      };
      if (art.infoboxCountry?.government_type) {
        countryProfiles[t].governanceData.governmentType = art.infoboxCountry.government_type;
      }
      if (art.infoboxCountry?.head_of_state_name) {
        countryProfiles[t].governanceData.headOfState = `${art.infoboxCountry.head_of_state_title || "Head of State"}: ${art.infoboxCountry.head_of_state_name}`;
      }
      if (art.infoboxCountry?.head_of_gov_name) {
        countryProfiles[t].governanceData.headOfGovernment = `${art.infoboxCountry.head_of_gov_title || "Head of Gov"}: ${art.infoboxCountry.head_of_gov_name}`;
      }
      if (art.infoboxCountry?.legislature) {
        countryProfiles[t].governanceData.legislature = art.infoboxCountry.legislature;
      }
    }

    // Match Government_of_X
    const govMatch = t.match(/^Government_of_(.+)/i);
    if (govMatch) {
      const cName = govMatch[1];
      if (!countryProfiles[cName]) {
        countryProfiles[cName] = {
          countryName: cName.replace(/_/g, " "),
          mainArticle: null,
          governmentArticle: null,
          politicsArticle: null,
          constitutionArticle: null,
          legislatureArticle: null,
          otherGovArticles: [],
          governanceData: {},
        };
      }
      countryProfiles[cName].governmentArticle = {
        title: t,
        length: art.length,
        infoboxGovernment: art.infoboxGovernment,
        snippet: art.wikitext.slice(0, 1000),
      };
      if (art.infoboxGovernment?.founding_document) {
        countryProfiles[cName].governanceData.constitution = art.infoboxGovernment.founding_document;
      }
      if (art.infoboxGovernment?.legislature && !countryProfiles[cName].governanceData.legislature) {
        countryProfiles[cName].governanceData.legislature = art.infoboxGovernment.legislature;
      }
    }

    // Match Politics_of_X
    const polMatch = t.match(/^Politics_of_(.+)/i);
    if (polMatch) {
      const cName = polMatch[1];
      if (!countryProfiles[cName]) {
        countryProfiles[cName] = {
          countryName: cName.replace(/_/g, " "),
          mainArticle: null,
          governmentArticle: null,
          politicsArticle: null,
          constitutionArticle: null,
          legislatureArticle: null,
          otherGovArticles: [],
          governanceData: {},
        };
      }
      countryProfiles[cName].politicsArticle = {
        title: t,
        length: art.length,
        snippet: art.wikitext.slice(0, 1000),
      };
    }

    // Match Constitution_of_X
    const constMatch = t.match(/^Constitution_of_(.+)/i);
    if (constMatch) {
      const cName = constMatch[1];
      if (!countryProfiles[cName]) {
        countryProfiles[cName] = {
          countryName: cName.replace(/_/g, " "),
          mainArticle: null,
          governmentArticle: null,
          politicsArticle: null,
          constitutionArticle: null,
          legislatureArticle: null,
          otherGovArticles: [],
          governanceData: {},
        };
      }
      countryProfiles[cName].constitutionArticle = {
        title: t,
        length: art.length,
        snippet: art.wikitext.slice(0, 1000),
      };
      countryProfiles[cName].governanceData.constitution = t.replace(/_/g, " ");
    }

    // Check association via categories
    for (const c of cats) {
      if (countryProfiles[c] && !t.startsWith("Government_of_") && !t.startsWith("Politics_of_") && !t.startsWith("Constitution_of_") && t !== c) {
        if (govPatterns.some(p => p.test(t)) || art.infoboxGovernment || art.infoboxLegislature) {
          countryProfiles[c].otherGovArticles.push({
            title: t,
            length: art.length,
            infoboxGovernment: art.infoboxGovernment,
            infoboxLegislature: art.infoboxLegislature,
            snippet: art.wikitext.slice(0, 500),
          });
        }
      }
    }
  }

  // 6. Write out comprehensive audit JSON files
  const outDir = "/home/jxsig/projects/ixstats/data/political-audit";

  const auditReport = {
    timestamp: new Date().toISOString(),
    rootCategory: "Category:Countries",
    totalSubcategoriesExplored: visitedSubcats.size,
    subcategoriesList: Array.from(visitedSubcats).sort(),
    totalArticlesUnderCountryTree: allCountryArticles.size,
    totalTargetedGovernanceArticles: fetchedArticles.length,
    breakdown: {
      governmentOfArticles: fetchedArticles.filter((a) => /^government_of_/i.test(a.title)).length,
      politicsOfArticles: fetchedArticles.filter((a) => /^politics_of_/i.test(a.title)).length,
      constitutionArticles: fetchedArticles.filter((a) => /constitution/i.test(a.title)).length,
      legislatureArticles: fetchedArticles.filter((a) => /legislature|parliament|congress|senate|council_of/i.test(a.title)).length,
      countryMainArticles: fetchedArticles.filter((a) => a.infoboxCountry != null).length,
    },
    articles: fetchedArticles.map((a) => ({
      page_id: a.page_id,
      title: a.title,
      categories: a.categories,
      length: a.length,
      snippet: a.wikitext.slice(0, 1200),
      infoboxCountry: a.infoboxCountry,
      infoboxGovernment: a.infoboxGovernment,
      infoboxLegislature: a.infoboxLegislature,
    })),
  };

  fs.writeFileSync(
    `${outDir}/category_countries_government_audit.json`,
    JSON.stringify(auditReport, null, 2)
  );

  fs.writeFileSync(
    `${outDir}/country_governance_profiles.json`,
    JSON.stringify(countryProfiles, null, 2)
  );

  console.log(`Audit report written to:
    - ${outDir}/category_countries_government_audit.json
    - ${outDir}/country_governance_profiles.json
  `);

  console.log(`Summary Statistics:
    - Total Subcategories explored: ${visitedSubcats.size}
    - Total Unique Articles under Category:Countries: ${allCountryArticles.size}
    - Targeted Governance/Country Articles: ${fetchedArticles.length}
    - Government of Articles: ${auditReport.breakdown.governmentOfArticles}
    - Politics of Articles: ${auditReport.breakdown.politicsOfArticles}
    - Constitution Articles: ${auditReport.breakdown.constitutionArticles}
    - Legislature Articles: ${auditReport.breakdown.legislatureArticles}
    - Countries with Infobox country: ${auditReport.breakdown.countryMainArticles}
  `);

  await conn.end();
}

main().catch(console.error);
