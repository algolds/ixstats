/**
 * ThinkPages forum phase 4: read-only export of forum.ixwiki.com (XenForo REST API) into an on-disk snapshot that
 * the importer reads (format: src/lib/thinkpages-forum/import/snapshot.ts). Writes nothing to any database.
 *   bun run forum:export-xenforo -- --out .forum-import/<name> [--rps 4] [--nodes 12,13] [--no-attachments]
 *                                   [--max-attachment-mb 25]
 * Reads XENFORO_API_URL and XENFORO_API_KEY from the environment (the key is never printed or written). Prints the
 * key's scopes, then exports nodes → threads per Forum node → posts per thread → users per distinct author →
 * attachments per post, skipping work already marked in state.json, so a rerun with the same --out resumes.
 * Ctrl-C stops after the current item. Exits 1 with the ids still missing when the snapshot is incomplete.
 */
import "../lib/load-env";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { runExport, type ExportTotals } from "~/lib/thinkpages-forum/import/export-run";
import {
  isComplete,
  openSnapshotWriter,
  readSnapshot,
  type SnapshotFs,
  type SnapshotGaps,
} from "~/lib/thinkpages-forum/import/snapshot";
import { createXenForoClient } from "~/lib/thinkpages-forum/import/xenforo-client";

const DEFAULT_API_URL = "https://forum.ixwiki.com/api";
const CHECKPOINT_EVERY = 20;
const SHOW_IDS = 50;

interface Args {
  out: string;
  rps: number;
  nodes: number[] | null;
  attachments: boolean;
  maxAttachmentMb: number;
}

function valueOf(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function positive(raw: string | undefined, flag: string, fallback: number): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${flag} must be a positive number`);
  return value;
}

function parseArgs(argv: string[]): Args {
  const out = valueOf(argv, "--out");
  if (!out) throw new Error("--out <dir> is required (e.g. --out .forum-import/2026-10-09)");
  const nodesRaw = valueOf(argv, "--nodes");
  const nodes = nodesRaw
    ? nodesRaw.split(",").map((id) => positive(id.trim(), "--nodes", 0))
    : null;
  return {
    out,
    rps: positive(valueOf(argv, "--rps"), "--rps", 4),
    nodes,
    attachments: !argv.includes("--no-attachments"),
    maxAttachmentMb: positive(valueOf(argv, "--max-attachment-mb"), "--max-attachment-mb", 25),
  };
}

const nodeFs: SnapshotFs = {
  readFile: (file) => readFile(file, "utf8"),
  writeFile: (file, data) => writeFile(file, data),
  appendFile: (file, data) => appendFile(file, data, "utf8"),
  rename: (from, to) => rename(from, to),
  mkdir: async (dir) => {
    await mkdir(dir, { recursive: true });
  },
  exists: async (file) => existsSync(file),
  stat: async (file) => ({ size: (await stat(file)).size }),
};

function printTotals(totals: ExportTotals): void {
  const a = totals.attachments;
  console.log(
    `this run: ${totals.threads} threads listed, ${totals.posts} posts, ${totals.users} users, attachments ` +
      `${a.ok} ok / ${a.missing} missing / ${a.oversize} oversize / ${a.skipped} skipped`
  );
  if (totals.usersForbidden)
    console.log("users were skipped: the key may not read /users/ (user:read scope)");
}

function printGaps(gaps: SnapshotGaps): void {
  const lists: Array<[string, number[]]> = [
    ["forums without threads", gaps.forumsWithoutThreads],
    ["threads without posts", gaps.threadsWithoutPosts],
    ["users missing", gaps.usersMissing],
    ["attachments missing", gaps.attachmentsMissing],
  ];
  if (gaps.nodesPending) console.log("remaining: the node list");
  for (const [label, ids] of lists) {
    if (!ids.length) continue;
    const more = ids.length > SHOW_IDS ? ` (+${ids.length - SHOW_IDS} more)` : "";
    console.log(`remaining ${label} (${ids.length}): ${ids.slice(0, SHOW_IDS).join(", ")}${more}`);
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.XENFORO_API_KEY;
  if (!apiKey) throw new Error("XENFORO_API_KEY is not set");
  const apiUrl = process.env.XENFORO_API_URL || DEFAULT_API_URL;

  let stopping = false;
  process.on("SIGINT", () => {
    if (stopping) process.exit(130);
    stopping = true;
    console.log("stopping after the current item (Ctrl-C again to quit at once)");
  });

  const client = createXenForoClient({
    apiUrl,
    apiKey,
    requestsPerSecond: args.rps,
    log: console.log,
  });
  const writer = await openSnapshotWriter(nodeFs, args.out, { checkpointEvery: CHECKPOINT_EVERY });
  console.log(`exporting ${apiUrl} into ${args.out}`);
  let totals: ExportTotals | null = null;
  try {
    totals = await runExport({
      client,
      writer,
      readBack: () => readSnapshot(nodeFs, args.out),
      apiUrl,
      nodeFilter: args.nodes,
      attachments: args.attachments,
      maxAttachmentBytes: args.maxAttachmentMb * 1024 * 1024,
      log: console.log,
      shouldStop: () => stopping,
      now: () => new Date(),
    });
  } catch (error) {
    console.error(`export failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (totals) printTotals(totals);
  const { requests, retries, waitedMs } = client.stats();
  console.log(`requests ${requests}, retries ${retries}, waited ${Math.round(waitedMs / 1000)} s`);

  if (!existsSync(`${args.out}/meta.json`)) return 1;
  const snapshot = await readSnapshot(nodeFs, args.out);
  const gaps = isComplete(snapshot);
  const postCount = [...snapshot.postsByThread.values()].reduce(
    (sum, posts) => sum + posts.length,
    0
  );
  console.log(
    `snapshot: ${snapshot.nodes.length} nodes, ${snapshot.threads.length} threads, ${postCount} posts, ` +
      `${snapshot.users.size} users, ${snapshot.attachments.size} attachments` +
      (snapshot.skippedLines ? `, ${snapshot.skippedLines} torn lines skipped` : "")
  );
  if (gaps.complete) {
    console.log("snapshot complete");
    return 0;
  }
  printGaps(gaps);
  console.log("incomplete: rerun the same command to resume");
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
