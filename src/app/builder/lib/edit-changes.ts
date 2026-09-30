/**
 * Edit-mode change tracking for the country editor (pure helpers).
 *
 * The tracked fields are exactly the parts of BuilderState that the editor
 * saves (the countries.updateCountry payload); navigation and view state
 * (step, tabs, showAdvancedMode) never count as a change.
 */

import { isEqual } from "~/lib/utils";
import type { BuilderState } from "../hooks/builderStateTypes";

export const TRACKED_FIELDS = [
  "economicInputs",
  "governmentComponents",
  "taxSystemData",
  "governmentStructure",
  "economyBuilderState",
] as const;

export type TrackedData = Pick<BuilderState, (typeof TRACKED_FIELDS)[number]>;

/** Bookkeeping keys that change without the user editing anything. */
const IGNORED_KEYS = new Set(["lastUpdated", "version", "isValid", "errors", "validation"]);

type FieldScalar = string | number | boolean;
type FieldNode = FieldScalar | null | undefined | object;

export interface FieldChange {
  /** Dotted path, e.g. "economicInputs.nationalIdentity.capitalCity". Lists count as one field. */
  path: string;
  /** The field's current value when it is a string, number or boolean. */
  value?: FieldScalar;
}

export function pickTrackedData(state: BuilderState): TrackedData {
  return {
    economicInputs: state.economicInputs,
    governmentComponents: state.governmentComponents,
    taxSystemData: state.taxSystemData,
    governmentStructure: state.governmentStructure,
    economyBuilderState: state.economyBuilderState,
  };
}

function isBranch(node: FieldNode): node is object {
  return typeof node === "object" && node !== null && !Array.isArray(node) && !(node instanceof Date);
}

function toScalar(node: FieldNode): FieldScalar | undefined {
  return typeof node === "string" || typeof node === "number" || typeof node === "boolean"
    ? node
    : undefined;
}

function collectChanges(path: string, before: FieldNode, after: FieldNode, out: FieldChange[]) {
  if (isBranch(before) && isBranch(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (IGNORED_KEYS.has(key)) continue;
      collectChanges(`${path}.${key}`, Reflect.get(before, key), Reflect.get(after, key), out);
    }
    return;
  }
  if (!isEqual(before, after)) {
    out.push({ path, value: toScalar(after) });
  }
}

/** Every saved field whose value differs between the baseline and the current state. */
export function getChangedFields(baseline: TrackedData, current: TrackedData): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of TRACKED_FIELDS) {
    collectChanges(field, baseline[field], current[field], changes);
  }
  return changes;
}

/** Appends to a stack, dropping the oldest entries beyond `max`. */
export function pushBounded<T>(stack: readonly T[], item: T, max: number): T[] {
  return [...stack, item].slice(-max);
}

/** "Health Expenditure (GDP %)" and "healthExpenditureGDP" both become "healthexpendituregdp". */
export function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Changed scalar fields, keyed by normalized field name, with their current values. */
export type ChangedFieldIndex = ReadonlyMap<string, readonly FieldScalar[]>;

export function indexChangesByName(changes: readonly FieldChange[]): ChangedFieldIndex {
  const index = new Map<string, FieldScalar[]>();
  for (const { path, value } of changes) {
    if (value === undefined) continue;
    const name = normalizeFieldName(path.slice(path.lastIndexOf(".") + 1));
    index.set(name, [...(index.get(name) ?? []), value]);
  }
  return index;
}

/**
 * Whether a field shown as `name` (its key or its label) with `value` is one of
 * the changed fields. Matching the value too keeps same-named fields elsewhere
 * in the state from lighting up.
 */
export function isFieldChanged(index: ChangedFieldIndex, name: string, value: FieldScalar): boolean {
  return index.get(normalizeFieldName(name))?.includes(value) ?? false;
}
