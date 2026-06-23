/**
 * Government approval — derived, not stored.
 *
 * The drift cron already moves each party's `currentSupport`. Approval is just a read
 * over that: the governing (largest) party plus aligned partners carry the government,
 * blended with political stability. Pure so it can be shown anywhere and tested.
 *
 * ponytail: "governing bloc" = the single largest party, no coalition modelling. If
 * coalitions land, sum coalition members' support here instead.
 */

export interface PartySupport {
  id: string;
  currentSupport: number; // 0..100
}

/**
 * Approval = the leading party's support, nudged by stability (0..1 → ±10 pts).
 * Returns 0..100, rounded.
 */
export function computeApproval(parties: PartySupport[], stability01: number | null): number {
  if (parties.length === 0) return Math.round((stability01 ?? 0.5) * 100);
  const leader = parties.reduce((a, b) => (b.currentSupport > a.currentSupport ? b : a));
  const stabilityAdj = ((stability01 ?? 0.5) - 0.5) * 20; // ±10
  return Math.max(0, Math.min(100, Math.round(leader.currentSupport + stabilityAdj)));
}

/** True when a support move is big enough to be newsworthy (default 5 points). */
export function isNewsworthySwing(prev: number, next: number, threshold = 5): boolean {
  return Math.abs(next - prev) >= threshold;
}
