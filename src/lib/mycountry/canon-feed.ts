import { IxTime } from "~/lib/ixtime";

/**
 * The Recent activity feed: storyteller effects, diplomatic events, decided national issues and
 * ledger rows merged into one wall-clock timeline. Effects are stamped in IxTime
 * (`ixTimeTimestamp`), every other source in real time (`createdAt`), so effects are converted to
 * real time before they are sorted against the rest and before the client prints "2h ago".
 */

export const CANON_FEED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** The oldest effect stamp (IxTime) inside the feed's 30 real-day window. */
export function canonFeedEffectSince(nowMs: number): Date {
  return new Date(IxTime.convertToIxTime(nowMs - CANON_FEED_WINDOW_MS));
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
    ixTimeTimestamp: Date;
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
      title: e.description ?? e.inputType,
      category: e.inputType.toLowerCase().includes("popula") ? "social" : "economic",
      timestamp: IxTime.convertFromIxTime(e.ixTimeTimestamp.getTime()),
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
