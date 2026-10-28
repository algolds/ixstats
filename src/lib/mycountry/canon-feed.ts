/**
 * The Recent activity feed: storyteller effects, diplomatic events, decided national issues and
 * ledger rows merged into one wall-clock timeline. Every source is placed by when it was written in
 * real time (`createdAt`, a decision's `respondedAt`): an effect's `ixTimeTimestamp` is on its
 * nation's realm clock, which runs at its own speed, pauses and jumps, so it is never compared
 * with real time.
 */

export const CANON_FEED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** The oldest write (real time) inside the feed's 30 real-day window. */
export function canonFeedSince(nowMs: number): Date {
  return new Date(nowMs - CANON_FEED_WINDOW_MS);
}

export interface CanonFeedItem {
  id: string;
  kind: "effect" | "diplomacy" | "decision" | "ledger";
  title: string;
  category: string;
  /** Real-world epoch ms. */
  timestamp: number;
  deltaValue?: number | null;
  targetField?: string | null;
  sourceType?: string | null;
}

interface CanonFeedSources {
  effects: Array<{
    id: string;
    description: string | null;
    inputType: string;
    createdAt: Date;
  }>;
  events: Array<{ id: string; title: string; createdAt: Date }>;
  decisions: Array<{ id: string; title: string; respondedAt: Date | null; updatedAt: Date }>;
  logs: Array<{
    id: string;
    description: string;
    deltaValue: number | null;
    targetField: string | null;
    sourceType: string | null;
    createdAt: Date;
  }>;
}

export function buildCanonFeed(sources: CanonFeedSources, limit: number): CanonFeedItem[] {
  const items: CanonFeedItem[] = [
    ...sources.effects.map((e) => ({
      id: `eff_${e.id}`,
      kind: "effect" as const,
      // Effect rows name their source by code ("free_trade", "gdp_level_adjustment"): shown as words.
      title: (e.description ?? e.inputType).replace(/_/g, " "),
      category: e.inputType.toLowerCase().includes("popula") ? "social" : "economic",
      timestamp: e.createdAt.getTime(),
    })),
    ...sources.events.map((d) => ({
      id: `dip_${d.id}`,
      kind: "diplomacy" as const,
      title: d.title,
      category: "diplomatic",
      timestamp: d.createdAt.getTime(),
    })),
    ...sources.decisions.map((n) => ({
      id: `dec_${n.id}`,
      kind: "decision" as const,
      title: n.title,
      category: "governance",
      timestamp: (n.respondedAt ?? n.updatedAt).getTime(),
    })),
    ...sources.logs.map((l) => ({
      id: `log_${l.id}`,
      kind: "ledger" as const,
      title: l.description,
      category: "ledger",
      timestamp: l.createdAt.getTime(),
      deltaValue: l.deltaValue,
      targetField: l.targetField,
      sourceType: l.sourceType,
    })),
  ];
  items.sort((a, b) => b.timestamp - a.timestamp);
  return items.slice(0, limit);
}
