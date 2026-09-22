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
  });

  // Find all categories in namespace 14
  const [allCats]: any = await conn.execute(`
    SELECT page_id, CONVERT(page_title USING utf8mb4) as title
    FROM page 
    WHERE page_namespace = 14
  `);

  console.log(`Total categories in namespace 14: ${allCats.length}`);

  const polPatterns = [
    /politic/i,
    /govern/i,
    /elect/i,
    /legislat/i,
    /part(y|ies)/i,
    /ideolog/i,
    /diploma/i,
    /treat(y|ies)/i,
    /coup/i,
    /ministr/i,
    /law/i,
    /monarch/i,
    /empire/i,
    /republic/i,
  ];

  const matched = allCats.filter((c: any) => polPatterns.some(p => p.test(c.title)));
  console.log(`Matched political/governance categories: ${matched.length}`);

  // Specifically check which ones are connected to Category:Politics
  // BFS from Politics
  const visited = new Set<string>();
  const queue: string[] = ["politics"];
  visited.add("politics");

  while (queue.length > 0) {
    const current = queue.shift()!;
    const [subcats]: any = await conn.execute(`
      SELECT CONVERT(p.page_title USING utf8mb4) as title
      FROM categorylinks cl
      JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
      JOIN page p ON cl.cl_from = p.page_id
      WHERE lt.lt_namespace = 14 
        AND LOWER(CONVERT(lt.lt_title USING utf8mb4)) = LOWER(?)
        AND p.page_namespace = 14
    `, [current]);

    for (const row of subcats) {
      const t = row.title.toLowerCase();
      if (!visited.has(t)) {
        visited.add(t);
        queue.push(t);
      }
    }
  }

  console.log(`Total subcategories transitively under Category:Politics: ${visited.size}`);
  console.log("\nTransitive subcategories under Category:Politics:");
  Array.from(visited).sort().forEach(c => console.log(`  - Category:${c}`));

  // Check which political categories are NOT in Category:Politics
  const outsidePolitics = matched.filter((c: any) => !visited.has(c.title.toLowerCase()));
  console.log(`\nPolitical categories OUTSIDE Category:Politics tree (${outsidePolitics.length}):`);
  outsidePolitics.slice(0, 50).forEach((c: any) => console.log(`  - Category:${c.title}`));

  await conn.end();
}

main().catch(console.error);
