/**
 * ThinkPages forum phase 4: import a XenForo export snapshot (scripts/migrations/export-xenforo-forum.ts) into the
 * native forum. Dry run by default; --apply writes; --rollback --yes undoes it.
 *   bun run db:import-xenforo-forum -- --snapshot DIR [--node-map FILE] [--apply] [--accept-defaults]
 *     [--production] [--report FILE]
 *   bun run db:import-xenforo-forum -- --snapshot DIR --rollback --yes [--production]
 * Refuses the production database ("ixstats") unless --production is passed, and runs one at a time (a Postgres
 * advisory lock). Preflight: a complete snapshot, a valid node map, every mapped target present (phase 1 seeds,
 * realm slugs), a writable UPLOAD_DIR with twice the attachment bytes free (checked after the report prints).
 * --apply also refuses on BLOCKING lines, and on a Forum node left on a default public archive (--accept-defaults).
 * Apply: archive categories, attachment copy and media assets, then one transaction per thread (resumable and
 * idempotent by XenForo ids), the author relink and the applied node map (`forum_import_node_map`).
 */
import "../lib/load-env";
import { constants } from "node:fs";
import { access, readFile, statfs, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import {
  nodeMapSchema,
  resolveNodeTargets,
  type NodeMapFile,
} from "~/lib/thinkpages-forum/import/node-map";
import {
  planImport,
  UnknownTargetError,
  type ImportPlan,
} from "~/lib/thinkpages-forum/import/plan";
import { summarizeImport } from "~/lib/thinkpages-forum/import/report";
import { isComplete, readSnapshot, type Snapshot } from "~/lib/thinkpages-forum/import/snapshot";
import {
  copyAttachments,
  planAttachmentCopies,
} from "~/server/modules/thinkpages-forum/import-attachments";
import {
  appliedNodeMap,
  loadImportDbState,
  mappedRealmSlugs,
  missingTargets,
  restrictedImportedPosts,
  takeImportLock,
} from "~/server/modules/thinkpages-forum/import-db";
import {
  nativeRepliesOnImported,
  rollbackImport,
} from "~/server/modules/thinkpages-forum/import-rollback";
import { applyImport } from "~/server/modules/thinkpages-forum/import-write";
import { uploadsDir } from "~/server/shared/upload-storage";
import { databaseLabel } from "../lib/database-guard";
import { snapshotDiskFs } from "../lib/snapshot-fs";
import { parseImportArgs, type ImportArgs } from "./import-xenforo-forum-args";
import {
  applyRefusals,
  applyTotalLines,
  attachmentPlanLines,
  attachmentResultLines,
  defaultTargetNodes,
  diskRefusal,
  rollbackLines,
  snapshotGapLines,
} from "./import-xenforo-forum-plan";

const print = (lines: readonly string[]) => lines.forEach((line) => console.log(line));
const refuse = (lines: readonly string[]) => {
  lines.forEach((line) => console.error(line));
  return 1;
};

async function readNodeMap(file: string | null): Promise<NodeMapFile | null> {
  if (!file) return null;
  const parsed = nodeMapSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
  if (!parsed.success) throw new Error(`${file} is not a valid node map: ${parsed.error.message}`);
  return parsed.data;
}

async function uploadsRefusal(plannedBytes: number): Promise<string | null> {
  const dir = uploadsDir();
  const writable = await access(dir, constants.W_OK).then(
    () => true,
    () => false
  );
  const freeBytes = writable
    ? await statfs(dir).then(
        (s) => s.bavail * s.bsize,
        () => null
      )
    : null;
  return diskRefusal({ dir, writable, freeBytes, plannedBytes });
}

/** The plan, or the message of the node whose target does not exist. */
function planOrRefusal(make: () => ImportPlan): ImportPlan | string {
  try {
    return make();
  } catch (error) {
    if (error instanceof UnknownTargetError) return error.message;
    throw error;
  }
}

async function rollback(db: PrismaClient, snapshot: Snapshot): Promise<number> {
  console.log(
    `${await nativeRepliesOnImported(db)} native replies on imported threads will be deleted with them.`
  );
  const totals = await rollbackImport(db, {
    attachmentIds: new Set(snapshot.attachments.keys()),
    uploadsDir: uploadsDir(),
  });
  print(rollbackLines(totals));
  return 0;
}

async function run(db: PrismaClient, args: ImportArgs): Promise<number> {
  if (!(await takeImportLock(db))) return refuse(["Another import or rollback is running."]);
  const snapshot = await readSnapshot(snapshotDiskFs, args.snapshot);
  if (args.rollback) return rollback(db, snapshot);
  const gaps = isComplete(snapshot);
  if (!gaps.complete) {
    return refuse([
      "The snapshot is incomplete; rerun the export first. Still missing:",
      ...snapshotGapLines(gaps),
    ]);
  }
  const nodeMap = await readNodeMap(args.nodeMap);
  const realmSlugs = mappedRealmSlugs(nodeMap);
  const state = await loadImportDbState(db, realmSlugs);
  const missing = missingTargets(state, realmSlugs);
  if (missing.length) return refuse(missing);
  const copyPlan = await planAttachmentCopies(snapshot, nodeMap, {
    siteCategories: state.siteCategories,
    restrictedPosts: await restrictedImportedPosts(db),
  });
  const plan = planOrRefusal(() =>
    planImport(snapshot, { ...state, attachmentFor: copyPlan.attachmentFor }, nodeMap)
  );
  if (typeof plan === "string") return refuse([plan]);
  print(summarizeImport(plan.report));
  print(attachmentPlanLines(snapshot.attachments.values(), copyPlan));
  if (args.report) {
    const { dir, bytes, skipped, missing: absent, signatureMismatch, invalidIds } = copyPlan;
    const copy = { dir, bytes, skipped, missing: absent, signatureMismatch, invalidIds };
    const kept = copyPlan.attachments.map((a) => ({
      id: a.entry.attachment_id,
      file: a.fileName,
      visibility: a.visibility,
    }));
    await writeFile(args.report, JSON.stringify({ report: plan.report, copy, kept }, null, 2));
    console.log(`Report written to ${args.report}`);
  }
  const disk = await uploadsRefusal(copyPlan.bytes);
  if (disk) return refuse([disk]);
  const resolved = resolveNodeTargets(snapshot.nodes, nodeMap);
  const refusals = applyRefusals({
    blocking: plan.report.blocking,
    defaults: defaultTargetNodes(resolved),
    acceptDefaults: args.acceptDefaults,
  });
  if (!args.apply) {
    print(refusals.map((r) => `--apply would refuse: ${r}`));
    return 0;
  }
  if (refusals.length) return refuse(refusals);
  print(attachmentResultLines(await copyAttachments(copyPlan, { log: console.log })));
  const totals = await applyImport(db, plan, {
    nodeMap: appliedNodeMap(resolved),
    log: console.log,
  });
  print(applyTotalLines(totals));
  return 0;
}

const parsed = parseImportArgs(process.argv.slice(2), process.env.DATABASE_URL);
const mode = "args" in parsed ? parsed.args : null;
console.log(
  mode?.rollback
    ? "ROLLBACK — deleting the import"
    : mode?.apply
      ? "APPLY mode — writing"
      : "DRY RUN — pass --apply to write"
);
console.log(`Database: ${databaseLabel(process.env.DATABASE_URL)}`);
if ("error" in parsed) {
  console.error(parsed.error);
  process.exit(1);
}

const db = new PrismaClient();
let code = 1;
run(db, parsed.args)
  .then((result) => {
    code = result;
  })
  .catch((error: Error) => {
    console.error(error);
  })
  // The server modules' imports open a Redis client (the rate limiter) that keeps the event loop alive: exit.
  .finally(async () => {
    await db.$disconnect();
    process.exit(code);
  });
