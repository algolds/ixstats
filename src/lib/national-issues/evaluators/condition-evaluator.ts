import type { CountrySnapshot } from "../engine";

export type ComparisonOp = ">" | ">=" | "<" | "<=" | "==" | "!=" | "in" | "between";

export type TriggerCondition =
  | { and: TriggerCondition[] }
  | { or: TriggerCondition[] }
  | { not: TriggerCondition }
  | {
      field: string;
      op: ComparisonOp;
      value: number | string | boolean | (number | string)[];
      value2?: number;
    }
  | { random: number }
  | { count: { field: string; op: ComparisonOp; value: number } }
  | { any: { field: string; condition: TriggerCondition } };

/**
 * Table of comparison operator evaluators
 */
const SCALAR_OPERATORS: Record<
  ComparisonOp,
  (fieldVal: unknown, targetVal: unknown, value2?: number) => boolean
> = {
  ">": (a, b) => (a as number) > (b as number),
  ">=": (a, b) => (a as number) >= (b as number),
  "<": (a, b) => (a as number) < (b as number),
  "<=": (a, b) => (a as number) <= (b as number),
  "==": (a, b) => a === b,
  "!=": (a, b) => a !== b,
  in: (a, b) => Array.isArray(b) && b.includes(a as string | number),
  between: (a, b, value2) =>
    (a as number) >= (b as number) && (a as number) <= (value2 ?? Infinity),
};

/**
 * Get a field value from the snapshot by key name. Supports nested dot notation.
 */
export function getSnapshotField(snapshot: CountrySnapshot, field: string): unknown {
  if (field.includes(".")) {
    const parts = field.split(".");
    let current: unknown = snapshot;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") return null;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
  if (field in snapshot) {
    return (snapshot as unknown as Record<string, unknown>)[field];
  }
  return null;
}

/**
 * Compare a resolved value against a field-comparison condition.
 */
export function evaluateValue(
  fieldValue: unknown,
  condition: {
    field: string;
    op: ComparisonOp;
    value: number | string | boolean | (number | string)[];
    value2?: number;
  }
): boolean {
  if (Array.isArray(fieldValue)) {
    const contains = (fieldValue as unknown[]).includes(condition.value);
    if (condition.op === "in" || condition.op === "==") return contains;
    if (condition.op === "!=") return !contains;
    return false;
  }

  const evaluator = SCALAR_OPERATORS[condition.op];
  return evaluator ? evaluator(fieldValue, condition.value, condition.value2) : false;
}

/**
 * Evaluates an AST trigger condition against a country snapshot.
 * Cyclomatic complexity < 10.
 */
export function evaluateTriggerCondition(
  condition: TriggerCondition,
  snapshot: CountrySnapshot
): boolean {
  if ("and" in condition) {
    return condition.and.every((c) => evaluateTriggerCondition(c, snapshot));
  }
  if ("or" in condition) {
    return condition.or.some((c) => evaluateTriggerCondition(c, snapshot));
  }
  if ("not" in condition) {
    return !evaluateTriggerCondition(condition.not, snapshot);
  }
  if ("random" in condition) {
    return Math.random() < condition.random;
  }
  if ("count" in condition) {
    const fieldValue = getSnapshotField(snapshot, condition.count.field);
    if (!Array.isArray(fieldValue)) return false;
    const n = fieldValue.length;
    const op = SCALAR_OPERATORS[condition.count.op];
    return op ? op(n, condition.count.value) : false;
  }
  if ("any" in condition) {
    const fieldValue = getSnapshotField(snapshot, condition.any.field);
    if (!Array.isArray(fieldValue)) return false;
    return fieldValue.some((el) => {
      if (el === null || typeof el !== "object") return false;
      return evaluateTriggerCondition(condition.any.condition, el as CountrySnapshot);
    });
  }

  const fieldValue = getSnapshotField(snapshot, condition.field);
  if (fieldValue === null || fieldValue === undefined) return false;

  return evaluateValue(fieldValue, condition);
}
