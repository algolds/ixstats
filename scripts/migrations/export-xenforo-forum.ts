/**
 * ThinkPages forum phase 4: read-only export of forum.ixwiki.com (XenForo REST API) into an on-disk snapshot that
 * the importer reads (format: src/lib/thinkpages-forum/import/snapshot.ts). Writes nothing to any database.
 *   bun run forum:export-xenforo -- --out .forum-import/<name> [--rps 0.9] [--nodes 12,13] [--reset-filter]
 *     [--no-attachments] [--max-attachment-mb 25] [--bypass-permissions | --no-bypass-permissions] [--production]
 * Reads XENFORO_API_URL and XENFORO_API_KEY from the environment (the key is never printed or written); --production
 * loads `.env.production.local` first (scripts/lib/load-runner-env.ts), nothing else (no database). Prints the
 * key's type and scopes, then exports nodes → threads per Forum node → posts per thread → users per distinct
 * author → attachments per post, skipping work already marked in state.json, so a rerun with the same --out
 * resumes (with the same --nodes; --reset-filter changes it).
 * Permissions: with a super-user key every read adds `api_bypass_permissions=1` (default; read-only, never
 * `XF-Api-User` impersonation), so private forums, moderated content and every attachment are exported instead of
 * a guest's view. --no-bypass-permissions turns it off; --bypass-permissions forces it on for a key whose type
 * /index does not report. meta.json records the key type, the bypass setting and the client version, and the
 * summary prints each forum's listed thread count next to XenForo's own count.
 * Rate: 0.9 requests/s by default with a descriptive User-Agent; the server's bot defense blocks above 60
 * requests a minute per IP (see scripts/README.md before raising --rps).
 * Ctrl-C stops after the current item. Exits 1 with the ids still missing when the snapshot is incomplete.
 */
import "../lib/load-runner-env";
import { existsSync } from "node:fs";
import { runExport, type ExportTotals } from "~/lib/thinkpages-forum/import/export-run";
import {
  exportedForums,
  isComplete,
  openSnapshotWriter,
  readSnapshot,
  type Snapshot,
  type SnapshotGaps,
} from "~/lib/thinkpages-forum/import/snapshot";
import {
  XENFORO_EXPORT_CLIENT_VERSION,
  createXenForoClient,
} from "~/lib/thinkpages-forum/import/xenforo-client";
import { snapshotDiskFs as nodeFs } from "../lib/snapshot-fs";
import { parseExportArgs } from "./export-xenforo-forum-args";

const DEFAULT_API_URL = "https://forum.ixwiki.com/api";
const USER_AGENT = `IxStats-ForumExport/${XENFORO_EXPORT_CLIENT_VERSION} (+https://ixwiki.com)`;
const CHECKPOINT_EVERY = 20;
const SHOW_IDS = 50;

function printTotals(totals: ExportTotals): void {
  const a = totals.attachments;
  console.log(
    `this run: ${totals.threads} threads listed, ${totals.posts} posts ` +
      `(${totals.threadsGone} threads gone, ${totals.threadsRedirect} redirects not fetched), ` +
      `${totals.users} users (${totals.usersUnavailable} unavailable: 404 or no user:read), attachments ` +
      `${a.ok} ok / ${a.missing} missing / ${a.forbidden} forbidden / ${a.oversize} oversize / ` +
      `${a.skipped} skipped / ${a.size_mismatch} size mismatch`
  );
}

function printIds(label: string, ids: number[]): void {
  if (!ids.length) return;
  const more = ids.length > SHOW_IDS ? ` (+${ids.length - SHOW_IDS} more)` : "";
  console.log(`${label} (${ids.length}): ${ids.slice(0, SHOW_IDS).join(", ")}${more}`);
}

function printSnapshot(snapshot: Snapshot): void {
  const { meta, state } = snapshot;
  const postCount = [...snapshot.postsByThread.values()].reduce((sum, p) => sum + p.length, 0);
  console.log(
    `snapshot: key ${meta.keyType ?? "type unknown"}, api_bypass_permissions ` +
      `${meta.bypassPermissions ? "on" : "off"}, client ${meta.clientVersion ?? "?"}; ` +
      `${snapshot.nodes.length} nodes, ${snapshot.threads.length} threads, ${postCount} posts, ` +
      `${snapshot.users.size} users, ${snapshot.attachments.size} attachments` +
      (snapshot.skippedLines ? `, ${snapshot.skippedLines} torn or unusable lines skipped` : "")
  );
  for (const forum of exportedForums(snapshot.nodes, meta.nodeFilter)) {
    const count = state.forumCounts?.get(forum.node_id);
    if (!count) continue;
    const flag =
      count.discussionCount !== null && count.listed < count.discussionCount
        ? "  (fewer listed)"
        : "";
    console.log(
      `  forum ${forum.node_id} "${forum.title}": ${count.listed} listed / ` +
        `${count.discussionCount ?? "?"} reported${flag}`
    );
  }
}

function printGaps(gaps: SnapshotGaps): void {
  printIds("reported: redirect threads (not fetched)", gaps.threadsRedirect);
  printIds("reported: threads gone (posts 403/404)", gaps.threadsGone);
  printIds("reported: threads with no posts", gaps.threadsEmpty);
  printIds("reported: users not fetched", gaps.usersMissing);
  printIds("reported: attachments missing or forbidden", gaps.attachmentsUnavailable);
  printIds(
    "reported: attachments with a size mismatch (rerun refetches)",
    gaps.attachmentsSizeMismatch
  );
  if (gaps.nodesPending) console.log("remaining: the node list");
  printIds("remaining forums without threads", gaps.forumsWithoutThreads);
  printIds("remaining threads without posts", gaps.threadsWithoutPosts);
  printIds("remaining attachments", gaps.attachmentsMissing);
}

async function main(): Promise<number> {
  const args = parseExportArgs(process.argv.slice(2));
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
    fetch: globalThis.fetch,
    requestsPerSecond: args.rps,
    userAgent: USER_AGENT,
    bypassPermissions: args.bypass,
    log: console.log,
  });
  const writer = await openSnapshotWriter(nodeFs, args.out, { checkpointEvery: CHECKPOINT_EVERY });
  console.log(
    `exporting ${apiUrl} into ${args.out} at ${args.rps} requests/s` +
      (args.production ? " (environment: .env.production.local first)" : "")
  );
  let totals: ExportTotals | null = null;
  try {
    totals = await runExport({
      client,
      writer,
      readBack: () => readSnapshot(nodeFs, args.out),
      apiUrl,
      nodeFilter: args.nodes,
      resetFilter: args.resetFilter,
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
  printSnapshot(snapshot);
  printGaps(gaps);
  if (gaps.complete && totals) {
    console.log("snapshot complete");
    return 0;
  }
  console.log("incomplete: rerun the same command to resume");
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
