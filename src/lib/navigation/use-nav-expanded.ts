"use client";
/**
 * Which apps and admin groups are open in the source list. Read after hydration, so the server and
 * the first client render show only the current app open (the current app is always open and is
 * not stored). Synced across tabs.
 */
import { useSyncExternalStore } from "react";
import { NAV_STORAGE_KEYS } from "~/lib/design/appearance";

const listeners = new Set<() => void>();
// Where the list lives once storage refuses a write: the toggles still hold for this session.
let sessionRaw: string | null = null;
let storageBlocked = false;

function readRaw(): string | null {
  if (storageBlocked) return sessionRaw;
  try {
    return window.localStorage.getItem(NAV_STORAGE_KEYS.expanded);
  } catch {
    return null;
  }
}

function writeRaw(raw: string): void {
  try {
    window.localStorage.setItem(NAV_STORAGE_KEYS.expanded, raw);
  } catch {
    storageBlocked = true;
    sessionRaw = raw;
  }
  listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === NAV_STORAGE_KEYS.expanded) onChange();
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const serverRaw = () => null;

function parseExpanded(raw: string | null): Set<string> {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
    );
  } catch {
    return new Set();
  }
}

export function useNavExpanded(): { expanded: ReadonlySet<string>; toggle: (id: string) => void } {
  // The stored string is the snapshot (a parsed Set would be a new object on every read)
  const raw = useSyncExternalStore(subscribe, readRaw, serverRaw);
  const expanded: ReadonlySet<string> = parseExpanded(raw);

  const toggle = (id: string) => {
    const next = parseExpanded(readRaw());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeRaw(JSON.stringify([...next]));
  };

  return { expanded, toggle };
}
