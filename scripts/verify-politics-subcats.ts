import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.IXWIKI_DB_HOST || "localhost",
    port: parseInt(process.env.IXWIKI_DB_PORT || "13306", 10),
    user: process.env.IXWIKI_DB_USER || "ixwiki",
    password: process.env.IXWIKI_DB_PASSWORD || "Multico1!",
    database: process.env.IXWIKI_DB_NAME || "ixwiki",
    charset: "utf8mb4",
  });

  const requested = [
    "Coups",
    "Defense_policy",
    "Diplomacy",
    "Elections",
    "Federalism",
    "Law",
    "Legislatures",
    "Organizations",
    "Political_ideologies",
    "Political_parties",
    "Politicians",
  ];

  console.log("=== CHECKING REQUESTED CATEGORIES AGAINST MARIADB ===");

  const fullAudit = JSON.parse(
    fs.readFileSync("/home/jxsig/projects/ixstats/data/political-audit/category_politics_full_audit.json", "utf8")
  );

  for (const cat of requested) {
    const [members]: any = await conn.execute(
      `SELECT p.page_title, p.page_namespace
       FROM categorylinks cl
       JOIN linktarget lt ON cl.cl_target_id = lt.lt_id
       JOIN page p ON cl.cl_from = p.page_id
       WHERE lt.lt_namespace = 14 AND LOWER(CONVERT(lt.lt_title USING utf8mb4)) = LOWER(?)`,
      [cat]
    );

    const subcats = members.filter((m: any) => m.page_namespace === 14);
    const pages = members.filter((m: any) => m.page_namespace === 0);
    const files = members.filter((m: any) => m.page_namespace === 6);

    console.log(`\nCategory:${cat}:`);
    console.log(`  Database has: ${subcats.length} subcategories (C), ${pages.length} articles (P)${files.length > 0 ? `, ${files.length} files (F)` : ""}`);

    if (subcats.length > 0) {
      console.log(`  Subcats: ${subcats.map((s: any) => s.page_title.toString()).join(", ")}`);
    }

    // Check in fullAudit
    const auditCat = fullAudit.categoryHierarchy[cat] || fullAudit.categoryHierarchy[cat.toLowerCase()];
    if (auditCat) {
      console.log(`  In fullAudit: ${auditCat.subcategories.length} subcats, ${auditCat.articleCount} articles recorded.`);
    } else {
      console.log(`  WARNING: Not found as key in fullAudit.categoryHierarchy!`);
    }
  }

  await conn.end();
}

main().catch(console.error);
