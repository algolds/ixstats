/**
 * Card levels: 1 to 10 from XP at 1,000 a level. XP keeps counting past level 10, as the Phase 4 SQL kept it when it
 * clamped higher levels to 10. Client-safe.
 */
import { utcDay } from "~/lib/vault/vault-dividend";

export const CARD_LEVEL_CAP = 10;
export const XP_PER_LEVEL = 1000;

export function clampLevel(level: number): number {
  return Math.min(CARD_LEVEL_CAP, Math.max(1, Math.floor(level)));
}

export function levelForXp(xp: number): number {
  return clampLevel(Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1);
}

export interface XpCapState {
  /** The UTC day `xpToday` counts for (a `@db.Date`, so UTC midnight). */
  xpDay: Date | null;
  xpToday: number;
}

/** How much of `amount` a copy may still gain today under `cap`, and its count afterwards. */
export function cappedXpGrant(
  state: XpCapState,
  amount: number,
  cap: number,
  now: Date
): { grant: number; xpToday: number } {
  const today = state.xpDay !== null && utcDay(state.xpDay) === utcDay(now) ? state.xpToday : 0;
  const grant = Math.max(0, Math.min(amount, cap - today));
  return { grant, xpToday: today + grant };
}
