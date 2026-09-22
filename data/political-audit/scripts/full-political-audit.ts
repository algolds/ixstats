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

async function main() {
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

  async function getCategoryMembers(rootCats: string[]) {
    const visitedCats = new Set<string>();
    const queue = [...rootCats.map((c) => c.replace(/^Category:/i, "").replace(/ /g, "_"))];
    const catArticles = new Map<string, Set<string>>();
    const articleCats = new Map<string, Set<string>>();
    const allSubcats = new Set<string>();

    while (queue.length > 0) {
      const currentCat = queue.shift()!;
      const normCat = currentCat.toLowerCase();
      if (visitedCats.has(normCat)) continue;
      visitedCats.add(normCat);
      allSubcats.add(currentCat);

      const [rows]: any = await conn.execute(
        `
        SELECT p.page_id, p.page_title, p.page_namespace, cl.cl_type
        FROM categorylinks cl
        JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
        JOIN page p ON cl.cl_from = p.page_id
        WHERE lt.lt_namespace = 14 AND LOWER(CONVERT(lt.lt_title USING utf8mb4)) = LOWER(?)
      `,
        [currentCat]
      );

      for (const row of rows) {
        const title = toUtf8(row.page_title);
        const ns = row.page_namespace;
        const type = row.cl_type ? toUtf8(row.cl_type) : (ns === 14 ? "subcat" : "page");

        if (ns === 14 || type === "subcat") {
          if (!visitedCats.has(title.toLowerCase())) {
            queue.push(title);
          }
        } else if (ns === 0 || type === "page") {
          if (!catArticles.has(currentCat)) {
            catArticles.set(currentCat, new Set());
          }
          catArticles.get(currentCat)!.add(title);

          if (!articleCats.has(title)) {
            articleCats.set(title, new Set());
          }
          articleCats.get(title)!.add(currentCat);
        }
      }
    }

    return { visitedCats: Array.from(allSubcats), catArticles, articleCats };
  }

  console.log("Gathering trees for Government, Politics, Countries, Political ideologies...");
  const gov = await getCategoryMembers(["Government"]);
  console.log(`Government: ${gov.visitedCats.length} subcategories, ${gov.articleCats.size} articles.`);

  const pol = await getCategoryMembers(["Politics"]);
  console.log(`Politics: ${pol.visitedCats.length} subcategories, ${pol.articleCats.size} articles.`);

  const ideo = await getCategoryMembers(["Political_ideologies", "Ideologies"]);
  console.log(`Ideologies: ${ideo.visitedCats.length} subcategories, ${ideo.articleCats.size} articles.`);

  const countries = await getCategoryMembers(["Countries", "Nations", "Sovereign_states"]);
  console.log(`Countries: ${countries.visitedCats.length} subcategories, ${countries.articleCats.size} articles.`);

  // Combine unique article titles
  const allTitles = new Set<string>([
    ...gov.articleCats.keys(),
    ...pol.articleCats.keys(),
    ...ideo.articleCats.keys(),
    ...countries.articleCats.keys(),
  ]);

  console.log(`Total unique articles across all targeted categories: ${allTitles.size}`);

  console.log("Fetching wikitext for articles...");
  const articleList: Array<{
    page_id: number;
    title: string;
    categories: string[];
    wikitext: string;
  }> = [];

  const titleArray = Array.from(allTitles);
  const CHUNK_SIZE = 100;

  for (let i = 0; i < titleArray.length; i += CHUNK_SIZE) {
    const chunk = titleArray.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");

    const [rows]: any = await conn.execute(
      `
      SELECT p.page_id, p.page_title, t.old_text
      FROM page p
      JOIN revision r ON p.page_latest = r.rev_id
      JOIN slots s ON s.slot_revision_id = r.rev_id
      JOIN content c ON s.slot_content_id = c.content_id
      JOIN text t ON t.old_id = CAST(SUBSTRING(c.content_address, 4) AS UNSIGNED)
      WHERE p.page_namespace = 0
        AND p.page_title IN (${placeholders})
    `,
      chunk
    );

    for (const r of rows) {
      const title = toUtf8(r.page_title);
      const wikitext = toUtf8(r.old_text);

      const cats = new Set<string>();
      if (gov.articleCats.has(title)) gov.articleCats.get(title)!.forEach((c) => cats.add(c));
      if (pol.articleCats.has(title)) pol.articleCats.get(title)!.forEach((c) => cats.add(c));
      if (ideo.articleCats.has(title)) ideo.articleCats.get(title)!.forEach((c) => cats.add(c));
      if (countries.articleCats.has(title)) countries.articleCats.get(title)!.forEach((c) => cats.add(c));

      articleList.push({
        page_id: r.page_id,
        title,
        categories: Array.from(cats),
        wikitext,
      });
    }
  }

  console.log(`Successfully fetched text for ${articleList.length} articles.`);

  // Write out comprehensive audit data
  fs.writeFileSync(
    "/tmp/full_political_audit.json",
    JSON.stringify(
      {
        totalArticles: articleList.length,
        categoriesSummary: {
          governmentSubcats: gov.visitedCats,
          politicsSubcats: pol.visitedCats,
          ideologiesSubcats: ideo.visitedCats,
          countriesSubcats: countries.visitedCats,
        },
        articles: articleList.map((a) => ({
          title: a.title,
          categories: a.categories,
          length: a.wikitext.length,
          snippet: a.wikitext.slice(0, 1000),
        })),
      },
      null,
      2
    )
  );

  const partyArticles = articleList.filter(
    (a) =>
      a.title.toLowerCase().includes("party") ||
      a.title.toLowerCase().includes("league") ||
      a.title.toLowerCase().includes("movement") ||
      a.categories.some((c) => c.toLowerCase().includes("part"))
  );

  const ideologyArticles = articleList.filter(
    (a) =>
      ideo.articleCats.has(a.title) ||
      a.categories.some((c) => c.toLowerCase().includes("ideolog"))
  );

  fs.writeFileSync(
    "/tmp/political_entities.json",
    JSON.stringify(
      {
        partyCount: partyArticles.length,
        parties: partyArticles.map((p) => ({
          title: p.title,
          categories: p.categories,
          snippet: p.wikitext.slice(0, 1500),
        })),
        ideologyCount: ideologyArticles.length,
        ideologies: ideologyArticles.map((i) => ({
          title: i.title,
          categories: i.categories,
          snippet: i.wikitext.slice(0, 1500),
        })),
      },
      null,
      2
    )
  );

  console.log("Reports saved to /tmp/full_political_audit.json and /tmp/political_entities.json");
  await conn.end();
}

main().catch(console.error);
