"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { AgendaItem } from "./agendaTypes";

/**
 * Per-country agenda inbox state (read, done, snoozed), kept in this browser only.
 *
 * Items are derived from live game state, so the store holds flags, not items: one entry per
 * item id, tagged with the item's `version`. When the underlying state changes (an issue
 * escalates, a deadline or an election moves) the version changes, the old flags no longer
 * apply, and the item comes back unread in the inbox. Entries for items that no longer exist are
 * pruned on the next write. Snoozes use real (wall-clock) time.
 */

export const AGENDA_INBOX_STORAGE_PREFIX = "ixstats:agenda-inbox:";

export function inboxStorageKey(countryId: string): string {
  return `${AGENDA_INBOX_STORAGE_PREFIX}${countryId}`;
}

export const SNOOZE_DAY_MS = 24 * 60 * 60 * 1000;
export const SNOOZE_WEEK_MS = 7 * SNOOZE_DAY_MS;

export interface InboxEntry {
  /** The item version these flags were set for. */
  v: string;
  read?: boolean;
  done?: boolean;
  /** Real-time ms until which the item is hidden from the inbox. */
  snoozedUntil?: number;
}

export type InboxStore = Readonly<Record<string, InboxEntry>>;

export type InboxPlacement = "inbox" | "snoozed" | "done";

export interface InboxView {
  item: AgendaItem;
  read: boolean;
  placement: InboxPlacement;
  snoozedUntil?: number;
}

type Versioned = Pick<AgendaItem, "id" | "version">;

/** The item's stored flags, if they were set for its current version. */
export function entryFor(store: InboxStore, item: Versioned): InboxEntry | undefined {
  const entry = store[item.id];
  return entry && entry.v === item.version ? entry : undefined;
}

/** Each item with its read state and where it lives (inbox, snoozed or done). */
export function resolveInbox(
  items: readonly AgendaItem[],
  store: InboxStore,
  nowMs: number
): InboxView[] {
  return items.map((item) => {
    const entry = entryFor(store, item);
    const read = entry?.read ?? item.seen;
    if (entry?.done) return { item, read, placement: "done" };
    if (entry?.snoozedUntil && entry.snoozedUntil > nowMs) {
      return { item, read, placement: "snoozed", snoozedUntil: entry.snoozedUntil };
    }
    return { item, read, placement: "inbox" };
  });
}

function patch(store: InboxStore, item: Versioned, change: Partial<InboxEntry>): InboxStore {
  const current = entryFor(store, item);
  const next: InboxEntry = { ...current, ...change, v: item.version };
  for (const key of Object.keys(next) as (keyof InboxEntry)[]) {
    if (next[key] === undefined) delete next[key];
  }
  return { ...store, [item.id]: next };
}

export function setRead(store: InboxStore, items: readonly Versioned[], read: boolean): InboxStore {
  return items.reduce((s, item) => patch(s, item, { read }), store);
}

export function markDone(store: InboxStore, item: Versioned): InboxStore {
  return patch(store, item, { done: true, snoozedUntil: undefined, read: true });
}

/** Hide until `untilMs`; it comes back unread, like a snoozed email. */
export function snooze(store: InboxStore, item: Versioned, untilMs: number): InboxStore {
  return patch(store, item, { snoozedUntil: untilMs, done: undefined, read: false });
}

/** Back to the inbox (undo done or snooze); read state is kept. */
export function moveToInbox(store: InboxStore, item: Versioned): InboxStore {
  return patch(store, item, { done: undefined, snoozedUntil: undefined });
}

/**
 * Drop entries whose item is gone or has changed version, and expired snoozes. Returns the same
 * object when nothing changed.
 */
export function pruneInbox(store: InboxStore, items: readonly Versioned[], nowMs: number): InboxStore {
  const versions = new Map(items.map((i) => [i.id, i.version]));
  let changed = false;
  const next: Record<string, InboxEntry> = {};
  for (const [id, entry] of Object.entries(store)) {
    if (versions.get(id) !== entry.v) {
      changed = true;
      continue;
    }
    if (entry.snoozedUntil !== undefined && entry.snoozedUntil <= nowMs) {
      const { snoozedUntil: _expired, ...rest } = entry;
      next[id] = rest;
      changed = true;
      continue;
    }
    next[id] = entry;
  }
  return changed ? next : store;
}

function isEntry(value: unknown): value is InboxEntry {
  return !!value && typeof value === "object" && typeof (value as InboxEntry).v === "string";
}

/** Parse stored inbox state; `{}` when empty or corrupt. */
export function parseInboxStore(raw: string | null): InboxStore {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isEntry(v))) as InboxStore;
  } catch {
    return {};
  }
}

function readRaw(countryId: string): string | null {
  try {
    return window.localStorage.getItem(inboxStorageKey(countryId));
  } catch {
    return null;
  }
}

/** Read a country's inbox state; `{}` when storage is unavailable, empty or corrupt. */
export function readInboxStore(countryId: string): InboxStore {
  return parseInboxStore(readRaw(countryId));
}

const listeners = new Set<() => void>();

export function writeInboxStore(countryId: string, store: InboxStore): void {
  try {
    const key = inboxStorageKey(countryId);
    if (Object.keys(store).length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(store));
  } catch {
    // Private mode or storage full: nothing persists, the inbox still reads what it can.
  }
  listeners.forEach((notify) => notify());
}

/** Local writes notify directly; other tabs arrive through the `storage` event. */
function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(AGENDA_INBOX_STORAGE_PREFIX)) notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

/** Real time, refreshed every minute (for "2h ago" labels and snooze expiry). */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export interface AgendaInbox {
  views: InboxView[];
  nowMs: number;
  setRead: (items: readonly AgendaItem[], read: boolean) => void;
  markDone: (item: AgendaItem) => void;
  snooze: (item: AgendaItem, forMs: number) => void;
  moveToInbox: (item: AgendaItem) => void;
}

/**
 * The agenda inbox for one country: derived items + this browser's read/done/snooze flags,
 * persisted under `ixstats:agenda-inbox:<countryId>` (and kept in sync across tabs). Stale
 * entries are pruned whenever the inbox is written — but only once `ready` (the sources have
 * loaded), so a half-loaded list never discards stored flags.
 */
export function useAgendaInbox(
  countryId: string,
  items: readonly AgendaItem[],
  ready: boolean
): AgendaInbox {
  const nowMs = useMinuteClock();
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(countryId),
    () => null
  );
  const store = useMemo(() => parseInboxStore(raw), [raw]);
  const views = useMemo(() => resolveInbox(items, store, nowMs), [items, store, nowMs]);

  const commit = useCallback(
    (change: (s: InboxStore) => InboxStore) => {
      let next = change(readInboxStore(countryId));
      if (ready) next = pruneInbox(next, items, Date.now());
      writeInboxStore(countryId, next);
    },
    [countryId, items, ready]
  );

  return {
    views,
    nowMs,
    setRead: useCallback((list, read) => commit((s) => setRead(s, list, read)), [commit]),
    markDone: useCallback((item) => commit((s) => markDone(s, item)), [commit]),
    snooze: useCallback(
      (item, forMs) => commit((s) => snooze(s, item, Date.now() + forMs)),
      [commit]
    ),
    moveToInbox: useCallback((item) => commit((s) => moveToInbox(s, item)), [commit]),
  };
}
