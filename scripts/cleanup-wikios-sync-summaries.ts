/**
 * scripts/cleanup-wikios-sync-summaries.ts — Normalizes revision summaries in PostgreSQL
 *
 * Replaces legacy placeholder strings like "MediaWiki Live Sync" with semantic page actions
 * ("Created page", "Minor edit", "Updated content").
 */

import { PrismaClient } from "@prisma/client";
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

async function main() {
  console.log("==================================================================");
  console.log("🧹 Normalizing WikiOS Revision Action Summaries in PostgreSQL");
  console.log("==================================================================");

  // 1. Update initial revisions (created page)
  const updatedCreated = await (prisma as any).wikiRevision.updateMany({
    where: {
      summary: { contains: "Live Sync", mode: "insensitive" },
      byteDelta: { gt: 0 },
    },
    data: {
      summary: "Created page",
    },
  });

  // 2. Update remaining edits
  const updatedEdits = await (prisma as any).wikiRevision.updateMany({
    where: {
      summary: { contains: "Live Sync", mode: "insensitive" },
    },
    data: {
      summary: "Updated content",
    },
  });

  // 3. Clear any "MediaWiki" string in summaries
  const updatedMw = await (prisma as any).wikiRevision.updateMany({
    where: {
      summary: { contains: "MediaWiki", mode: "insensitive" },
    },
    data: {
      summary: "Updated content",
    },
  });

  console.log(`✅ Normalized ${updatedCreated.count + updatedEdits.count + updatedMw.count} revision summaries.`);
  console.log("==================================================================\n");

  await prisma.$disconnect();
  process.exit(0);
}

main();
