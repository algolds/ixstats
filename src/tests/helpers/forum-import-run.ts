/**
 * Runs the XenForo importer's plan-and-apply steps (as scripts/migrations/import-xenforo-forum.ts does, minus the
 * attachment copy) against an importStore, on the committed small snapshot and node map.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import {
  nodeMapSchema,
  resolveNodeTargets,
  type NodeMapFile,
} from "~/lib/thinkpages-forum/import/node-map";
import { planImport, type ImportPlan } from "~/lib/thinkpages-forum/import/plan";
import { readSnapshot, type Snapshot } from "~/lib/thinkpages-forum/import/snapshot";
import {
  appliedNodeMap,
  loadImportDbState,
  mappedRealmSlugs,
  type ImportDb,
} from "~/server/modules/thinkpages-forum/import-db";
import { applyImport, type ApplyTotals } from "~/server/modules/thinkpages-forum/import-write";
import { snapshotDiskFs } from "../../../scripts/lib/snapshot-fs";

const FIXTURES = path.join(process.cwd(), "src/tests/fixtures/xenforo");

export const readSmallSnapshot = (): Promise<Snapshot> =>
  readSnapshot(snapshotDiskFs, path.join(FIXTURES, "snapshot-small"));

export const SMALL_NODE_MAP: NodeMapFile = nodeMapSchema.parse(
  JSON.parse(readFileSync(path.join(FIXTURES, "node-map-small.json"), "utf8"))
);

/** The seven phase 1 sitewide categories as rows (`c-<key>`). */
export const SITE_ROWS = SITE_CATEGORIES.map((c) => ({
  id: `c-${c.key}`,
  scope: "site",
  realmId: null,
  key: c.key,
  name: c.name,
  visibility: c.visibility,
}));

export async function runImport(
  db: ImportDb,
  snapshot: Snapshot,
  nodeMap: NodeMapFile | null = SMALL_NODE_MAP
): Promise<{ plan: ImportPlan; totals: ApplyTotals }> {
  const state = await loadImportDbState(db, mappedRealmSlugs(nodeMap));
  const plan = planImport(snapshot, { ...state, attachmentFor: () => "omitted" }, nodeMap);
  const resolved = resolveNodeTargets(snapshot.nodes, nodeMap);
  const totals = await applyImport(db, plan, { nodeMap: appliedNodeMap(resolved) });
  return { plan, totals };
}
