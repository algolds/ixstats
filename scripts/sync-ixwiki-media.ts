/**
 * scripts/sync-ixwiki-media.ts — Fast Media & Asset Indexer
 *
 * Ingests all locally uploaded media file metadata from IxWiki into PostgreSQL `wiki_assets`.
 * Enables instant deterministic O(1) detection of Local Uploads vs Wikimedia Commons.
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { MediaAssetService } from "../src/lib/wiki-os/core/media-asset-service";

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

const DEFAULT_USER_AGENT = "IxStats-Builder";
const MEDIAWIKI_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
const API_URL = `${MEDIAWIKI_URL.replace(/\/+$/, "")}/api.php`;

async function main() {
  console.log("==================================================================");
  console.log("🖼️  WikiOS Media Asset Ingestion & Classifier Engine");
  console.log(`   Source: ${API_URL}`);
  console.log("==================================================================");

  const startTime = Date.now();
  let gaicontinue: string | undefined = undefined;
  let totalProcessed = 0;
  let batchIndex = 1;

  while (true) {
    const url = new URL(API_URL);
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "allimages");
    url.searchParams.set("gailimit", "500");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|size|mime|dimensions|sha1");
    url.searchParams.set("format", "json");
    if (gaicontinue) {
      url.searchParams.set("gaicontinue", gaicontinue);
    }

    try {
      const res = await fetch(url.toString(), {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        console.warn(`   ⚠️ Fetch error HTTP ${res.status}`);
        break;
      }

      const data: any = await res.json();
      const pages = data?.query?.pages;
      if (!pages || typeof pages !== "object") break;

      const batchPages = Object.values(pages) as any[];
      if (batchPages.length === 0) break;

      for (const page of batchPages) {
        const info = page.imageinfo?.[0];
        if (!info) continue;

        const rawTitle = page.title || "";
        const cleanName = rawTitle
          .replace(/^(?:File|Image):/i, "")
          .replace(/ /g, "_")
          .trim();
        if (!cleanName) continue;

        const { hash, fullPath } = MediaAssetService.getMd5ShardPath(cleanName);
        const slug = cleanName.toLowerCase();
        const base = MEDIAWIKI_URL.replace(/\/+$/, "");

        try {
          await (prisma as any).wikiAsset.upsert({
            where: { slug },
            create: {
              title: cleanName.replace(/_/g, " "),
              slug,
              filename: cleanName,
              url: info.url || `${base}/images/${fullPath}`,
              thumbnailUrl: info.thumburl || null,
              mimeType: info.mime || "image/jpeg",
              sizeBytes: Number(info.size || 0),
              width: Number(info.width || 0) || null,
              height: Number(info.height || 0) || null,
              md5Hash: hash,
            },
            update: {
              filename: cleanName,
              url: info.url || `${base}/images/${fullPath}`,
              thumbnailUrl: info.thumburl || null,
              mimeType: info.mime || "image/jpeg",
              sizeBytes: Number(info.size || 0),
              width: Number(info.width || 0) || null,
              height: Number(info.height || 0) || null,
            },
          });
          totalProcessed++;
        } catch {
          // Ignore duplicates
        }
      }

      const dur = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `   [Batch ${batchIndex}] Indexed ${batchPages.length} media files (Total: ${totalProcessed} in ${dur}s)`
      );
      batchIndex++;

      gaicontinue = data?.continue?.gaicontinue;
      if (!gaicontinue) {
        console.log("   🏁 Finished media catalog indexing.");
        break;
      }
    } catch (err: any) {
      console.warn(`   ⚠️ Batch error:`, err.message);
      break;
    }
  }

  const finalCount = await (prisma as any).wikiAsset.count();
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n==================================================================");
  console.log(`🎉 Ingested ${totalProcessed.toLocaleString()} Media Assets in ${totalTime}s!`);
  console.log(`   - Total Local Media Assets in PostgreSQL: ${finalCount.toLocaleString()}`);
  console.log("==================================================================\n");

  await prisma.$disconnect();
  process.exit(0);
}

main();
