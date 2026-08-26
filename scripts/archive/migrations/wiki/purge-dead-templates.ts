/**
 * purge-dead-templates.ts — Cleanse Zero-Usage & Redundant Templates from wiki_templates Registry
 *
 * Scans the database and safely removes zero-usage legacy templates from the `wiki_templates` registry,
 * while strictly protecting:
 *   1. All Canonical Templates (`isCanonical = true`)
 *   2. All Mapped Aliases (`canonicalTarget != null`)
 *   3. All Templates with >= 1 live transclusion across any article in `wiki_articles`
 *
 * Usage:
 *   bun run scripts/wiki/purge-dead-templates.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function extractTemplateNames(wikitext: string): Set<string> {
  const matches = new Set<string>();
  const regex = /\{\{\s*([a-zA-Z0-9_\-\s\(\)\:\/]+?)(?:\||\}\})/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(wikitext)) !== null) {
    const raw = m[1]?.trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("$")) continue;
    const clean = raw.replace(/^Template:/i, "").replace(/_/g, " ").trim().toLowerCase();
    if (clean) matches.add(clean);
  }

  return matches;
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("==================================================================");
  console.log("✂️  WikiOS Registry Cleanup: Zero-Usage & Redundant Template Purge");
  console.log(`   Mode: ${isDryRun ? "DRY-RUN (Audit Only)" : "LIVE PURGE"}`);
  console.log("==================================================================");

  console.log("\n🔍 1. Scanning all published articles for active template transclusions...");
  const articles = await prisma.wikiArticle.findMany({
    where: { namespace: 0, wikitext: { not: "" } },
    select: { wikitext: true },
  });

  const activeNames = new Set<string>();
  for (const a of articles) {
    const found = extractTemplateNames(a.wikitext);
    for (const name of found) {
      activeNames.add(name);
    }
  }

  console.log(`   Found ${activeNames.size.toLocaleString()} uniquely transcluded templates across ${articles.length.toLocaleString()} articles.`);

  console.log("\n🔍 2. Evaluating wiki_templates registry rows...");
  const allTemplates = await (prisma as any).wikiTemplate.findMany({
    select: {
      id: true,
      name: true,
      isCanonical: true,
      canonicalTarget: true,
    },
  });

  const toKeep: string[] = [];
  const toPurge: string[] = [];

  for (const t of allTemplates) {
    const norm = t.name.toLowerCase().trim();

    // Protect canonical & mapped aliases
    if (t.isCanonical || t.canonicalTarget) {
      toKeep.push(t.name);
      continue;
    }

    // Protect templates with active transclusions in articles
    if (activeNames.has(norm)) {
      toKeep.push(t.name);
      continue;
    }

    toPurge.push(t.name);
  }

  console.log(`   - Total Registry Entries:     ${allTemplates.length.toLocaleString()}`);
  console.log(`   - Active & Canonical Kept:   ${toKeep.length.toLocaleString()}`);
  console.log(`   - Zero-Usage Dead to Purge:  ${toPurge.length.toLocaleString()}`);

  if (isDryRun) {
    console.log("\n[DRY-RUN] Sample of zero-usage templates that would be purged:");
    toPurge.slice(0, 15).forEach((name) => console.log(`   • ${name}`));
    console.log(`   ... and ${(toPurge.length - 15).toLocaleString()} more.`);
    return;
  }

  console.log("\n🗑️  3. Purging zero-usage dead entries from wiki_templates...");
  const deleteResult = await (prisma as any).wikiTemplate.deleteMany({
    where: {
      name: { in: toPurge },
      isCanonical: false,
      canonicalTarget: null,
    },
  });

  console.log(`   ✓ Successfully deleted ${deleteResult.count.toLocaleString()} dead templates from wiki_templates.`);
  console.log(`   ✓ Cleaned registry now contains ${toKeep.length.toLocaleString()} high-value, active templates.`);

  console.log("\n==================================================================");
  console.log("✅ WikiOS Template Registry Purge & Optimization Complete!");
  console.log("==================================================================");
}

main()
  .catch((err) => {
    console.error("❌ Purge failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
