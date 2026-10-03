import type { ExpressionSpecification } from "maplibre-gl";

/** A MapLibre `match` expression over `[label, output]` pairs (at least one), else `fallback`. */
export function matchExpression(
  input: ExpressionSpecification,
  pairs: [string | number, string | number][],
  fallback: string | number
): ExpressionSpecification {
  const [first, ...rest] = pairs;
  return ["match", input, first![0], first![1], ...rest.flat(), fallback];
}
