import { STATUS_TEXT } from "./status-tone";

export interface CanonFeedItem {
  id: string;
  title: string;
  category?: string;
  timestamp: number | string | Date;
  kind?: string;
  description?: string | null;
  deltaValue?: number | null;
  targetField?: string | null;
}

/** Badge text colour: only a direction of change (or a directive's accent) carries colour. */
export const POSITIVE = "text-green";
export const NEGATIVE = STATUS_TEXT.critical;
const NEUTRAL = STATUS_TEXT.neutral;

export function formatDeltaValue(val: number | null | undefined): string {
  if (val === null || val === undefined || !isFinite(val)) return "Updated";
  const formatted = Math.abs(val).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return `${val > 0 ? "+" : val < 0 ? "-" : ""}${formatted}`;
}

interface Narrative {
  narrative: string;
  badge?: { text: string; direction?: "up" | "down" | "neutral"; cls: string };
}

/** Ledger sentences per metric: [when it rose, otherwise], given the formatted change. */
const METRIC_NARRATIVES: Record<string, [up: (d: string) => string, down: (d: string) => string]> =
  {
    currentPopulation: [
      (d) =>
        `Demographic growth recorded a net addition of ${d} citizens following regional migration and baseline birth balance.`,
      (d) =>
        `Demographic census registered a net reduction of ${d} citizens across monitored urban sectors.`,
    ],
    currentTotalGdp: [
      (d) =>
        `National economic output expanded by ${d} total GDP, driven by active trade channels and commercial yield.`,
      (d) =>
        `National economic output experienced a contraction of ${d} total GDP due to fiscal adjustments and market cooling.`,
    ],
    currentGdpPerCapita: [
      (d) =>
        `Average per capita purchasing power rose by ${d}, improving household prosperity metrics.`,
      (d) =>
        `Average per capita income shifted by ${d} as population totals and GDP output adjusted.`,
    ],
    economicVitality: [
      (d) => `Economic vitality index gained +${d} points following positive fiscal performance.`,
      (d) => `Economic vitality index adjusted by ${d} points reflecting recent market headwinds.`,
    ],
    populationWellbeing: [
      (d) =>
        `Population wellbeing index rose by +${d} points thanks to expanded social and healthcare coverage.`,
      (d) =>
        `Population wellbeing index adjusted by ${d} points during administrative recalculation.`,
    ],
    diplomaticStanding: [
      (d) =>
        `Diplomatic standing index gained +${d} points following active embassy treaties and international prestige.`,
      (d) =>
        `Diplomatic standing index shifted by ${d} points amidst regional diplomatic negotiations.`,
    ],
    governmentalEfficiency: [
      (d) =>
        `Governmental efficiency index advanced by +${d} points due to streamlined civil service throughput.`,
      (d) =>
        `Governmental efficiency index adjusted by ${d} points following administrative bureau reorganizations.`,
    ],
  };

function describedBadge(item: CanonFeedItem): Narrative["badge"] {
  if (item.deltaValue == null) return undefined;
  const deltaStr = formatDeltaValue(item.deltaValue);
  if (item.deltaValue > 0) return { text: `${deltaStr} increase`, direction: "up", cls: POSITIVE };
  if (item.deltaValue < 0)
    return { text: `${deltaStr} decrease`, direction: "down", cls: NEGATIVE };
  return { text: "No net change", direction: "neutral", cls: NEUTRAL };
}

function ledgerNarrative(item: CanonFeedItem, field: string, metaLabel: string): Narrative {
  const deltaStr = formatDeltaValue(item.deltaValue);
  const isPositive = (item.deltaValue ?? 0) > 0;
  const metric = METRIC_NARRATIVES[field];
  return {
    narrative: metric
      ? metric[isPositive ? 0 : 1](deltaStr)
      : `Simulation metric '${field}' adjusted by ${deltaStr} under the ${metaLabel.toLowerCase()} domain ledger.`,
    badge: {
      text: `${field}: ${deltaStr}`,
      direction: isPositive ? "up" : "down",
      cls: isPositive ? POSITIVE : NEGATIVE,
    },
  };
}

/** The expanded-row text and badge for a feed item, from its description or by kind. */
export function describeRecord(item: CanonFeedItem, metaLabel: string): Narrative {
  if (item.description && item.description.trim().length > 10) {
    return { narrative: item.description.trim(), badge: describedBadge(item) };
  }

  switch (item.kind) {
    case "effect":
      return {
        narrative: `Storyteller directive logged: "${item.title}". The Executive Command Engine calculated real-time state shifts across national ${metaLabel.toLowerCase()} subsystems.`,
        badge: { text: "Storyteller effect", cls: STATUS_TEXT.accent },
      };
    case "diplomacy":
      return {
        narrative: `Bilateral event "${item.title}" registered in global diplomatic dispatches. Foreign ministry officials report ongoing international standing alignment.`,
        badge: { text: "Foreign dispatch", cls: NEUTRAL },
      };
    case "decision":
      return {
        narrative: `Executive resolution enacted: "${item.title}". Cabinet civil service departments have finalized implementation across local administrative channels.`,
        badge: { text: "Executive resolution", cls: NEUTRAL },
      };
    case "ledger":
      if (item.targetField) {
        return ledgerNarrative(item, item.targetField, metaLabel);
      }
  }

  return {
    narrative: `Canon event '${item.title}' recorded under the ${metaLabel.toLowerCase()} domain.`,
    badge: { text: "Canon record", cls: NEUTRAL },
  };
}
