import { DAY_MS } from "~/lib/realms/realm-calendar";

/**
 * Summits: a meeting of two nations' leaders, proposed like a treaty (the target accepts or declines in its
 * diplomacy inbox) and stored as a `ForeignPolicyAction` with `actionType: "summit"`, its date in
 * `effectiveIxTime` and its agenda in `description`. Agreeing warms relations; a summit has no economic effect.
 */
export const SUMMIT_TYPE = "summit";

/** How far ahead a summit can be set, on the proposer's realm clock. */
export const SUMMIT_WHEN = {
  month: { days: 30, label: "In a month" },
  quarter: { days: 91, label: "In 3 months" },
  half: { days: 182, label: "In 6 months" },
} as const;

export type SummitWhen = keyof typeof SUMMIT_WHEN;
export const SUMMIT_WHEN_KEYS = Object.keys(SUMMIT_WHEN) as [SummitWhen, ...SummitWhen[]];

/** Relation strength (0 to 100) an agreed summit adds. */
export const SUMMIT_RELATION_BOOST = 5;

export const SUMMIT_AGENDA_MAX = 500;

/** The summit's date on the proposer's clock. */
export function summitDate(nowClockMs: number, when: SummitWhen): number {
  return nowClockMs + SUMMIT_WHEN[when].days * DAY_MS;
}

/** An agreed summit is upcoming until its date, then held. */
export function summitPhase(dateClockMs: number | null, nowClockMs: number): "upcoming" | "held" {
  return dateClockMs !== null && dateClockMs > nowClockMs ? "upcoming" : "held";
}

/** Distinct nations this one has held summits with (the Summit circuit achievement). */
export function summitPartners(
  countryId: string,
  held: readonly { initiatorId: string; targetId: string }[]
): number {
  return new Set(held.map((s) => (s.initiatorId === countryId ? s.targetId : s.initiatorId))).size;
}
