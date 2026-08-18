#!/usr/bin/env tsx
/**
 * Lore Card Generator Validation Script
 *
 * Tests that the lore card generator correctly parses high-quality wiki articles
 * with images, validates all fields, and produces well-formed card candidates.
 *
 * Usage:
 *   tsx scripts/validate-lore-card-generation.ts [--wiki ixwiki|iiwiki] [--count 5]
 *
 * Environment:
 *   DATABASE_URL    - Optional (defaults to local dev postgres)
 *   SKIP_ENV_VALIDATION - set automatically
 */

// Set env before any imports to bypass validation
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5433/ixstats";

import { wikiLoreCardGenerator } from "~/lib/wiki/lore-card-generator";
import { LORE_CATEGORIES } from "~/lib/lore-card-constants";
import { CardRarity } from "@prisma/client";

const VALID_CATEGORIES = Object.values(LORE_CATEGORIES);
const RARITY_ORDER = [
  CardRarity.COMMON,
  CardRarity.UNCOMMON,
  CardRarity.RARE,
  CardRarity.ULTRA_RARE,
  CardRarity.EPIC,
  CardRarity.LEGENDARY,
];

interface ValidationResult {
  title: string;
  wikiArticleTitle: string;
  success: boolean;
  candidate: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  imageReachable: boolean | null;
}

const args = process.argv.slice(2);
const wikiArg = args.indexOf("--wiki");
const wikiSource: "ixwiki" | "iiwiki" = (wikiArg >= 0 ? args[wikiArg + 1] : "ixwiki") as
  "ixwiki" | "iiwiki";
const countArg = args.indexOf("--count");
const targetCount = countArg >= 0 ? parseInt(args[countArg + 1], 10) : 5;

async function isImageReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.ok;
  } catch {
    return false;
  }
}

function validateCandidate(candidate: Record<string, unknown>): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!candidate || typeof candidate !== "object") {
    errors.push("Candidate is null/undefined");
    return { errors, warnings };
  }

  // 1. Title
  if (!candidate.title || typeof candidate.title !== "string") {
    errors.push("Missing or invalid title");
  }

  // 2. Description
  if (!candidate.description || typeof candidate.description !== "string") {
    errors.push("Missing or invalid description");
  } else if ((candidate.description as string).length > 200) {
    errors.push(
      `Description too long (${(candidate.description as string).length} chars, max 200)`
    );
  } else if ((candidate.description as string).length < 10) {
    warnings.push(`Description very short (${(candidate.description as string).length} chars)`);
  }

  // 3. Full excerpt
  if (!candidate.fullExcerpt || typeof candidate.fullExcerpt !== "string") {
    errors.push("Missing or invalid fullExcerpt");
  } else if ((candidate.fullExcerpt as string).length > 2000) {
    errors.push(
      `fullExcerpt too long (${(candidate.fullExcerpt as string).length} chars, max 2000)`
    );
  }

  // 4. Artwork / Image
  if (!candidate.artwork || typeof candidate.artwork !== "string") {
    errors.push("Missing artwork URL");
  } else if ((candidate.artwork as string).endsWith("lore-placeholder.svg")) {
    errors.push("Artwork is placeholder — no image extracted");
  } else if (!(candidate.artwork as string).startsWith("http")) {
    errors.push(`Artwork URL invalid: ${candidate.artwork}`);
  }

  // 5. Quality score
  if (typeof candidate.qualityScore !== "number") {
    errors.push("Missing or invalid qualityScore");
  } else if ((candidate.qualityScore as number) < 41) {
    warnings.push(
      `Quality score ${(candidate.qualityScore as number).toFixed(1)} below RARE threshold (41)`
    );
  }

  // 6. Rarity
  const rarity = candidate.rarity as CardRarity;
  const rarityIdx = RARITY_ORDER.indexOf(rarity);
  if (rarityIdx === -1) {
    errors.push(`Unknown rarity: ${String(candidate.rarity)}`);
  } else if (
    (candidate.qualityScore as number) >= 41 &&
    rarityIdx < RARITY_ORDER.indexOf(CardRarity.RARE)
  ) {
    errors.push(
      `Rarity ${String(candidate.rarity)} inconsistent with quality score ${(
        candidate.qualityScore as number
      ).toFixed(1)} (expected RARE+)`
    );
  }

  // 7. Stats
  const stats = candidate.stats as Record<string, number> | undefined;
  if (!stats || typeof stats !== "object") {
    errors.push("Missing stats object");
  } else {
    for (const key of ["economic", "diplomatic", "military", "social"]) {
      if (typeof stats[key] !== "number") {
        errors.push(`Missing stat: ${key}`);
      } else if (stats[key] < 0 || stats[key] > 100) {
        errors.push(`Stat ${key} out of range: ${stats[key]}`);
      }
    }
  }

  // 8. Lore stats
  const loreStats = candidate.loreStats as Record<string, number> | undefined;
  if (!loreStats || typeof loreStats !== "object") {
    errors.push("Missing loreStats object");
  } else {
    for (const key of ["historicalSignificance", "culturalImpact"]) {
      if (typeof loreStats[key] !== "number") {
        errors.push(`Missing loreStat: ${key}`);
      } else if (loreStats[key] < 0 || loreStats[key] > 100) {
        errors.push(`Lore stat ${key} out of range: ${loreStats[key]}`);
      }
    }
  }

  // 9. Category
  if (!candidate.category || !VALID_CATEGORIES.includes(candidate.category as string)) {
    errors.push(`Invalid category: ${String(candidate.category)}`);
  }

  // 10. Wiki URL
  if (!candidate.wikiUrl || !(candidate.wikiUrl as string).startsWith("http")) {
    errors.push(`Invalid wikiUrl: ${String(candidate.wikiUrl)}`);
  }

  return { errors, warnings };
}

