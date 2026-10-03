import type { ExpressionSpecification } from "maplibre-gl";

/**
 * A MapLibre `match` expression over `[label, output]` pairs, else `fallback`. MapLibre rejects a
 * `match` with no cases or with a repeated label, so an empty list yields the fallback as a plain
 * literal and a repeated label keeps its first output.
 */
export function matchExpression(
  input: ExpressionSpecification,
  pairs: [string | number, string | number][],
  fallback: string | number
): ExpressionSpecification {
  const seen = new Set<string | number>();
  const unique = pairs.filter(([label]) => !seen.has(label) && seen.add(label));
  if (unique.length === 0) return ["literal", fallback];
  return ["match", input, ...unique.flat(), fallback];
}
