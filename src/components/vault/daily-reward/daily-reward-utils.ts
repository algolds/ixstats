import { useSyncExternalStore, type CSSProperties } from "react";
import { withBasePath } from "~/lib/base-path";
import type { CardFaceData } from "~/lib/cards/face/types";

export type ClaimChoice = "CREDITS" | "CARD";

export interface ClaimResult {
  creditsAwarded?: number;
  /** The pulled card, kept for when its face could not be read after the claim committed. */
  cardAwarded?: { id: string; title: string };
  /** The pulled copy's face; null for a credits claim. */
  cardFace?: CardFaceData | null;
  streak: number;
  message?: string;
}

/** Daily claims reset at 00:00 UTC on the server, so the auto-open key follows the same day. */
const utcDayKey = () => new Date().toISOString().slice(0, 10);
const autoOpenStorageKey = (userId: string) => `ixstats:dailyReward:autoOpened:${userId}`;

let autoOpenedInSession: string | null = null;

export function hasAutoOpenedToday(userId: string): boolean {
  if (autoOpenedInSession === `${userId}:${utcDayKey()}`) return true;
  try {
    return window.localStorage.getItem(autoOpenStorageKey(userId)) === utcDayKey();
  } catch {
    return false;
  }
}

export function markAutoOpenedToday(userId: string): void {
  autoOpenedInSession = `${userId}:${utcDayKey()}`;
  try {
    window.localStorage.setItem(autoOpenStorageKey(userId), utcDayKey());
  } catch {
    // Storage unavailable (private mode, blocked): the in-memory guard still covers this session.
  }
}

/** Resets in-memory session latch (used by tests). */
export function resetAutoOpenedInSession(): void {
  autoOpenedInSession = null;
}

/** The roll's boost for today's claim, as the server applies it (`lib/vault/daily-roll.ts`). */
export const formatBoost = (multiplier: number): string => `×${multiplier.toFixed(2)}`;

/** Time until the next claim opens at 00:00 UTC, e.g. "9h 12m". */
export function untilNextClaim(now = new Date()): string {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const mins = Math.max(1, Math.ceil((next - now.getTime()) / 60_000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function subscribeMinute(onStoreChange: () => void): () => void {
  const id = window.setInterval(onStoreChange, 60_000);
  return () => window.clearInterval(id);
}

/** Live client-side countdown to 00:00 UTC, with a deterministic SSR fallback. */
export function useUtcResetCountdown(): string {
  return useSyncExternalStore(
    subscribeMinute,
    () => untilNextClaim(new Date()),
    () => "tomorrow"
  );
}

/**
 * Multi-plane Ixnay monogram layers matching the front-page hero (`PlatformTopBar.tsx`):
 * each layer wears its own `data-app` tint and drifts opposite the pointer by `depth` px so the
 * emblems (`depth: 8`) separate cleanly from the app marks (`depth: 16`) as the mouse moves.
 */
export const MONOGRAM_LAYERS = (
  [
    ["wiki", 8],
    ["mycountry", 16],
    ["maps", 16],
    ["realms", 16],
  ] as const
).map(([app, depth]) => ({
  app,
  depth,
  style: {
    "--monogram": `url("${withBasePath(`/images/ix-monogram-${app}.svg`)}")`,
    "--monogram-strength": "9%",
  } as CSSProperties,
}));
