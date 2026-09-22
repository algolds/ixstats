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

  // 1. Total articles in namespace 0
  const [totalRows]: any = await conn.execute(
    `SELECT COUNT(*) as total, 
            SUM(CASE WHEN page_is_redirect = 0 THEN 1 ELSE 0 END) as non_redirects,
            SUM(CASE WHEN page_is_redirect = 1 THEN 1 ELSE 0 END) as redirects
     FROM page WHERE page_namespace = 0`
  );
  console.log("Page counts in namespace 0:", totalRows[0]);

  // 2. Query ALL non-redirect articles in namespace 0
  const [allPages]: any = await conn.execute(
    `SELECT page_id, page_title, page_len, page_touched 
     FROM page 
     WHERE page_namespace = 0 AND page_is_redirect = 0 
     ORDER BY page_len DESC`
  );
  console.log(`Fetched metadata for ${allPages.length} non-redirect articles.`);

  // 3. Write summary of all articles
  const articles = allPages.map((p: any) => ({
    page_id: p.page_id,
    title: toUtf8(p.page_title),
    length: p.page_len,
  }));

  fs.writeFileSync("/tmp/all_wiki_articles_manifest.json", JSON.stringify(articles, null, 2));
  console.log("Saved manifest to /tmp/all_wiki_articles_manifest.json");

  await conn.end();
}

main().catch(console.error);
