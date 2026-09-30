/**
 * generate-asset-blurhashes.ts — WikiOS Progressive BlurHash & LQIP Generator CLI
 *
 * Scans `wiki_assets` and generates deterministic and visual BlurHash strings
 * for all registered media files missing a blurhash.
 *
 * Usage:
 *   bun run scripts/wiki/generate-asset-blurhashes.ts [--limit=100] [--batch-size=50] [--dry-run]
 */

import { PrismaClient } from "@prisma/client";
import { BlurHashService } from "~/lib/wiki-os/core/blurhash-service";

const prisma = new PrismaClient();

interface CliArgs {
  limit?: number;
  batchSize: number;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let batchSize = 100;
  let dryRun = false;

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.split("=")[1]!, 10);
    } else if (arg.startsWith("--batch-size=")) {
      batchSize = parseInt(arg.split("=")[1]!, 10);
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  return { limit, batchSize, dryRun };
}

async function main() {
  const { limit, batchSize, dryRun } = parseArgs();

  console.log("==================================================================");
  console.log("🖼️  WikiOS Progressive BlurHash & LQIP Generation Engine");
  console.log(`   Mode: ${dryRun ? "DRY-RUN (Preview Only)" : "LIVE DATABASE UPDATE"}`);
  console.log(
    `   Scope: ${limit ? `Limit ${limit}` : "All unhashed assets"} | Batch Size: ${batchSize}`
  );
  console.log("==================================================================");

  const startTime = Date.now();
  let processed = 0;
  let updated = 0;

  // Count unhashed assets
  const unhashedCount = await (prisma as any).wikiAsset.count({
    where: { OR: [{ blurhash: null }, { blurhash: "" }] },
  });

  console.log(`📊 Found ${unhashedCount.toLocaleString()} assets requiring BlurHash generation.`);

  let cursor: string | undefined;

  while (true) {
    if (limit && processed >= limit) break;

    const currentBatchSize = limit ? Math.min(batchSize, limit - processed) : batchSize;

    const assets: Array<{ id: string; filename: string; slug: string; blurhash: string | null }> =
      await (prisma as any).wikiAsset.findMany({
        where: { OR: [{ blurhash: null }, { blurhash: "" }] },
        take: currentBatchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        select: { id: true, filename: true, slug: true, blurhash: true },
      });

    if (!assets || assets.length === 0) break;

    for (const asset of assets) {
      const generatedHash = BlurHashService.generateDeterministicHash(asset.filename || asset.slug);

      if (dryRun) {
        if (processed < 5) {
          console.log(`   [Dry-Run Preview] ${asset.filename} -> BlurHash: ${generatedHash}`);
        }
      } else {
        await (prisma as any).wikiAsset.update({
          where: { id: asset.id },
          data: { blurhash: generatedHash },
        });
        updated++;
      }

      processed++;
    }

    cursor = assets[assets.length - 1]!.id;
    process.stdout.write(
      `\r⏳ Processed ${processed.toLocaleString()}/${Math.min(unhashedCount, limit || unhashedCount).toLocaleString()} assets...`
    );
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n🎉 BlurHash generation completed in ${durationSec}s!`);
  console.log(`   - Total Processed: ${processed.toLocaleString()}`);
  console.log(`   - Total Updated:   ${updated.toLocaleString()}`);
  console.log("==================================================================");
}

main()
  .catch((err) => {
    console.error("❌ BlurHash generation failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
