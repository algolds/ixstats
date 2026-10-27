/**
 * sync-categories-to-postgres.ts — Category DAG & Hierarchy Migration Engine
 *
 * Migrates all categories, subcategory hierarchies, and category-article memberships
 * from MariaDB (category & categorylinks tables) directly into PostgreSQL Prisma tables:
 * - wiki_categories (WikiCategory)
 * - wiki_category_members (WikiCategoryMember)
 */

import { db as prisma } from "../../src/server/db";
import {
  getIxWikiPool,
  closeWikiBridge,
} from "../../src/lib/wiki-os/adapters/mediawiki/bridge/mysql-pool";
import { toArticleSlug } from "../../src/lib/wiki-os/core/domain-types";
import type mysql from "mysql2/promise";

function sanitizeUtf8(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/\0/g, "").replace(/\u0000/g, "");
}

async function main() {
  console.log("==================================================================");
  console.log("🚀 WikiOS Category DAG & Taxonomy Migration into PostgreSQL");
  console.log("==================================================================");

  const startTime = Date.now();
  const pool = getIxWikiPool();

  try {
    // 1. Fetch all categories from MariaDB
    console.log("\n📦 1. Fetching categories from MariaDB `category` table...");
    const [catRows] = await pool.execute<mysql.RowDataPacket[]>(`
      SELECT cat_id, cat_title, cat_pages, cat_subcats, cat_files
      FROM category
      WHERE cat_pages > 0 OR cat_subcats > 0 OR cat_files > 0
    `);

    console.log(`   Found ${catRows.length} categories in MariaDB.`);

    // 2. Upsert all categories into PostgreSQL `wiki_categories`
    console.log("\n💾 2. Upserting categories into PostgreSQL `wiki_categories`...");
    const categoryMap = new Map<string, string>(); // slug -> categoryId

    let catCreated = 0;
    for (const row of catRows) {
      const rawTitle = sanitizeUtf8(String(row.cat_title)).replace(/_/g, " ");
      const slug = toArticleSlug(rawTitle);

      try {
        const cat = await prisma.wikiCategory.upsert({
          where: { slug },
          create: {
            slug,
            name: rawTitle,
            description: null,
          },
          update: {
            name: rawTitle,
          },
          select: { id: true, slug: true },
        });

        categoryMap.set(slug, cat.id);
        catCreated++;
      } catch (err: any) {
        console.warn(
          `   ⚠️ Could not upsert category "${rawTitle}":`,
          err.message?.substring(0, 80)
        );
      }
    }
    console.log(`   ✅ Upserted ${catCreated} categories into PostgreSQL.`);

    // 3. Ensure the 12 primary domain categories exist
    const DOMAIN_CATEGORIES = [
      "Countries",
      "Economy",
      "Government",
      "Military",
      "People",
      "Politics",
      "History",
      "Geography",
      "Culture",
      "Technology",
      "Companies",
      "Nature",
    ];

    for (const dom of DOMAIN_CATEGORIES) {
      const slug = toArticleSlug(dom);
      if (!categoryMap.has(slug)) {
        const cat = await prisma.wikiCategory.upsert({
          where: { slug },
          create: { slug, name: dom },
          update: { name: dom },
          select: { id: true, slug: true },
        });
        categoryMap.set(slug, cat.id);
      }
    }

    // 4. Fetch all article page mappings in PostgreSQL
    console.log("\n🔍 3. Indexing existing articles in PostgreSQL `wiki_articles`...");
    const articles = await prisma.wikiArticle.findMany({
      where: { source: "ixwiki" },
      select: { id: true, title: true, mwPageId: true, slug: true, wikitext: true },
      take: 10000,
    });

    const pageIdToArticleId = new Map<number, string>();
    const titleToArticleId = new Map<string, string>();

    for (const a of articles) {
      if (a.mwPageId) pageIdToArticleId.set(a.mwPageId, a.id);
      titleToArticleId.set(a.title.toLowerCase(), a.id);
      titleToArticleId.set(a.slug.toLowerCase(), a.id);
    }
    console.log(`   Indexed ${articles.length} PostgreSQL articles for mapping.`);

    // 5. Fetch all category links from MariaDB `categorylinks`
    console.log("\n🔗 4. Migrating category links from MariaDB `categorylinks`...");
    const [links] = await pool.execute<mysql.RowDataPacket[]>(`
      SELECT 
        cl.cl_from, 
        CONVERT(lt.lt_title USING utf8mb4) AS cl_to, 
        cl.cl_type, 
        cl.cl_sortkey,
        CONVERT(p.page_title USING utf8mb4) AS from_title,
        p.page_namespace
      FROM categorylinks cl
      JOIN linktarget lt ON lt.lt_id = cl.cl_target_id AND lt.lt_namespace = 14
      LEFT JOIN page p ON p.page_id = cl.cl_from
    `);
    console.log(`   Found ${links.length} category links in MariaDB.`);

    const memberRecords: Array<{ categoryId: string; articleId: string; sortKey: string | null }> =
      [];
    const subcategoryHierarchy: Array<{
      childSlug: string;
      parentSlug: string;
      childName: string;
      parentName: string;
    }> = [];

    let matchedLinks = 0;

    for (const link of links) {
      const fromPageId = Number(link.cl_from);
      const toCatTitle = sanitizeUtf8(String(link.cl_to || ""))
        .replace(/_/g, " ")
        .trim();
      if (!toCatTitle) continue;
      const toCatSlug = toArticleSlug(toCatTitle);
      const clType = String(link.cl_type || "");
      const ns = Number(link.page_namespace ?? 0);
      const fromTitle = sanitizeUtf8(String(link.from_title || ""))
        .replace(/_/g, " ")
        .trim();
      const sortKey = link.cl_sortkey ? sanitizeUtf8(String(link.cl_sortkey)) : null;

      // Ensure target category exists in map
      let categoryId = categoryMap.get(toCatSlug);
      if (!categoryId) {
        try {
          const cat = await prisma.wikiCategory.upsert({
            where: { slug: toCatSlug },
            create: { slug: toCatSlug, name: toCatTitle },
            update: {},
            select: { id: true },
          });
          categoryId = cat.id;
          categoryMap.set(toCatSlug, categoryId);
        } catch {
          continue;
        }
      }

      if (clType === "subcat" || ns === 14) {
        // Subcategory relationship: child category is the category page with fromTitle
        if (fromTitle) {
          const childSlug = toArticleSlug(fromTitle);
          subcategoryHierarchy.push({
            childSlug,
            parentSlug: toCatSlug,
            childName: fromTitle,
            parentName: toCatTitle,
          });
        }
      } else {
        // Article member: find article in PostgreSQL by pageId, slug, or title
        let articleId = pageIdToArticleId.get(fromPageId);
        if (!articleId && fromTitle) {
          articleId =
            titleToArticleId.get(fromTitle.toLowerCase()) ||
            titleToArticleId.get(toArticleSlug(fromTitle));
        }

        if (articleId && categoryId) {
          memberRecords.push({
            categoryId,
            articleId,
            sortKey,
          });
          matchedLinks++;
        }
      }
    }

    // 6. Also extract wikitext [[Category:Foo]] tags from PostgreSQL articles
    console.log("\n📝 5. Parsing inline `[[Category:...]]` tags from article wikitext...");
    const categoryRegex = /\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi;

    let inlineMatches = 0;
    for (const a of articles) {
      if (!a.wikitext) continue;
      let match: RegExpExecArray | null;
      while ((match = categoryRegex.exec(a.wikitext)) !== null) {
        const catName = match[1]?.trim().replace(/_/g, " ");
        if (!catName) continue;
        const catSlug = toArticleSlug(catName);

        let categoryId = categoryMap.get(catSlug);
        if (!categoryId) {
          try {
            const cat = await prisma.wikiCategory.upsert({
              where: { slug: catSlug },
              create: { slug: catSlug, name: catName },
              update: {},
              select: { id: true },
            });
            categoryId = cat.id;
            categoryMap.set(catSlug, categoryId);
          } catch {
            continue;
          }
        }

        if (categoryId) {
          memberRecords.push({
            categoryId,
            articleId: a.id,
            sortKey: null,
          });
          inlineMatches++;
        }
      }
    }

    console.log(`   Found ${inlineMatches} inline category references.`);

    // 7. Deduplicate and bulk-insert into PostgreSQL `wiki_category_members`
    console.log(`\n💾 6. Writing ${memberRecords.length} category memberships to PostgreSQL...`);
    const uniqueMembers = new Map<
      string,
      { categoryId: string; articleId: string; sortKey: string | null }
    >();
    for (const m of memberRecords) {
      const key = `${m.categoryId}:${m.articleId}`;
      if (!uniqueMembers.has(key)) {
        uniqueMembers.set(key, m);
      }
    }

    const deduplicated = Array.from(uniqueMembers.values());
    console.log(`   Deduplicated to ${deduplicated.length} unique category memberships.`);

    // Chunked insert into PostgreSQL
    const CHUNK_SIZE = 1000;
    let inserted = 0;
    for (let i = 0; i < deduplicated.length; i += CHUNK_SIZE) {
      const chunk = deduplicated.slice(i, i + CHUNK_SIZE);
      await prisma.wikiCategoryMember.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      inserted += chunk.length;
      console.log(`   Inserted ${inserted} / ${deduplicated.length} memberships...`);
    }

    // 8. Establish Subcategory Parent-Child Hierarchy in PostgreSQL
    console.log(
      `\n🌳 7. Linking ${subcategoryHierarchy.length} subcategory parent-child relationships...`
    );
    let subcatsLinked = 0;
    for (const sub of subcategoryHierarchy) {
      try {
        const parentCatId = categoryMap.get(sub.parentSlug);
        if (!parentCatId) continue;

        // Ensure child category exists
        let childCatId = categoryMap.get(sub.childSlug);
        if (!childCatId) {
          const childCat = await prisma.wikiCategory.upsert({
            where: { slug: sub.childSlug },
            create: { slug: sub.childSlug, name: sub.childName },
            update: {},
            select: { id: true },
          });
          childCatId = childCat.id;
          categoryMap.set(sub.childSlug, childCatId);
        }

        // Prevent self-cycles
        if (childCatId !== parentCatId) {
          await prisma.wikiCategory.update({
            where: { id: childCatId },
            data: { parentId: parentCatId },
          });
          subcatsLinked++;
        }
      } catch {
        // Non-fatal
      }
    }
    console.log(`   Linked ${subcatsLinked} subcategories in DAG.`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n==================================================================");
    console.log(`🎉 Category Migration Complete in ${elapsed}s!`);
    console.log(`   - Categories Created/Updated: ${catCreated}`);
    console.log(`   - Memberships Established:   ${deduplicated.length}`);
    console.log("==================================================================");
  } catch (err) {
    console.error("❌ Fatal error in category sync:", err);
  } finally {
    await prisma.$disconnect();
    closeWikiBridge();
    process.exit(0);
  }
}

main();
