/**
 * Where each XenForo node lands (phase 4, Q4): an owner-reviewed node map (`.forum-import/node-map.json`, keyed by
 * node id) first, then title heuristics for the five public sitewide seeds, else a per-node archive category
 * `xf-<nodeId>`. Only Forum nodes hold threads; Category, Page and LinkForum nodes are skipped.
 */
import { z } from "zod";
import { stripHtml } from "~/lib/utils/sanitize-html";
import type { XfNode } from "./xenforo-types";

const categoryKey = z.string().regex(/^[a-z0-9-]{2,40}$/);

const nodeTargetSchema = z.union([
  z
    .object({
      scope: z.literal("site"),
      // reporter_staff needs an author to decide who may read a thread (Q4): never an import target.
      key: categoryKey.refine(
        (key) => key !== "reports",
        "The reports category cannot take imported threads"
      ),
    })
    .strict(),
  z.object({ scope: z.literal("realm"), realm: z.string().min(1), key: categoryKey }).strict(),
  z
    .object({ archive: z.literal(true), visibility: z.enum(["public", "staff"]).optional() })
    .strict(),
  z.object({ skip: z.literal(true) }).strict(),
]);

export type NodeTarget = z.infer<typeof nodeTargetSchema>;

export const nodeMapSchema = z
  .object({ nodes: z.record(z.string().regex(/^\d+$/), nodeTargetSchema) })
  .strict();

export type NodeMapFile = z.infer<typeof nodeMapSchema>;

export type TargetSource = "map" | "heuristic" | "default";

export interface ResolvedNode {
  node: XfNode;
  target: NodeTarget;
  source: TargetSource;
}

// Public seeds only: staff keys never come from a heuristic, only from an explicit map entry.
const HEURISTICS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^rules/i, "rules"],
  [/announce/i, "announcements"],
  [/(find|recruit|advertis).*(realm|region)|realm.*(find|recruit)/i, "find-a-realm"],
  [/^general|off.?topic/i, "general"],
  [/side.?game|^games?$/i, "side-games"],
];

const ARCHIVE: NodeTarget = { archive: true };
const SKIP: NodeTarget = { skip: true };
const FORUM_NODE_TYPE = "Forum";

export function heuristicTarget(title: string): NodeTarget {
  const hit = HEURISTICS.find(([pattern]) => pattern.test(title.trim()));
  return hit ? { scope: "site", key: hit[1] } : ARCHIVE;
}

export function resolveNodeTargets(
  nodes: readonly XfNode[],
  map: NodeMapFile | null
): ResolvedNode[] {
  return nodes.map((node) => {
    if (node.node_type_id !== FORUM_NODE_TYPE) return { node, target: SKIP, source: "default" };
    const mapped = map?.nodes[String(node.node_id)];
    if (mapped) return { node, target: mapped, source: "map" };
    const target = heuristicTarget(node.title);
    return { node, target, source: "archive" in target ? "default" : "heuristic" };
  });
}

export const archiveKey = (nodeId: number) => `xf-${nodeId}`;

export interface ArchiveCategory {
  key: string;
  name: string;
  description: string | null;
  order: number;
  visibility: "public" | "staff";
  postRole: "staff";
  icAllowed: false;
}

/** "Archive: <title>", after the seeds (order 1000 + display order); members read, only staff post. */
export function archiveCategory(node: XfNode, visibility: "public" | "staff"): ArchiveCategory {
  return {
    key: archiveKey(node.node_id),
    name: `Archive: ${node.title.trim()}`,
    description: stripHtml(node.description) || null,
    order: 1000 + node.display_order,
    visibility,
    postRole: "staff",
    icAllowed: false,
  };
}
