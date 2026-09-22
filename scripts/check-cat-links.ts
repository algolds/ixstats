import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

function toUtf8(val: any): string {
  if (val == null) return "";
  if (Buffer.isBuffer(val)) return val.toString("utf8");
  return String(val);
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.IXWIKI_DB_HOST || "localhost",
    port: parseInt(process.env.IXWIKI_DB_PORT || "13306", 10),
    user: process.env.IXWIKI_DB_USER || "ixwiki",
    password: process.env.IXWIKI_DB_PASSWORD || "Multico1!",
    database: process.env.IXWIKI_DB_NAME || "ixwiki",
    charset: "utf8mb4",
  });

  // Find all category pages (page_namespace = 14) containing 'Politic'
  const [polCats]: any = await conn.execute(
    "SELECT page_id, page_title FROM page WHERE page_namespace = 14 AND page_title LIKE '%Politic%'"
  );
  console.log(`Found ${polCats.length} category pages containing 'Politic':`);
  for (const c of polCats) {
    console.log(`  - ${toUtf8(c.page_title)}`);
  }

  // Find all category pages containing 'Part'
  const [partCats]: any = await conn.execute(
    "SELECT page_id, page_title FROM page WHERE page_namespace = 14 AND (page_title LIKE '%Parties%' OR page_title LIKE '%Party%')"
  );
  console.log(`\nFound ${partCats.length} category pages containing 'Parties' or 'Party':`);
  for (const c of partCats) {
    console.log(`  - ${toUtf8(c.page_title)}`);
  }

  // Find all category pages containing 'Ideolog'
  const [ideoCats]: any = await conn.execute(
    "SELECT page_id, page_title FROM page WHERE page_namespace = 14 AND page_title LIKE '%Ideolog%'"
  );
  console.log(`\nFound ${ideoCats.length} category pages containing 'Ideolog':`);
  for (const c of ideoCats) {
    console.log(`  - ${toUtf8(c.page_title)}`);
  }

  // Check how 'Political_parties_in_Castadilla' or similar are categorized:
  // What are their parent categories in categorylinks?
  if (polCats.length > 0) {
    const testCat = polCats[0];
    const [parents]: any = await conn.execute(
      `SELECT lt.lt_title
       FROM categorylinks cl
       JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
       WHERE cl.cl_from = ?`,
      [testCat.page_id]
    );
    console.log(`\nParent categories for ${toUtf8(testCat.page_title)}:`, parents.map((p: any) => toUtf8(p.lt_title)));
  }

  await conn.end();
}

main().catch(console.error);