async function main() {
  console.log(`🔍 Lore Card Generator Validator`);
  console.log(`   Wiki: ${wikiSource}`);
  console.log(`   Target: ${targetCount} articles with images`);
  console.log("");

  // Override duplicate check so we can test articles that may already exist in DB
  (wikiLoreCardGenerator as unknown as Record<string, unknown>).checkCardExists = async () => false;

  let attempts = 0;
  const results: ValidationResult[] = [];
  const maxAttempts = targetCount * 6; // fetch extra to find high-quality ones

  while (results.length < targetCount && attempts < maxAttempts) {
    attempts++;
    console.log(`\n📡 Fetching random article batch (attempt ${attempts})...`);
    const articles = await wikiLoreCardGenerator.fetchRandomArticlesWithImages(1, wikiSource);

    if (articles.length === 0) {
      console.log("   ⚠️ No articles with images found, retrying...");
      continue;
    }

    const articleTitle = articles[0];

    console.log(`   Testing: "${articleTitle}"`);
    const candidate = await wikiLoreCardGenerator.generateCard(articleTitle, wikiSource, {
      requireImage: true,
    });

    if (!candidate) {
      console.log(`   ⚠️ No candidate returned (already exists or no suitable data)`);
      continue;
    }

    const { errors, warnings } = validateCandidate(candidate as unknown as Record<string, unknown>);

    let imageReachable: boolean | null = null;
    if (candidate.artwork && candidate.artwork.startsWith("http")) {
      process.stdout.write(`   🔗 Checking image reachability... `);
      imageReachable = await isImageReachable(candidate.artwork);
      console.log(imageReachable ? "✅ reachable" : "❌ unreachable");
    }

    const result: ValidationResult = {
      title: candidate.title,
      wikiArticleTitle: candidate.wikiArticleTitle,
      success: errors.length === 0,
      candidate: candidate as unknown as Record<string, unknown>,
      errors,
      warnings,
      imageReachable,
    };

    results.push(result);

    if (result.success) {
      console.log(`   ✅ VALID`);
      console.log(
        `      Rarity: ${candidate.rarity} | Quality: ${candidate.qualityScore.toFixed(1)} | Category: ${candidate.category}`
      );
      console.log(
        `      Image: ${candidate.artwork.substring(0, 80)}${candidate.artwork.length > 80 ? "..." : ""}`
      );
    } else {
      console.log(`   ❌ INVALID`);
      errors.forEach((e) => console.log(`      - ${e}`));
    }

    warnings.forEach((w) => console.log(`      ⚠️ ${w}`));

    // Rate limit
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));
  console.log(`Articles tested: ${results.length} / ${targetCount} requested`);
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const imagesReachable = results.filter((r) => r.imageReachable === true).length;
  const imagesUnreachable = results.filter((r) => r.imageReachable === false).length;

  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Images reachable: ${imagesReachable} ✅`);
  console.log(`Images unreachable: ${imagesUnreachable} ❌`);

  if (results.length > 0) {
    console.log(`\nRarity breakdown:`);
    const rarityCounts: Record<string, number> = {};
    results.forEach((r) => {
      rarityCounts[r.candidate.rarity as string] =
        (rarityCounts[r.candidate.rarity as string] || 0) + 1;
    });
    Object.entries(rarityCounts).forEach(([rarity, count]) => {
      console.log(`  ${rarity}: ${count}`);
    });

    console.log(`\nQuality scores:`);
    results.forEach((r) => {
      console.log(`  ${r.title}: ${(r.candidate.qualityScore as number).toFixed(1)}`);
    });
  }

  if (failed > 0) {
    console.log(`\n❌ Failed articles:`);
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`\n  ${r.title}:`);
        r.errors.forEach((e) => console.log(`    - ${e}`));
      });
  }

  // Exit code
  const exitCode = failed > 0 || results.length < targetCount ? 1 : 0;
  if (exitCode !== 0) {
    console.log(`\n⚠️ Validation incomplete or failed.`);
  } else {
    console.log(`\n🎉 All ${results.length} lore card candidates valid!`);
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
