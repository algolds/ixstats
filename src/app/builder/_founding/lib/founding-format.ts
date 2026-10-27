/**
 * Plain formatting for the founding flow: people in words ("8.4 million"), money in short form
 * ("$1.2T"), and the nation card's figures with what each means and what moves it.
 */

import type { RouterOutputs } from "~/trpc/react";

export type FoundingSummary = RouterOutputs["countries"]["previewFounding"];

const oneDecimal = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

/** "2.5 million", "1.2 billion", "850,000". */
export function formatPeople(value: number): string {
  if (value >= 1e9) return `${oneDecimal(value / 1e9)} billion`;
  if (value >= 1e6) return `${oneDecimal(value / 1e6)} million`;
  return Math.round(value).toLocaleString("en-US");
}

/** "$1.2T", "$840B", "$12M", "$45,000". */
export function formatMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${sign}$${oneDecimal(abs / 1e12)}T`;
  if (abs >= 1e9) return `${sign}$${oneDecimal(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}$${oneDecimal(abs / 1e6)}M`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

/** "+2.4%", "-1.1%", "0%". */
export function formatSignedPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0%";
  return `${rounded > 0 ? "+" : "-"}${oneDecimal(Math.abs(rounded))}%`;
}

/** A figure that may still be loading (undefined) or be unavailable (null). */
export type Figure = number | null | undefined;

/** A summary figure as a Figure: unavailable when the preview failed or returned no number. */
export function figureOf(
  summary: FoundingSummary | null | undefined,
  key: Exclude<keyof FoundingSummary, "budgetBalanceLabel">
): Figure {
  if (summary === undefined) return undefined;
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export type NationFigureId =
  | "gdp"
  | "gdpPerCapita"
  | "budgetBalancePercentOfGdp"
  | "stability"
  | "governmentEffectiveness"
  | "expectedGrowth";

export interface NationFigureCopy {
  id: NationFigureId;
  label: string;
  format: (value: number) => string;
  /** The info popover: what the figure is and what moves it. */
  about: string;
  /** One plain sentence for the Review step. */
  sentence: (value: number, summary: FoundingSummary) => string;
}

const score = (value: number) => `${Math.round(value)} of 100`;

export const NATION_FIGURES: readonly NationFigureCopy[] = [
  {
    id: "gdp",
    label: "GDP",
    format: formatMoney,
    about:
      "Everything your nation produces in a year. It is population times GDP per person, so size and wealth move it.",
    sentence: (value) => `Your economy produces about ${formatMoney(value)} a year.`,
  },
  {
    id: "gdpPerCapita",
    label: "GDP per person",
    format: formatMoney,
    about: "Output per person, set by your wealth band or exact figure.",
    sentence: (value) => `That is about ${formatMoney(value)} for each person.`,
  },
  {
    id: "budgetBalancePercentOfGdp",
    label: "Budget balance",
    format: (value) => `${formatSignedPercent(value)} of GDP`,
    about:
      "Tax revenue minus government spending, as a share of GDP. Your archetype's tax profile sets both, and you can change them in MyCountry.",
    sentence: (value, summary) =>
      summary.budgetBalanceLabel === "Balanced"
        ? "Your starting budget is balanced: taxes cover spending."
        : value < 0
          ? `You start with a ${summary.budgetBalanceLabel.toLowerCase()}: spending exceeds taxes by ${formatSignedPercent(-value).replace("+", "")} of GDP.`
          : `You start with a surplus of ${formatSignedPercent(value).replace("+", "")} of GDP.`,
  },
  {
    id: "stability",
    label: "Stability",
    format: score,
    about: "How settled your nation is. Jobs, inequality, prices and wealth move it.",
    sentence: (value) =>
      value >= 70
        ? "Your people are settled and content."
        : value >= 45
          ? "Your nation is mostly calm, with some tension."
          : "Your nation starts restless, so watch for unrest.",
  },
  {
    id: "governmentEffectiveness",
    label: "Government effectiveness",
    format: score,
    about:
      "How well your institutions work together. Components that help each other raise it; conflicts lower it.",
    sentence: (value) =>
      value >= 70
        ? "Your institutions work well together."
        : value >= 45
          ? "Your institutions get the job done."
          : "Your institutions pull against each other.",
  },
  {
    id: "expectedGrowth",
    label: "Expected growth",
    format: formatSignedPercent,
    about:
      "How much the economy should grow in its first year, from your government and economic setup.",
    sentence: (value) =>
      value >= 0
        ? `The economy should grow about ${formatSignedPercent(value).replace("+", "")} in the first year.`
        : `The economy may shrink about ${formatSignedPercent(-value).replace("+", "")} in the first year.`,
  },
];
