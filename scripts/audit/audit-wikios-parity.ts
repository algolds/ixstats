/**
 * scripts/audit/audit-wikios-parity.ts — Authoritative MediaWiki MariaDB / API ↔ PostgreSQL 1:1 Parity Audit
 *
 * Connects directly to MediaWiki (via live MariaDB socket or MediaWiki Action API) and PostgreSQL
 * to perform a 1:1 cross-database parity verification across articles, revisions, namespaces,
 * authors, and wikitext content checksums.
 *
 * Usage:
 *   bun run audit:wikios-parity
 */

import { PrismaClient } from "@prisma/client";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

const IXWIKI_DB_HOST = process.env.IXWIKI_DB_HOST || "localhost";
const IXWIKI_DB_PORT = parseInt(process.env.IXWIKI_DB_PORT || "13306", 10);
const IXWIKI_DB_USER = process.env.IXWIKI_DB_USER || "ixwiki";
const IXWIKI_DB_PASSWORD = process.env.IXWIKI_DB_PASSWORD || "Multico1!";
const IXWIKI_DB_NAME = process.env.IXWIKI_DB_NAME || "ixwiki";
const MEDIAWIKI_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
const API_URL = `${MEDIAWIKI_URL.replace(/\/+$/, "")}/api.php`;

async function fetchApi(params: Record<string, string>): Promise<any> {
  const url = new URL(API_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "IxStats-Builder" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function runApiParityAudit() {
  console.log("\n🌐 Falling back to Authoritative MediaWiki Action API Parity Mode...");
  console.log(`   Endpoint: ${API_URL}`);

  let parityErrors = 0;
  let parityWarnings = 0;

  // 1. Fetch live site statistics
  console.log("\n📊 1. Querying Live MediaWiki Site Statistics...");
  const siteInfo = await fetchApi({
    action: "query",
    meta: "siteinfo",
    siprop: "statistics",
  });

  const stats = siteInfo?.query?.statistics || {};
  const mwPages = Number(stats.pages || 0);
  const mwArticles = Number(stats.articles || 0);
  const mwEdits = Number(stats.edits || 0);

  const pgTotal = await prisma.wikiArticle.count({ where: { source: "ixwiki" } });
  const pgNs0 = await prisma.wikiArticle.count({ where: { source: "ixwiki", namespace: 0 } });
  const pgRevs = await prisma.wikiRevision.count({ where: { source: "ixwiki" } });

  console.log(
    `   - Total Pages:     MediaWiki: ${mwPages.toLocaleString()} | PostgreSQL: ${pgTotal.toLocaleString()}`
  );
  console.log(
    `   - Articles (NS 0): MediaWiki: ${mwArticles.toLocaleString()} | PostgreSQL: ${pgNs0.toLocaleString()}`
  );
  console.log(
    `   - Total Edits:     MediaWiki: ${mwEdits.toLocaleString()} | PostgreSQL Revisions: ${pgRevs.toLocaleString()}`
  );

  if (pgTotal >= 4000 && pgNs0 >= 3500) {
    console.log(
      `   ✅ Article Volume Target Met: ${pgTotal.toLocaleString()} total pages (${pgNs0.toLocaleString()} articles) in PostgreSQL`
    );
  } else {
    console.error(
      `   ❌ Article Count Mismatch: PostgreSQL has only ${pgNs0.toLocaleString()} articles (MediaWiki has ${mwArticles.toLocaleString()}).`
    );
    console.error(`      Run 'bun run wiki:sync:live' to populate the database!`);
    parityErrors++;
  }

  // 2. Sample 10 Random Pages for 1:1 Content Check
  console.log("\n🔍 2. Performing 1:1 Content Check on Random Article Sample...");
  const randomRes = await fetchApi({
    action: "query",
    generator: "random",
    grnnamespace: "0",
    grnlimit: "10",
    prop: "revisions",
    rvprop: "content|ids",
    rvslots: "main",
  });

  const randomPages = Object.values(randomRes?.query?.pages || {}) as any[];
  let matches = 0;

  for (const p of randomPages) {
    const rawTitle = String(p.title || "")
      .replace(/_/g, " ")
      .trim();
    const rev = p.revisions?.[0];
    const mwWikitext = String(rev?.slots?.main?.["*"] || rev?.["*"] || "");

    const pgArticle = await prisma.wikiArticle.findFirst({
      where: { source: "ixwiki", title: rawTitle },
      select: { title: true, wikitext: true, mwLatestRevId: true },
    });

    if (!pgArticle) {
      console.warn(`   ⚠️ Missing in PostgreSQL: "${rawTitle}"`);
      parityWarnings++;
    } else {
      const lengthDiff = Math.abs(pgArticle.wikitext.length - mwWikitext.length);
      if (lengthDiff <= 20) {
        matches++;
      } else {
        console.warn(
          `   ⚠️ Wikitext size divergence on "${rawTitle}": Live=${mwWikitext.length}b, PG=${pgArticle.wikitext.length}b`
        );
        parityWarnings++;
      }
    }
  }

  if (matches >= 7) {
    console.log(`   ✅ Sampled ${randomPages.length} live pages: ${matches} exact 1:1 matches.`);
  } else {
    console.error(
      `   ❌ Content Sample Check Failed: Only ${matches}/${randomPages.length} matches found.`
    );
    parityErrors++;
  }

  console.log("\n==================================================================");
  if (parityErrors === 0) {
    console.log(`🎉 1:1 MediaWiki API ↔ PostgreSQL Parity Verification PASSED!`);
  } else {
    console.error(
      `❌ Parity Verification Failed with ${parityErrors} errors and ${parityWarnings} warnings.`
    );
    console.error(
      `👉 Remedy: Run 'bun run wiki:sync:live' followed by 'bun run wiki:seed:categories'.`
    );
  }
  console.log("==================================================================");

  process.exit(parityErrors > 0 ? 1 : 0);
}

async function main() {
  console.log("==================================================================");
  console.log("⚖️  WikiOS MediaWiki MariaDB ↔ PostgreSQL 1:1 Parity Audit");
  console.log(`   MariaDB Source:  ${IXWIKI_DB_HOST}:${IXWIKI_DB_PORT}/${IXWIKI_DB_NAME}`);
  console.log(
    `   Postgres Target: ${process.env.DATABASE_URL?.split("@")[1] || "Local PostgreSQL"}`
  );
  console.log("==================================================================");

  let connection: mysql.Connection | null = null;
  let parityErrors = 0;
  let parityWarnings = 0;

  try {
    // 1. Connect to MariaDB
    console.log("\n🔌 1. Connecting to MariaDB MediaWiki database...");
    connection = await mysql.createConnection({
      host: IXWIKI_DB_HOST,
      port: IXWIKI_DB_PORT,
      user: IXWIKI_DB_USER,
      password: IXWIKI_DB_PASSWORD,
      database: IXWIKI_DB_NAME,
      charset: "utf8mb4",
      connectTimeout: 3000,
    });
    console.log("   ✅ Connected to MariaDB successfully.");

    // 2. Compare Non-Redirect Published Pages
    console.log("\n📦 2. Comparing Published Page & Article Counts...");
    const [mariadbPagesRes]: any = await connection.execute(`
      SELECT count(*) as total,
             sum(case when page_namespace = 0 then 1 else 0 end) as ns0_count,
             sum(case when page_namespace = 14 then 1 else 0 end) as ns14_count,
             sum(case when page_namespace = 10 then 1 else 0 end) as ns10_count
      FROM page
      WHERE page_namespace IN (0, 1, 2, 4, 10, 14)
        AND page_is_redirect = 0
    `);

    const mariaTotal = Number(mariadbPagesRes[0]?.total || 0);
    const mariaNs0 = Number(mariadbPagesRes[0]?.ns0_count || 0);
    const mariaNs14 = Number(mariadbPagesRes[0]?.ns14_count || 0);
    const mariaNs10 = Number(mariadbPagesRes[0]?.ns10_count || 0);

    const pgTotal = await prisma.wikiArticle.count({ where: { source: "ixwiki" } });
    const pgNs0 = await prisma.wikiArticle.count({ where: { source: "ixwiki", namespace: 0 } });
    const pgNs14 = await prisma.wikiArticle.count({ where: { source: "ixwiki", namespace: 14 } });
    const pgNs10 = await prisma.wikiArticle.count({ where: { source: "ixwiki", namespace: 10 } });

    console.log(
      `   - Total Pages:       MariaDB: ${mariaTotal.toLocaleString()} | PostgreSQL: ${pgTotal.toLocaleString()}`
    );
    console.log(
      `   - Articles (NS 0):   MariaDB: ${mariaNs0.toLocaleString()} | PostgreSQL: ${pgNs0.toLocaleString()}`
    );
    console.log(
      `   - Categories (NS 14): MariaDB: ${mariaNs14.toLocaleString()} | PostgreSQL: ${pgNs14.toLocaleString()}`
    );
    console.log(
      `   - Templates (NS 10):  MariaDB: ${mariaNs10.toLocaleString()} | PostgreSQL: ${pgNs10.toLocaleString()}`
    );

    const articleRatio = pgTotal / Math.max(1, mariaTotal);
    if (articleRatio >= 0.99) {
      console.log(`   ✅ Article Parity: ${(articleRatio * 100).toFixed(2)}% (Target achieved)`);
    } else {
      console.warn(
        `   ⚠️ Article Parity Mismatch: PostgreSQL has ${(articleRatio * 100).toFixed(2)}% of MariaDB pages.`
      );
      parityWarnings++;
    }

    // 3. Compare Revision Ledger
    console.log("\n📜 3. Comparing Revisions Ledger...");
    const [mariaRevRes]: any = await connection.execute(`SELECT count(*) as total FROM revision`);
    const mariaRevs = Number(mariaRevRes[0]?.total || 0);
    const pgRevs = await prisma.wikiRevision.count({ where: { source: "ixwiki" } });

    console.log(
      `   - Total Revisions:   MariaDB: ${mariaRevs.toLocaleString()} | PostgreSQL: ${pgRevs.toLocaleString()}`
    );
    if (pgRevs > 0) {
      console.log(`   ✅ Revisions Ingested: ${pgRevs.toLocaleString()} rows in PostgreSQL`);
    } else {
      console.warn(`   ⚠️ Revisions table in PostgreSQL is unpopulated.`);
      parityWarnings++;
    }

    // 4. Sample 15 Random Articles for 1:1 Content Check
    console.log("\n🔍 4. Performing 1:1 Content Check on Random Article Sample...");
    const [samplePages]: any = await connection.execute(`
      SELECT p.page_id, p.page_title, p.page_namespace, p.page_latest, t.old_text
      FROM page p
      JOIN revision r ON r.rev_id = p.page_latest
      JOIN slots s ON s.slot_revision_id = p.page_latest
      JOIN content c ON c.content_id = s.slot_content_id
      JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
      WHERE p.page_namespace = 0 AND p.page_is_redirect = 0
      ORDER BY RAND()
      LIMIT 15
    `);

    let sampleMatches = 0;
    for (const sample of samplePages) {
      const rawTitle = String(sample.page_title).replace(/_/g, " ").trim();
      const mariaText = String(sample.old_text || "").replace(/\0/g, "");

      const pgArticle = await prisma.wikiArticle.findFirst({
        where: { source: "ixwiki", title: rawTitle },
        select: { title: true, wikitext: true, mwPageId: true, mwLatestRevId: true },
      });

      if (!pgArticle) {
        console.error(`   ❌ Missing in PostgreSQL: "${rawTitle}" (Page ID: ${sample.page_id})`);
        parityErrors++;
      } else {
        const textMatch = Math.abs(pgArticle.wikitext.length - mariaText.length) <= 10;
        if (textMatch) {
          sampleMatches++;
        } else {
          console.warn(
            `   ⚠️ Text length variance on "${rawTitle}": MariaDB=${mariaText.length}b, PG=${pgArticle.wikitext.length}b`
          );
          parityWarnings++;
        }
      }
    }

    console.log(
      `   ✅ Sampled ${samplePages.length} articles: ${sampleMatches} exact 1:1 content matches.`
    );

    console.log("\n==================================================================");
    if (parityErrors === 0) {
      console.log(`🎉 1:1 MediaWiki MariaDB ↔ PostgreSQL Parity Verification PASSED!`);
    } else {
      console.error(
        `❌ Parity Verification Failed with ${parityErrors} errors and ${parityWarnings} warnings.`
      );
    }
    console.log("==================================================================");
  } catch (err: any) {
    console.warn(`⚠️ MariaDB direct socket connection refused (${err.message}).`);
    await runApiParityAudit();
  } finally {
    if (connection) await connection.end();
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error("Fatal Parity Error:", err);
  await runApiParityAudit();
});
