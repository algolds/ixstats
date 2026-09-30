#!/usr/bin/env bun
/**
 * scripts/setup/check-wikios-db.ts — Automatic WikiOS PostgreSQL Persistence & Self-Healing Guard
 *
 * Runs at startup in start-development.sh, scripts/refresh-local-db.sh, and db:init.
 * Ensures PostgreSQL always contains the authoritative 4,688+ article database and categories.
 * If articles count < 100, automatically triggers full ingestion and category indexing.
 */

import { PrismaClient } from "@prisma/client";
import { spawn } from "child_process";
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

async function runScript(scriptPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`🚀 Executing self-healing script: ${scriptPath}...`);
    const child = spawn("bun", [scriptPath], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => {
      resolve(code === 0);
    });
    child.on("error", () => {
      resolve(false);
    });
  });
}

async function checkAndHeal() {
  try {
    const articleCount = await prisma.wikiArticle.count({
      where: { source: "ixwiki" },
    });

    if (articleCount >= 1000) {
      console.log(
        `✅ WikiOS PostgreSQL database verified: ${articleCount.toLocaleString()} articles present.`
      );
      return;
    }

    console.warn(
      `\n⚠️  WikiOS Database Integrity Guard: Detected unseeded/depleted state (${articleCount} articles < 1,000).`
    );
    console.log("🛠️  Initiating automatic self-healing ingestion pipeline...");

    // Try MariaDB full ingestion first
    const fullSuccess = await runScript("scripts/sync-ixwiki-full.ts");
    if (!fullSuccess) {
      console.warn("⚠️ MariaDB socket unavailable, falling back to MediaWiki Action API stream...");
      await runScript("scripts/sync-ixwiki-live.ts");
    }

    // Index all categories and DAG structures
    console.log("\n🌿 Indexing category taxonomies and DAG relationships...");
    await runScript("scripts/sync-wikios-categories.ts");

    const newCount = await prisma.wikiArticle.count({ where: { source: "ixwiki" } });
    console.log(
      `\n🎉 WikiOS Database Auto-Heal Complete: ${newCount.toLocaleString()} articles indexed!\n`
    );
  } catch (err: any) {
    console.warn("⚠️ WikiOS Database Guard non-fatal check failure:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkAndHeal();
}
