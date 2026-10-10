/**
 * ThinkPages forum: re-convert already imported XenForo posts with the current converter (wiki BBCode, quote post
 * ids), for the clone and the local dev database. The production import runs the fixed converter from the start.
 *   bun run forum:reconvert-imported -- --snapshot DIR [--node-map FILE] [--apply]
 * Dry run by default; --apply writes. Refuses the production database ("ixstats"), has no --production flag, and
 * refuses any database that is not local. The messages come from the export snapshot (the database keeps only the
 * converted HTML), planned exactly as the importer plans them, then compared with the stored rows: only imported
 * posts whose HTML or plain text differ are updated; a post edited on the forum since the import is left alone.
 * Runs one at a time with the importer (its Postgres advisory lock). Exit codes: 0 done; 1 refused or failed.
 */
import "../lib/load-runner-env";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { nodeMapSchema, type NodeMapFile } from "~/lib/thinkpages-forum/import/node-map";
import { planImport, UnknownTargetError } from "~/lib/thinkpages-forum/import/plan";
import { readSnapshot } from "~/lib/thinkpages-forum/import/snapshot";
import { planAttachmentCopies } from "~/server/modules/thinkpages-forum/import-attachments";
import {
  loadImportDbState,
  mappedRealmSlugs,
  missingTargets,
  restrictedImportedPosts,
  takeImportLock,
} from "~/server/modules/thinkpages-forum/import-db";
import { databaseLabel } from "../lib/database-guard";
import { snapshotDiskFs } from "../lib/snapshot-fs";
import { importDatabaseUrl } from "./import-xenforo-forum-args";
import {
  parseReconvertArgs,
  planReconvert,
  reconvertLines,
  type PostUpdate,
  type ReconvertArgs,
  type StoredPost,
} from "./reconvert-imported-posts-plan";

const PAGE = 1000;
const WRITE_CHUNK = 200;

async function readNodeMap(file: string | null): Promise<NodeMapFile | null> {
  if (!file) return null;
  const parsed = nodeMapSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
  if (!parsed.success) throw new Error(`${file} is not a valid node map: ${parsed.error.message}`);
  return parsed.data;
}

/** Every imported post as stored, by XenForo id (keyset-paged: the client has no row cap, but pages stay small). */
async function storedPosts(db: PrismaClient): Promise<Map<number, StoredPost>> {
  const out = new Map<number, StoredPost>();
  let after = "";
  for (;;) {
    const rows = await db.forumPost.findMany({
      where: { xenforoPostId: { not: null }, id: { gt: after } },
      orderBy: { id: "asc" },
      take: PAGE,
      select: {
        id: true,
        xenforoPostId: true,
        contentHtml: true,
        plainText: true,
        editedAt: true,
        contentWikitext: true,
      },
    });
    if (!rows.length) return out;
    after = rows[rows.length - 1]!.id;
    for (const row of rows) {
      if (row.xenforoPostId !== null)
        out.set(row.xenforoPostId, { ...row, xenforoPostId: row.xenforoPostId });
    }
  }
}

async function write(db: PrismaClient, updates: readonly PostUpdate[]): Promise<void> {
  for (let i = 0; i < updates.length; i += WRITE_CHUNK) {
    await db.$transaction(
      updates.slice(i, i + WRITE_CHUNK).map((u) =>
        db.forumPost.update({
          where: { id: u.id },
          data: { contentHtml: u.contentHtml, plainText: u.plainText },
        })
      )
    );
  }
}

async function run(db: PrismaClient, args: ReconvertArgs): Promise<number> {
  if (!(await takeImportLock(db))) {
    console.error("Another import or rollback is running.");
    return 1;
  }
  const snapshot = await readSnapshot(snapshotDiskFs, args.snapshot);
  const nodeMap = await readNodeMap(args.nodeMap);
  const realmSlugs = mappedRealmSlugs(nodeMap);
  const state = await loadImportDbState(db, realmSlugs);
  const missing = missingTargets(state, realmSlugs);
  if (missing.length) {
    missing.forEach((line) => console.error(line));
    return 1;
  }
  const copyPlan = await planAttachmentCopies(snapshot, nodeMap, {
    siteCategories: state.siteCategories,
    publishedRealms: state.publishedRealms,
    restrictedPosts: await restrictedImportedPosts(db),
  });
  // Every post of the snapshot is planned (none counts as already imported): the converter's output is compared with the rows.
  const plan = planImport(
    snapshot,
    { ...state, existingPosts: new Set(), attachmentFor: copyPlan.attachmentFor },
    nodeMap
  );
  const result = planReconvert(
    plan.threads.flatMap((thread) => thread.posts),
    await storedPosts(db)
  );
  if (args.apply) await write(db, result.updates);
  reconvertLines(result, args.apply).forEach((line) => console.log(line));
  return 0;
}

const argv = process.argv.slice(2);
console.log(argv.includes("--apply") ? "APPLY mode - writing" : "DRY RUN - pass --apply to write");
console.log(`Database: ${databaseLabel(process.env.DATABASE_URL)}`);
const parsed = parseReconvertArgs(argv, process.env.DATABASE_URL);
if ("error" in parsed) {
  console.error(parsed.error);
  process.exit(1);
}

// A plain PrismaClient on one never-reaped connection, holding the importer's advisory lock for the whole run.
const db = new PrismaClient({ datasourceUrl: importDatabaseUrl(process.env.DATABASE_URL ?? "") });
let code = 1;
run(db, parsed.args)
  .then((result) => {
    code = result;
  })
  .catch((error: Error) => {
    console.error(error instanceof UnknownTargetError ? error.message : error);
  })
  // The server modules' imports open a Redis client (the rate limiter) that keeps the event loop alive: exit.
  .finally(async () => {
    try {
      await db.$disconnect();
    } finally {
      process.exit(code);
    }
  });
