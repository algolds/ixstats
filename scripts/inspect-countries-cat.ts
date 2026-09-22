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

  console.log("=== INSPECTING CATEGORY:COUNTRIES ===");

  const [members]: any = await conn.execute(`
    SELECT p.page_id, p.page_title, p.page_namespace
    FROM categorylinks cl
    JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
    JOIN page p ON cl.cl_from = p.page_id
    WHERE lt.lt_namespace = 14 AND LOWER(CONVERT(lt.lt_title USING utf8mb4)) = 'countries'
  `);

  const subcats = members.filter((m: any) => m.page_namespace === 14);
  const articles = members.filter((m: any) => m.page_namespace === 0);

  console.log(`Direct members of Category:Countries: ${members.length}`);
  console.log(`  Subcategories: ${subcats.length}`);
  console.log(`  Articles: ${articles.length}`);

  console.log("\nDirect subcategories of Category:Countries:");
  for (const s of subcats) {
    console.log(`  - Category:${toUtf8(s.page_title)}`);
  }

  // Check how deep the tree goes and how many total country subcategories there are
  const queue: string[] = ["countries"];
  const visited = new Set<string>();
  visited.add("countries");
  let totalCountrySubcats = 0;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const [children]: any = await conn.execute(`
      SELECT p.page_title, p.page_namespace
      FROM categorylinks cl
      JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
      JOIN page p ON cl.cl_from = p.page_id
      WHERE lt.lt_namespace = 14 AND LOWER(CONVERT(lt.lt_title USING utf8mb4)) = LOWER(?)
        AND p.page_namespace = 14
    `, [cur]);

    for (const c of children) {
      const title = toUtf8(c.page_title);
      const lower = title.toLowerCase();
      if (!visited.has(lower)) {
        visited.add(lower);
        totalCountrySubcats++;
        // Don't dive infinitely into non-geographic subcategories
        const skip = ["sport", "football", "university", "universities", "people", "births", "deaths", "stadium", "album", "song"];
        if (!skip.some(s => lower.includes(s))) {
          queue.push(title);
        }
      }
    }
  }

  console.log(`\nTotal recursive country-related subcategories discovered: ${totalCountrySubcats}`);

  await conn.end();
}

main().catch(console.error);
