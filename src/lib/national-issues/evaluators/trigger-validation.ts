/**
 * Structural check of a stored trigger condition tree (admin template editor, template integrity test). It knows every
 * condition kind the evaluator reads, so a `rank` condition saved from the editor is kept as written, and a typo (an
 * unknown kind, operator or ranked field, a share outside 0-1) is refused instead of silently never firing.
 */
import type { ComparisonOp } from "./condition-evaluator";
import { isRankedField } from "./realm-rank";

const OPS: readonly ComparisonOp[] = [">", ">=", "<", "<=", "==", "!=", "in", "between"];
const KINDS = ["and", "or", "not", "random", "rank", "count", "any", "field"] as const;
type Kind = (typeof KINDS)[number];
type Node = Record<string, unknown>;

const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);
const isOp = (v: unknown): v is ComparisonOp => typeof v === "string" && OPS.includes(v as ComparisonOp);
const isShare = (v: unknown) => typeof v === "number" && v > 0 && v <= 1;

function listErrors(items: unknown, path: string): string[] {
  if (!Array.isArray(items) || items.length === 0) return [`${path}: needs a non-empty list`];
  return items.flatMap((c, i) => triggerConditionErrors(c, `${path}[${i}]`));
}

function rankErrors(rank: unknown, path: string): string[] {
  if (!isNode(rank)) return [`${path}: rank needs { field, side?, share? }`];
  const errors: string[] = [];
  if (typeof rank.field !== "string" || !isRankedField(rank.field)) {
    errors.push(`${path}.field: ${String(rank.field)} is not a ranked field`);
  }
  if (rank.side !== undefined && rank.side !== "worst" && rank.side !== "best") {
    errors.push(`${path}.side: must be "worst" or "best"`);
  }
  if (rank.share !== undefined && !isShare(rank.share)) errors.push(`${path}.share: must be in (0, 1]`);
  return errors;
}

function leafErrors(node: Node, path: string): string[] {
  const errors: string[] = [];
  if (typeof node.field !== "string" || node.field === "") errors.push(`${path}.field: needs a name`);
  if (!isOp(node.op)) errors.push(`${path}.op: unknown operator ${String(node.op)}`);
  if (node.value === undefined) errors.push(`${path}.value: missing`);
  return errors;
}

const CHECKS: Record<Kind, (node: Node, path: string) => string[]> = {
  and: (n, p) => listErrors(n.and, `${p}.and`),
  or: (n, p) => listErrors(n.or, `${p}.or`),
  not: (n, p) => triggerConditionErrors(n.not, `${p}.not`),
  random: (n, p) => (isShare(n.random) ? [] : [`${p}.random: must be in (0, 1]`]),
  rank: (n, p) => rankErrors(n.rank, `${p}.rank`),
  count: (n, p) =>
    isNode(n.count) && typeof n.count.field === "string" && isOp(n.count.op) && typeof n.count.value === "number"
      ? []
      : [`${p}.count: needs { field, op, value: number }`],
  any: (n, p) =>
    isNode(n.any) && typeof n.any.field === "string"
      ? triggerConditionErrors(n.any.condition, `${p}.any.condition`)
      : [`${p}.any: needs { field, condition }`],
  field: leafErrors,
};

/** Every structural problem in a parsed trigger condition tree ([] when it is well formed). */
export function triggerConditionErrors(node: unknown, path = "$"): string[] {
  if (!isNode(node)) return [`${path}: must be an object`];
  const kinds = KINDS.filter((k) => k in node);
  if (kinds.length !== 1) return [`${path}: needs exactly one of ${KINDS.join(", ")}`];
  return CHECKS[kinds[0]!](node, path);
}
