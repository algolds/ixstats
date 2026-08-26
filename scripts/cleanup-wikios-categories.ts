/**
 * scripts/cleanup-wikios-categories.ts — WikiOS IRL & Maintenance Category Purge
 *
 * Scans PostgreSQL `wiki_categories` and eliminates all real-world Wikipedia identifiers,
 * CS1 citation errors, bot maintenance tags, and orphan metadata categories.
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

function isIrlOrMaintenanceCategory(name: string): boolean {
  if (!name) return true;
  const lower = name.toLowerCase().replace(/_/g, " ").trim();

  // 0. Malformed URLs, embedded links, or HTML/wikitext artifacts
  if (
    lower.includes("http:") ||
    lower.includes("https:") ||
    lower.includes("://") ||
    lower.includes(".com") ||
    lower.includes(".org") ||
    lower.includes(".net") ||
    lower.includes("www.") ||
    lower.includes("%2f") ||
    lower.includes("%3a") ||
    /[<>{}\[\]%]/.test(name)
  ) {
    return true;
  }

  // 1. Template, Module, Navbox, Infobox, WikiProject, Glottolog, Maintenance tags
  if (
    lower.includes("template") ||
    lower.includes("infobox") ||
    lower.includes("navbox") ||
    lower.includes("navigational") ||
    lower.includes("wikiproject") ||
    lower.includes("glottolog") ||
    lower.includes("module:") ||
    lower.includes("user:") ||
    lower.includes("portal:") ||
    lower.includes("wikipedia:") ||
    lower.includes("help:") ||
    lower.includes("disambiguation") ||
    lower.includes("redirects") ||
    lower.includes("tracking") ||
    lower.includes("maintenance") ||
    lower.includes("cleanup") ||
    lower.includes("unreferenced") ||
    lower.includes("stub") ||
    lower.includes("stubs")
  ) {
    return true;
  }

  // 2. Real-World Births and Deaths
  if (
    /\b\d{1,4}\s+(?:births|deaths)\b/i.test(lower) ||
    /\b(?:century|millennium)\s+(?:births|deaths)\b/i.test(lower) ||
    lower === "births" ||
    lower === "deaths" ||
    lower === "living people" ||
    lower === "missing people" ||
    lower === "fat people" ||
    lower.startsWith("people executed") ||
    lower.startsWith("deaths from") ||
    lower.startsWith("buried at")
  ) {
    return true;
  }

  // 3. Authority Control & Library Identifiers
  if (
    lower.includes("identifiers") ||
    lower.includes("viaf") ||
    lower.includes("bnf") ||
    lower.includes("lccn") ||
    lower.includes("gnd") ||
    lower.includes("isni") ||
    lower.includes("fast") ||
    lower.includes("nla") ||
    lower.includes("ndl") ||
    lower.includes("worldcat")
  ) {
    return true;
  }

  // 4. Citation Style 1 (CS1) & Template Tracking
  if (
    lower.startsWith("cs1") ||
    lower.includes("citation") ||
    lower.includes("citations using") ||
    lower.includes("webarchive") ||
    lower.includes("wayback") ||
    lower.includes("short description") ||
    lower.includes("script errors") ||
    lower.includes("duplicate arguments")
  ) {
    return true;
  }

  // 5. Language & Microformats
  if (
    lower.startsWith("articles containing") ||
    lower.startsWith("articles with") ||
    lower.startsWith("articles needing") ||
    lower.includes("hcards") ||
    lower.includes("lang-")
  ) {
    return true;
  }

  // 6. Real-World IRL Country / Political Entities (excluding IxWorld lore)
  const irlRegex = /\b(?:iran|iranian|portugal|portuguese|north america|south america|united states|u\.s\.|usa|russia|russian|china|chinese|germany|german|france|french|spain|spanish|italy|italian|japan|japanese|india|indian|brazil|brazilian|mexico|mexican|turkey|turkish|egypt|egyptian|israel|israeli|saudi|syria|syrian|iraq|iraqi|korea|korean|vietnam|vietnamese|netherlands|dutch|belgium|belgian|sweden|swedish|norway|norwegian|denmark|danish|finland|finnish|poland|polish|ukraine|ukrainian|canada|canadian|australia|australian|new zealand|argentina|chile|colombia|venezuela|peru|cuba|south africa|nigeria|kenya|ghana|morocco|algeria|tunisia|ethiopia|philippines|indonesia|malaysia|thailand|singapore|pakistan|bangladesh|ireland|irish|scotland|scottish|wales|welsh|england|english|united kingdom|british|austria|austrian|switzerland|swiss|greece|greek|hungary|hungarian|romania|romanian|bulgaria|serbia|croatia|czech|slovakia|albania|iceland|estonia|latvia|lithuania|taiwan|hong kong|latter day saint)\b/i;
  if (irlRegex.test(lower)) {
    return true;
  }

  // 7. Wikidata & Bot Maintenance
  if (
    lower.includes("wikidata") ||
    lower.includes("templatedata") ||
    lower.startsWith("pages ") ||
    lower.startsWith("ixwb")
  ) {
    return true;
  }

  return false;
}

async function main() {
  console.log("==================================================================");
  console.log("🧹 WikiOS IRL & Maintenance Category Cleanup Engine");
  console.log("==================================================================");

  const categories = await (prisma as any).wikiCategory.findMany({
    select: { id: true, name: true, slug: true },
  });

  console.log(`📦 Auditing ${categories.length.toLocaleString()} total categories in PostgreSQL...`);

  const toDeleteIds: string[] = [];
  const samples: string[] = [];

  for (const cat of categories) {
    if (isIrlOrMaintenanceCategory(cat.name) || isIrlOrMaintenanceCategory(cat.slug)) {
      toDeleteIds.push(cat.id);
      if (samples.length < 10) {
        samples.push(cat.name);
      }
    }
  }

  console.log(`   Found ${toDeleteIds.length.toLocaleString()} IRL / maintenance categories to prune.`);
  if (samples.length > 0) {
    console.log("   Sample pruned categories:", samples.join(", "));
  }

  if (toDeleteIds.length > 0) {
    // 1. Delete associated memberships
    const deletedMembers = await (prisma as any).wikiCategoryMember.deleteMany({
      where: {
        categoryId: { in: toDeleteIds },
      },
    });
    console.log(`   🗑️ Unlinked ${deletedMembers.count.toLocaleString()} member citations.`);

    // 2. Delete categories
    const deletedCats = await (prisma as any).wikiCategory.deleteMany({
      where: {
        id: { in: toDeleteIds },
      },
    });
    console.log(`   ✨ Successfully purged ${deletedCats.count.toLocaleString()} categories from database.`);
  }

  const remainingCats = await (prisma as any).wikiCategory.count();
  const remainingMembers = await (prisma as any).wikiCategoryMember.count();

  console.log("\n==================================================================");
  console.log(`🎉 WikiOS Category Hygiene Complete!`);
  console.log(`   - Clean Worldbuilding Categories: ${remainingCats.toLocaleString()}`);
  console.log(`   - Valid Category Memberships:     ${remainingMembers.toLocaleString()}`);
  console.log("==================================================================\n");

  await prisma.$disconnect();
  process.exit(0);
}

main();
