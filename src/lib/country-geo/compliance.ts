/**
 * Wiki contradiction check for geographic entities: compares a parsed wiki value with the stored one.
 */

/** Threshold for treating two values as "the same" when checking contradictions. */
const POPULATION_TOLERANCE = 0.1; // ±10% counts as a soft match
const GDP_TOLERANCE = 0.1;

/**
 * Compare a parsed wiki field to the entity's existing value and return
 * a "match", "soft-mismatch", or "hard-mismatch" verdict. Used by the
 * UI to flag contradictions when populating from a wiki page.
 */
export type ContradictionVerdict = "match" | "soft-mismatch" | "hard-mismatch" | "new";

export function compareValues(
  field: string,
  existing: number | string | null | undefined,
  parsed: number | string
): ContradictionVerdict {
  if (existing == null || existing === "") return "new";

  // Numeric comparison with tolerance.
  if (typeof existing === "number" && typeof parsed === "number") {
    if (existing === 0) {
      return parsed === 0 ? "match" : "hard-mismatch";
    }
    const ratio = Math.abs(parsed - existing) / Math.abs(existing);
    if (ratio <= 0.05) return "match";
    const tol = field.startsWith("population") ? POPULATION_TOLERANCE : GDP_TOLERANCE;
    if (ratio <= tol) return "soft-mismatch";
    return "hard-mismatch";
  }

  // String comparison (case-insensitive, whitespace-normalized).
  if (typeof existing === "string" && typeof parsed === "string") {
    const a = existing.trim().toLowerCase();
    const b = parsed.trim().toLowerCase();
    if (a === b) return "match";
    // Soft mismatch: same prefix/contains.
    if (a.includes(b) || b.includes(a)) return "soft-mismatch";
    return "hard-mismatch";
  }

  // Mismatched types.
  return "hard-mismatch";
}
