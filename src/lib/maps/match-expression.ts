import type { ExpressionSpecification } from "maplibre-gl";

/**
 * A MapLibre `match` expression over `[label, output]` pairs, else `fallback`. MapLibre rejects a
 * `match` with no cases, so an empty list yields the fallback as a plain literal.
 */
export function matchExpression(
  input: ExpressionSpecification,
  pairs: [string | number, string | number][],
  fallback: string | number
): ExpressionSpecification {
  if (pairs.length === 0) return ["literal", fallback];
  return ["match", input, ...pairs.flat(), fallback];
}
