/**
 * plate-fingerprint.ts — a stable string for the content of a Plate subtree (plan 414).
 *
 * The visual editor records `plateFingerprint(node)` on every block (and link) when it loads a
 * page; when the page is saved, a node whose fingerprint still matches is unmodified and its
 * original wikitext is written back verbatim. The same function runs at load and at save.
 *
 * The fingerprint is the same before and after Slate's own normalisation: adjacent text leaves
 * with equal marks are merged, empty text leaves, `undefined`/`false` marks, the provenance
 * properties and Plate's node `id` are ignored. Every other property of a node counts, so any
 * edit (and any new element type or property) makes the node "modified" and re-serialised.
 *
 * Maintenance: a property that must NOT make a block look modified has to be added to
 * `IGNORED_NODE_KEYS`; anything else is safe by default.
 */

type FingerprintValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | FingerprintValue[]
  | { [key: string]: FingerprintValue };

type FingerprintObject = { [key: string]: FingerprintValue };

/** Provenance written by `astToPlateNodes`, and the `id` Plate assigns: never content. */
const IGNORED_NODE_KEYS = new Set([
  "wikiRaw",
  "wikiSep",
  "wikiFp",
  "wikiSrc",
  "wikiLead",
  "wikiTrail",
  "wikiTableHead",
  "wikiTableHeadFp",
  "wikiTableTail",
  "id",
]);

const isObject = (value: FingerprintValue): value is FingerprintObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTextLeaf = (value: FingerprintValue): value is FingerprintObject & { text: string } =>
  isObject(value) && typeof value["text"] === "string" && !("children" in value);

/** A plain value (a params record, a parameter list): keys sorted, `undefined` dropped. */
function canonicalValue(value: FingerprintValue): FingerprintValue {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isObject(value)) return value;
  const out: FingerprintObject = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) out[key] = canonicalValue(value[key]);
  }
  return out;
}

/** The marks of a text leaf (every property but the text), as a comparable string. */
const marksOf = (leaf: FingerprintObject): string =>
  JSON.stringify(Object.entries(leaf).filter(([key]) => key !== "text"));

/** The children of a node: text leaves merged, empty ones dropped. */
function canonicalChildren(children: FingerprintValue[]): FingerprintValue[] {
  const out: FingerprintValue[] = [];
  for (const child of children) {
    const canonical = canonicalNode(child);
    const prev = out[out.length - 1];
    if (isTextLeaf(canonical)) {
      if (canonical.text === "") continue;
      if (prev !== undefined && isTextLeaf(prev) && marksOf(prev) === marksOf(canonical)) {
        prev.text += canonical.text;
        continue;
      }
    }
    out.push(canonical);
  }
  return out;
}

function canonicalNode(node: FingerprintValue): FingerprintValue {
  if (!isObject(node)) return canonicalValue(node);
  const leaf = typeof node["text"] === "string" && !("children" in node);
  const out: FingerprintObject = {};
  for (const key of Object.keys(node).sort()) {
    const value = node[key];
    if (IGNORED_NODE_KEYS.has(key) || value === undefined) continue;
    if (leaf && key !== "text" && (value === false || value === null)) continue; // an off mark
    out[key] = key === "children" && Array.isArray(value) ? canonicalChildren(value) : canonicalValue(value);
  }
  return out;
}

export function plateFingerprint(node: object): string {
  return JSON.stringify(canonicalNode(node as FingerprintValue));
}
