import mysql from "mysql2/promise";
import dotenv from "dotenv";

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
  const conn = await mysql.createConnection({
    host: IXWIKI_DB_HOST,
    port: IXWIKI_DB_PORT,
    user: IXWIKI_DB_USER,
    password: IXWIKI_DB_PASSWORD,
    database: IXWIKI_DB_NAME,
    charset: "utf8mb4",
  });

  // Check columns of categorylinks
  const [cols]: any = await conn.execute("DESCRIBE categorylinks");
  console.log("categorylinks columns:", cols.map((c: any) => c.Field));

  // Check how category names are stored
  const [sample]: any = await conn.execute(
    "SELECT cl.*, lt.lt_title FROM categorylinks cl LEFT JOIN linktarget lt ON cl.cl_target_id = lt.lt_id LIMIT 5"
  );
  console.log("sample categorylinks row:", sample);

  // Check direct subcategories of 'Politics'
  const [subcats]: any = await conn.execute(`
    SELECT p.page_id, p.page_title, p.page_namespace
    FROM categorylinks cl
    JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
    JOIN page p ON cl.cl_from = p.page_id
    WHERE lt.lt_namespace = 14 AND LOWER(CONVERT(lt.lt_title USING utf8mb4)) = 'politics'
  `);

  console.log(`Direct members of Category:Politics: ${subcats.length}`);
  for (const s of subcats) {
    console.log(`  - ns=${s.page_namespace}: ${toUtf8(s.page_title)}`);
  }

  await conn.end();
}

main().catch(console.error);
