import { formatCompact } from "~/lib/format/compact";
import type { Ranking } from "~/types/mycountry";

/** Format a census value for display, in the category's own units. */
export function formatCensusValue(ranking: Pick<Ranking, "category" | "value">): string {
  const v = ranking.value;
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  switch (ranking.category) {
    case "GDP per Capita":
    case "Total GDP":
      return `$${formatCompact(Math.round(v))}`;
    case "Population":
      return formatCompact(Math.round(v));
    case "GDP Growth":
      return `${(v * 100).toFixed(1)}%`;
    case "Public Approval":
    case "Debt to GDP":
      return `${Math.round(v)}%`;
    case "Income Equality":
      return `Gini ${v.toFixed(2)}`;
    default:
      return `${Math.round(v)}/100`;
  }
}
