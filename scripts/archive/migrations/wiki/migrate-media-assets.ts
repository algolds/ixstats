/**
 * migrate-media-assets.ts — Universal MediaWiki Media & Asset Ingestion Engine (CLI)
 *
 * Streams all image/media metadata directly into PostgreSQL `wiki_assets`.
 *
 * Usage:
 *   bun run scripts/wiki/migrate-media-assets.ts --dry-run --limit=20
 *   bun run scripts/wiki/migrate-media-assets.ts --all
 *   bun run scripts/wiki/migrate-media-assets.ts --from-db
 */

import { PrismaClient } from "@prisma/client";
import {
  getIxWikiPool,
  closeWikiBridge,
} from "../../src/lib/wiki-os/adapters/mediawiki/bridge/mysql-pool";
import { MediaAssetService } from "../../src/lib/wiki-os/core/media-asset-service";
import { DEFAULT_USER_AGENT, DEFAULT_MEDIAWIKI_URL } from "../../src/lib/wiki-os/config";
import type mysql from "mysql2/promise";

const prisma = new PrismaClient();

interface MediaRecord {
  name: string;
  url: string;
  thumbUrl?: string;
  size: number;
  width: number;
  height: number;
  mime: string;
  sha1?: string;
}

async function fetchMediaFromLiveDb(limit: number): Promise<MediaRecord[]> {
  const pool = getIxWikiPool();
  console.log("🔌 Connecting to live MariaDB `image` table...");

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT img_name, img_size, img_width, img_height, img_major_mime, img_minor_mime, img_sha1
     FROM image
     ORDER BY img_size DESC
     ${limit === Infinity ? "" : `LIMIT ${limit}`}`
  );

  return (rows || []).map((r: mysql.RowDataPacket) => {
    const name = String(r.img_name);
    const { fullPath } = MediaAssetService.getMd5ShardPath(name);
    const base = DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "");
    return {
      name,
      url: `${base}/images/${fullPath}`,
      thumbUrl: `${base}/images/thumb/${fullPath}/300px-${encodeURIComponent(name)}`,
      size: Number(r.img_size || 0),
      width: Number(r.img_width || 0),
      height: Number(r.img_height || 0),
      mime: `${r.img_major_mime}/${r.img_minor_mime}`,
      sha1: String(r.img_sha1 || ""),
    };
  });
}

async function streamMediaFromHttpApi(
  limit: number,
  isDryRun: boolean,
  baseUrl = DEFAULT_MEDIAWIKI_URL
): Promise<number> {
  const apiUrl = `${baseUrl.replace(/\/$/, "")}/api.php`;
  console.log(`🌐 Connecting to MediaWiki Action API at ${apiUrl}...`);
  console.log(
    `📥 Mode: ${limit === Infinity ? "FULL SYNC (All Media Assets)" : `Targeting ${limit} assets`}`
  );

  let gaicontinue: string | undefined = undefined;
  let totalProcessed = 0;
  let batchIndex = 1;
  const startTime = Date.now();

  while (totalProcessed < limit) {
    const remaining = limit === Infinity ? 50 : Math.min(50, limit - totalProcessed);
    const url = new URL(apiUrl);
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "allimages");
    url.searchParams.set("gailimit", String(remaining));
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|size|mime|dimensions|sha1");
    url.searchParams.set("format", "json");
    if (gaicontinue) {
      url.searchParams.set("gaicontinue", gaicontinue);
    }

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.warn(`⚠️  HTTP request failed with status: ${res.status}`);
      break;
    }

    const data: any = await res.json();
    const pages = data?.query?.pages;
    if (!pages || typeof pages !== "object") {
      break;
    }

    const batchPages = Object.values(pages) as any[];
    if (batchPages.length === 0) {
      break;
    }

    let latestName = "";

    for (const page of batchPages) {
      const info = page.imageinfo?.[0];
      if (info) {
        const rawTitle = page.title || "";
        const cleanName = rawTitle.replace(/^(?:File|Image):/i, "").trim();
        latestName = cleanName;

        if (isDryRun) {
          if (totalProcessed < 5) {
            console.log(
              `   [Dry-Run Preview] File: "${cleanName}" | Dimensions: ${info.width}x${info.height} | Mime: ${info.mime} | Size: ${info.size}B`
            );
          }
        } else {
          try {
            await MediaAssetService.registerAsset({
              filename: cleanName,
              title: cleanName.replace(/_/g, " "),
              mimeType: info.mime,
              sizeBytes: info.size,
              width: info.width,
              height: info.height,
              url: info.url,
              thumbnailUrl: info.thumburl,
              originBaseUrl: baseUrl,
            });
          } catch (itemErr) {
            console.warn(`   ⚠️ Could not register asset "${cleanName}":`, itemErr);
          }
        }

        totalProcessed++;
        if (totalProcessed >= limit) break;
      }
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `   [Batch ${batchIndex}] Ingested ${batchPages.length} media files (Total: ${totalProcessed} | ${durationSec}s | Latest: "${latestName}")`
    );
    batchIndex++;

    gaicontinue = data?.continue?.gaicontinue;
    if (!gaicontinue) {
      console.log("🏁 Reached end of MediaWiki media catalog.");
      break;
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n🎉 Media asset ingestion completed in ${totalTime}s! Total assets: ${totalProcessed}`
  );
  return totalProcessed;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const fromDb = args.includes("--from-db");
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const isAll = args.includes("--all") || (!limitArg && !args.includes("--dry-run"));
  const limit = limitArg ? parseInt(limitArg, 10) : isAll ? Infinity : 50;

  console.log("==================================================================");
  console.log(`🖼️  WikiOS Media & Asset Ingestion Engine`);
  console.log(`   Mode: ${isDryRun ? "DRY-RUN (Validation & Preview)" : "LIVE INGESTION"}`);
  console.log(
    `   Scope: ${limit === Infinity ? "FULL SYNC (All Media Assets)" : `Limit: ${limit} files`}`
  );
  console.log("==================================================================");

  if (fromDb) {
    try {
      const records = await fetchMediaFromLiveDb(limit);
      console.log(`✅ Retrieved ${records.length} records from MariaDB image table.`);
      let count = 0;
      for (const rec of records) {
        if (!isDryRun) {
          await MediaAssetService.registerAsset({
            filename: rec.name,
            mimeType: rec.mime,
            sizeBytes: rec.size,
            width: rec.width,
            height: rec.height,
            url: rec.url,
            thumbnailUrl: rec.thumbUrl,
          });
        }
        count++;
        if (count % 50 === 0 || count === records.length) {
          console.log(`   Processed ${count} / ${records.length} media assets...`);
        }
      }
      console.log(`\n🎉 Ingestion successfully completed! (${count} media records synced)`);
    } catch (err) {
      console.warn(
        "⚠️  Could not connect to live MariaDB. Falling back to MediaWiki Action API..."
      );
      await streamMediaFromHttpApi(limit, isDryRun);
    }
  } else {
    await streamMediaFromHttpApi(limit, isDryRun);
  }
}

main()
  .catch((err) => {
    console.error("❌ Media migration failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closeWikiBridge();
  });
