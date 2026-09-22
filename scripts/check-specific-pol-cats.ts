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

  const targets = [
    "Politics_of_Cartadania",
    "Politics_of_Castadilla",
    "Politics_of_Tierrador",
    "Politics_of_Great_Levantia",
    "Political_parties",
    "Political_ideologies"
  ];

  for (const t of targets) {
    const [p]: any = await conn.execute(
      `SELECT p.page_id, p.page_title 
       FROM page p WHERE p.page_namespace = 14 AND p.page_title = ?`,
      [t]
    );
    if (p.length > 0) {
      const [parents]: any = await conn.execute(
        `SELECT lt.lt_title
         FROM categorylinks cl
         JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
         WHERE cl.cl_from = ?`,
        [p[0].page_id]
      );
      console.log(`Parents of Category:${t}:`, parents.map((row: any) => toUtf8(row.lt_title)));

      // Also check members of this category
      const [members]: any = await conn.execute(
        `SELECT p.page_title, p.page_namespace
         FROM categorylinks cl
         JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
         JOIN page p ON cl.cl_from = p.page_id
         WHERE lt.lt_namespace = 14 AND lt.lt_title = ?`,
        [t]
      );
      console.log(`  -> Has ${members.length} members (subcats: ${members.filter((m:any) => m.page_namespace === 14).length}, articles: ${members.filter((m:any) => m.page_namespace === 0).length})`);
    } else {
      console.log(`Category:${t} not found in page table!`);
    }
  }

  await conn.end();
}

main().catch(console.error);
