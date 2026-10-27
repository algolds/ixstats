/**
 * The national issue brief's pure parts: the stored response options and the deadline and
 * recon-arrival lines on the nation's clock (IssueDetailBrief renders them).
 */
import { CLOCK_PENDING, realMsUntil } from "~/lib/realms/nation-time";
import type { RealmClockReader } from "~/lib/realms/realm-clock";

export interface ReconRevealItem {
  targetField: string;
  value?: number | null;
  operation?: string;
  state?: "greyed" | "questioned" | "revealed" | string;
  reason?: string | null;
}

export interface ReconOptionItem {
  optionId: string;
  label: string;
  reveals: ReconRevealItem[];
}

export interface ResponseOption {
  id: string;
  label: string;
  description: string;
  previewEffects: {
    publicApproval?: number;
    economicImpact?: string;
    stabilityImpact?: string;
    diplomaticImpact?: string;
  };
  outcomeText: string;
  isRisky?: boolean;
  partyAlignment?: string;
  brokerAlignment?: string;
  costMessage?: string;
  requiredPolicyKey?: string;
  recommendedDirective?: string;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function parseOptions(raw: string | null | undefined): ResponseOption[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ResponseOption[];
  } catch {
    return [];
  }
}

/** A deadline is urgent with a day and a half of real time left at the realm's speed (three in-world days on ×2). */
const URGENT_REAL_MS = 1.5 * DAY_MS;

/** The deadline badge: in-world days left on the nation's clock, "Paused" while its realm is stopped. */
export function deadlineBadgeOf(
  deadline: number,
  now: number | null,
  clock: RealmClockReader | null
) {
  if (now === null || !clock) return { text: CLOCK_PENDING, urgent: false };
  const daysRemaining = (deadline - now) / DAY_MS;
  if (daysRemaining <= 0) return { text: "Deadline passed", urgent: true };
  if (clock.paused) return { text: "Paused", urgent: false };
  const realLeft = realMsUntil(deadline, now, clock.multiplier) ?? Infinity;
  return { text: `${Math.ceil(daysRemaining)} days remaining`, urgent: realLeft < URGENT_REAL_MS };
}

/** When cabinet research reports, in in-world days on the nation's clock. */
export function reconArrivalOf(
  readyIxTime: number | null | undefined,
  now: number | null,
  clock: RealmClockReader | null
) {
  if (now === null || !clock) return `Findings arrive in ${CLOCK_PENDING}.`;
  if (clock.paused) return "Paused: findings arrive when the realm resumes.";
  const days = Math.max(1, Math.ceil(((readyIxTime ?? 0) - now) / DAY_MS));
  return `Findings arrive in ${days} day(s).`;
}
