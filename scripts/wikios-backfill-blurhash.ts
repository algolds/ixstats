/**
 * WK-17 backfill: a BlurHash, computed from the file's pixels, for every PNG, JPEG, GIF and WebP asset in
 * `wiki_assets` that has none (uploads compute their own since WK-17; files registered from MediaWiki never had one).
 * SVGs and PDFs are skipped. See src/lib/wiki-os/services/blurhash-backfill.ts for what is read and how.
 *
 * Dry run by default: reads and hashes at most 25 files (or `--limit`) and writes nothing. `--apply` writes, for
 * every candidate unless `--limit` is given. Idempotent: an asset that has a hash is never read again, and a
 * file that could not be read or decoded is tried again by the next run.
 *
 *   bun scripts/wikios-backfill-blurhash.ts [--apply] [--limit N] [--delay-ms N]
 */

import "./lib/load-env"; // first: the WikiOS config reads process.env when it loads
import { PrismaClient } from "@prisma/client";
import { backfillBlurhashes } from "../src/lib/wiki-os/services/blurhash-backfill";

const DRY_RUN_LIMIT = 25;
const DEFAULT_DELAY_MS = 100;

function numberArg(name: string): number | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} takes a whole number (got "${process.argv[index + 1]}")`);
  }
  return value;
}

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const limit = numberArg("--limit") ?? (apply ? undefined : DRY_RUN_LIMIT);
  console.log(
    apply
      ? "APPLY mode: writing BlurHashes"
      : `DRY RUN: hashing at most ${limit} files, writing nothing (pass --apply to write)`
  );
  const report = await backfillBlurhashes(db, {
    apply,
    limit,
    delayMs: numberArg("--delay-ms") ?? DEFAULT_DELAY_MS,
    log: (line) => console.log(line),
  });
  console.log(
    `${report.candidates} image assets without a BlurHash; ${report.processed} read: ` +
      `${report.computed} hashed, ${report.written} written, ` +
      `${report.unreadable} unreadable, ${report.undecodable} undecodable`
  );
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
