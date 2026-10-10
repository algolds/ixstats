/**
 * Pure planning for scripts/migrations/reconvert-imported-posts.ts: its arguments and database guards, and which
 * stored imported posts the fixed converter would change.
 */
import type { PlannedPost } from "~/lib/thinkpages-forum/import/plan";
import { remapQuotePostIds } from "~/lib/thinkpages-forum/import/quote-ids";
import { productionDatabaseRefusal } from "../lib/database-guard";

export interface ReconvertArgs {
  snapshot: string;
  nodeMap: string | null;
  apply: boolean;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Why the database in `databaseUrl` is not a local one, or null. A re-convert never touches a remote database. */
export function localDatabaseRefusal(databaseUrl: string | undefined): string | null {
  try {
    const { hostname } = new URL(databaseUrl ?? "");
    return LOCAL_HOSTS.has(hostname)
      ? null
      : `DATABASE_URL names ${hostname}, which is not local. This script only runs against a local database (the clone or the dev database).`;
  } catch {
    return "DATABASE_URL is not set or not a URL.";
  }
}

function readFlags(argv: readonly string[]) {
  const values = new Map<string, string>();
  let apply = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--apply") apply = true;
    else if (arg === "--snapshot" || arg === "--node-map") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} needs a value`);
      values.set(arg, value);
      i += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return { values, apply };
}

/** The parsed arguments, or why the run must not start. Never accepts `--production`. */
export function parseReconvertArgs(
  argv: readonly string[],
  databaseUrl: string | undefined
): { args: ReconvertArgs } | { error: string } {
  let flags: ReturnType<typeof readFlags>;
  try {
    flags = readFlags(argv);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  const snapshot = flags.values.get("--snapshot");
  if (!snapshot) return { error: "--snapshot <dir> is required (the export's --out directory)" };
  const refusal =
    productionDatabaseRefusal(databaseUrl, false) ?? localDatabaseRefusal(databaseUrl);
  if (refusal) return { error: refusal };
  return {
    args: { snapshot, nodeMap: flags.values.get("--node-map") ?? null, apply: flags.apply },
  };
}

/** One imported post as the database holds it. */
export interface StoredPost {
  id: string;
  xenforoPostId: number;
  contentHtml: string;
  plainText: string;
  editedAt: Date | null;
  contentWikitext: string | null;
}

export interface PostUpdate {
  id: string;
  xenforoPostId: number;
  contentHtml: string;
  plainText: string;
}

export interface ReconvertPlan {
  updates: PostUpdate[];
  /** Imported posts the converter already renders as stored. */
  unchanged: number;
  /** Planned posts with no row in the database. */
  notImported: number;
  /** Posts edited on the forum since the import (or written with Canvas): never overwritten. */
  editedSince: number;
}

const sameTime = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

/**
 * `planned`: every post the importer would write from the snapshot, converted by the current converter. Only a post
 * already imported is planned, and only when its HTML or plain text differs; quote ids become native post ids (a
 * quote of a post that is not imported loses the attribute).
 */
export function planReconvert(
  planned: readonly PlannedPost[],
  stored: ReadonlyMap<number, StoredPost>
): ReconvertPlan {
  const plan: ReconvertPlan = { updates: [], unchanged: 0, notImported: 0, editedSince: 0 };
  const nativeIdOf = (xenforoPostId: number) => stored.get(xenforoPostId)?.id;
  for (const post of planned) {
    const row = stored.get(post.xenforoPostId);
    if (!row) plan.notImported += 1;
    else if (row.contentWikitext !== null || !sameTime(row.editedAt, post.editedAt))
      plan.editedSince += 1;
    else {
      const contentHtml = remapQuotePostIds(post.contentHtml, nativeIdOf, "drop");
      if (contentHtml === row.contentHtml && post.plainText === row.plainText) plan.unchanged += 1;
      else
        plan.updates.push({
          id: row.id,
          xenforoPostId: post.xenforoPostId,
          contentHtml,
          plainText: post.plainText,
        });
    }
  }
  return plan;
}

export function reconvertLines(plan: ReconvertPlan, applied: boolean): string[] {
  return [
    `Posts to re-convert: ${plan.updates.length} (unchanged ${plan.unchanged}, not imported ${plan.notImported}, edited since import ${plan.editedSince})`,
    applied
      ? `Updated ${plan.updates.length} posts.`
      : "Dry run: nothing written. Pass --apply to write.",
  ];
}
