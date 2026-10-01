/**
 * Facet 3.1 identity helpers (spec §16).
 *
 * Shared by the primitives that switch figures into the data face (`font-data`: Azeret Mono,
 * tabular, slashed zero — the v2 `.font-mono`): `Badge`, `FacetRow` trailing values, `Table`
 * cells. Callers can always opt in explicitly (`numeric` props, or the `font-data` class).
 */

/**
 * A figure written as text: an optional sign/currency/rank prefix, digits with grouping or
 * decimal separators, and an optional unit suffix (`%`, `K`/`M`/`B`/`T`, `bn`, `×`).
 * `"1,204"`, `"+2.4%"`, `"−120"`, `"$1.2T"`, `"#3"`, `"12 / 40"`, `"4.5×"` match; `"12 unread"`,
 * `"Tier 3"`, `"v2"` do not.
 */
const NUMERIC_TEXT =
  /^[+\-−–±~≈]?\s?[#$€£¥₹₩]?\s?\d[\d.,:'’\s/]*(?:\s?(?:%|[kKmMbBtT]|bn|mn|tn|[x×]))?$/u;

export function isNumericText(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const text = value.trim();
  return text.length > 0 && text.length <= 24 && NUMERIC_TEXT.test(text);
}

/** The data face for a figure: mono, tabular, slashed zero (use on stats, counts, IDs). */
export const DATA_FONT = "font-data tabular-nums";
