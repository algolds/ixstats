/**
 * audit-template-usage.ts — Article Template Transclusion Frequency & Canonical Set Auditor
 *
 * Scans all articles in PostgreSQL to determine exact template usage frequency,
 * ranking the top canonical infoboxes, navboxes, formatting blocks, and identifying
 * zero-use dead templates across the realm.
 *
 * Usage:
 *   bun run scripts/wiki/audit-template-usage.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TemplateFrequency {
  name: string;
  count: number;
  sampleArticles: string[];
}

function extractTemplateNames(wikitext: string): string[] {
  const matches = new Set<string>();
  // Match {{TemplateName ...}} or {{TemplateName|...}} or {{TemplateName}}
  const regex = /\{\{\s*([a-zA-Z0-9_\-\s\(\)\:\/]+?)(?:\||\}\})/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(wikitext)) !== null) {
    const raw = m[1]?.trim();
    if (!raw) continue;

    // Ignore parser functions (#if, #switch, #expr, #invoke, etc.)
    if (raw.startsWith("#") || raw.startsWith("$")) continue;

    // Normalize name
    let clean = raw
      .replace(/^Template:/i, "")
      .replace(/_/g, " ")
      .trim();
    if (clean.length > 0 && clean.length < 80) {
      matches.add(clean);
    }
  }

  return Array.from(matches);
}

async function main() {
  console.log("==================================================================");
  console.log("📊 WikiOS Template Frequency & Transclusion Usage Audit");
  console.log("==================================================================");

  console.log("\n🔍 1. Scanning all published articles in PostgreSQL...");
  const articles = await prisma.wikiArticle.findMany({
    where: {
      namespace: 0,
      wikitext: { not: "" },
    },
    select: {
      id: true,
      title: true,
      wikitext: true,
    },
  });

  console.log(`   Auditing ${articles.length.toLocaleString()} articles across the database...`);

  const usageMap = new Map<string, TemplateFrequency>();
  let totalTransclusions = 0;

  for (const a of articles) {
    const templates = extractTemplateNames(a.wikitext);
    for (const t of templates) {
      totalTransclusions++;
      const normKey = t.toLowerCase();
      const existing = usageMap.get(normKey);
      if (existing) {
        existing.count++;
        if (existing.sampleArticles.length < 3 && !existing.sampleArticles.includes(a.title)) {
          existing.sampleArticles.push(a.title);
        }
      } else {
        usageMap.set(normKey, {
          name: t,
          count: 1,
          sampleArticles: [a.title],
        });
      }
    }
  }

  const allFrequencies = Array.from(usageMap.values()).sort((a, b) => b.count - a.count);

  console.log(`\n📈 2. Transclusion Metrics:`);
  console.log(`   - Total Transclusion Occurrences: ${totalTransclusions.toLocaleString()}`);
  console.log(`   - Distinct Templates Invoked:     ${allFrequencies.length.toLocaleString()}`);

  // Categorize top templates
  const infoboxes: TemplateFrequency[] = [];
  const navboxes: TemplateFrequency[] = [];
  const formatting: TemplateFrequency[] = [];
  const citations: TemplateFrequency[] = [];
  const otherHighUse: TemplateFrequency[] = [];

  for (const tf of allFrequencies) {
    const lower = tf.name.toLowerCase();
    if (lower.startsWith("infobox") || lower.includes("infobox")) {
      infoboxes.push(tf);
    } else if (
      lower.startsWith("navbox") ||
      lower.includes("navbox") ||
      lower.includes("campaignbox") ||
      lower.includes("footer")
    ) {
      navboxes.push(tf);
    } else if (
      lower.startsWith("cite") ||
      lower.includes("citation") ||
      lower.includes("reflist")
    ) {
      citations.push(tf);
    } else if (
      lower.includes("quote") ||
      lower.includes("align") ||
      lower.includes("block") ||
      lower.includes("hatnote") ||
      lower.includes("main") ||
      lower.includes("see also")
    ) {
      formatting.push(tf);
    } else if (tf.count >= 5) {
      otherHighUse.push(tf);
    }
  }

  // 1. Top Infoboxes
  console.log("\n📦 3. Top Infoboxes by Article Usage:");
  console.log("------------------------------------------------------------------");
  for (const ib of infoboxes.slice(0, 20)) {
    const pct = ((ib.count / articles.length) * 100).toFixed(1);
    console.log(
      `   • ${ib.name.padEnd(36)} : ${ib.count.toString().padStart(5)} uses (${pct}%) [e.g. ${ib.sampleArticles[0] || ""}]`
    );
  }

  // 2. Top Navboxes & Footers
  console.log("\n🧭 4. Top Navigation & Series Boxes:");
  console.log("------------------------------------------------------------------");
  for (const nb of navboxes.slice(0, 15)) {
    console.log(
      `   • ${nb.name.padEnd(36)} : ${nb.count.toString().padStart(5)} uses [e.g. ${nb.sampleArticles[0] || ""}]`
    );
  }

  // 3. Top Formatting & Hatnotes
  console.log("\n✨ 5. Top Formatting, Hatnotes & Quotes:");
  console.log("------------------------------------------------------------------");
  for (const fmt of formatting.slice(0, 15)) {
    console.log(
      `   • ${fmt.name.padEnd(36)} : ${fmt.count.toString().padStart(5)} uses [e.g. ${fmt.sampleArticles[0] || ""}]`
    );
  }

  // 4. Dead/Unused Templates Check
  const totalRegistered = await prisma.wikiTemplate.count();
  const usedRegistered = allFrequencies.filter((f) => f.count >= 1).length;
  const zeroUseCount = Math.max(0, totalRegistered - usedRegistered);

  console.log("\n💀 6. Dead & Bloat Template Analysis:");
  console.log(`   - Total Registered in WikiTemplates:  ${totalRegistered.toLocaleString()}`);
  console.log(
    `   - Templates with >=1 Real Article Use: ${usedRegistered.toLocaleString()} (${((usedRegistered / totalRegistered) * 100).toFixed(1)}%)`
  );
  console.log(
    `   - Zero-Usage Dead Templates:          ${zeroUseCount.toLocaleString()} (${((zeroUseCount / totalRegistered) * 100).toFixed(1)}%)`
  );

  console.log("\n==================================================================");
  console.log("✅ Usage Frequency Audit Complete!");
  console.log("==================================================================");
}

main()
  .catch((err) => {
    console.error("❌ Usage audit failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
