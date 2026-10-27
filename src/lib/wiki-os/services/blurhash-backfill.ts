/**
 * blurhash-backfill.ts — BlurHashes for the image assets stored before uploads computed one (WK-17). Run by
 * `scripts/wikios-backfill-blurhash.ts`: a dry run by default, `--apply` to write.
 *
 * Each PNG, JPEG, GIF or WebP asset with no hash is read from where it lives: the staging directory for an upload
 * MediaWiki does not hold yet, else its URL (`downloadMedia`: allowlisted hosts only, at most 10 MB). Its hash is
 * computed from its pixels (`computeBlurhash`, bounded and best effort) and written only while the row still has
 * none, so an upload that lands meanwhile keeps its own. A file that cannot be fetched or decoded is counted and
 * left without a hash (readers show the size-only placeholder), and the next run tries it again.
 */

import type { PrismaClient } from "@prisma/client";
import { MediaAssetService } from "../core/media-asset-service";
import { BLURHASH_MIME_TYPES, computeBlurhash } from "./image-blurhash";
import { downloadMedia } from "./media-download";
import { readStaged } from "./upload-staging";

/** Assets read per query. */
const BATCH_SIZE = 100;

export interface BackfillAsset {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  sha1: string | null;
}

export interface BlurhashBackfillOptions {
  /** Write the hashes; false (the default) computes them and writes nothing. */
  apply?: boolean;
  /** Assets to process at most; all of them when absent. */
  limit?: number;
  /** A pause between two files read over the network, in milliseconds (be kind to the wiki). */
  delayMs?: number;
  log?: (line: string) => void;
}

export interface BlurhashBackfillReport {
  /** Image assets with no hash when the run started. */
  candidates: number;
  processed: number;
  computed: number;
  written: number;
  /** The bytes could not be read (not staged, not on an allowlisted host, too large, an HTTP error). */
  unreadable: number;
  /** The bytes were read but are not a picture sharp can decode. */
  undecodable: number;
}

type BackfillDb = Pick<PrismaClient, "wikiAsset">;

/** The bytes of an asset: its staged copy, or the file at its (absolute) URL. Null when neither can be read. */
export async function readAssetBytes(asset: BackfillAsset): Promise<Uint8Array | null> {
  if (MediaAssetService.isStagedUrl(asset.url)) {
    return asset.sha1 ? readStaged(asset.sha1) : null;
  }
  if (!/^https?:\/\//i.test(asset.url)) return null;
  return downloadMedia(asset.url);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function backfillBlurhashes(
  db: BackfillDb,
  options: BlurhashBackfillOptions = {},
  readBytes: (asset: BackfillAsset) => Promise<Uint8Array | null> = readAssetBytes
): Promise<BlurhashBackfillReport> {
  const { apply = false, limit, delayMs = 0, log = () => undefined } = options;
  const where = { blurhash: null, mimeType: { in: [...BLURHASH_MIME_TYPES] } };
  const report: BlurhashBackfillReport = {
    candidates: await db.wikiAsset.count({ where }),
    processed: 0,
    computed: 0,
    written: 0,
    unreadable: 0,
    undecodable: 0,
  };
  const max = limit ?? report.candidates;

  // Keyset paging by id: a row written by this run drops out of `where`, so offsets would skip rows
  let afterId: string | undefined;
  while (report.processed < max) {
    const batch: BackfillAsset[] = await db.wikiAsset.findMany({
      where: afterId ? { ...where, id: { gt: afterId } } : where,
      select: { id: true, filename: true, url: true, mimeType: true, sha1: true },
      orderBy: { id: "asc" },
      take: Math.min(BATCH_SIZE, max - report.processed),
    });
    if (batch.length === 0) break;
    afterId = batch[batch.length - 1]!.id;

    for (const asset of batch) {
      report.processed++;
      const remote = !MediaAssetService.isStagedUrl(asset.url);
      const bytes = await readBytes(asset).catch(() => null);
      if (remote && delayMs > 0) await sleep(delayMs);
      if (!bytes) {
        report.unreadable++;
        log(`  unreadable  ${asset.filename}`);
        continue;
      }
      const blurhash = await computeBlurhash(bytes, asset.mimeType);
      if (!blurhash) {
        report.undecodable++;
        log(`  undecodable ${asset.filename}`);
        continue;
      }
      report.computed++;
      if (apply) {
        const { count } = await db.wikiAsset.updateMany({
          where: { id: asset.id, blurhash: null },
          data: { blurhash },
        });
        report.written += count;
      }
      log(`  ${apply ? "wrote" : "would write"} ${blurhash} ${asset.filename}`);
    }
  }
  return report;
}
