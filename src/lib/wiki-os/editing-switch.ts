/**
 * The WikiOS editing switch (admin toggle, /admin/wikios-settings): whether WikiOS takes writes and mirrors them to
 * classic MediaWiki, without the full v1 cutover. `WIKIOS_V1_ENABLED` (v1-switch.ts) forces it on. Inbound sync, lore
 * cards, lorewards, search and background renders stay on the v1 switch.
 *
 * In either mode writes also wait for the protections marker (`WIKIOS_PROTECTIONS_MARKER_KEY`, written by the rights
 * import), so a page protected on MediaWiki is never open in WikiOS. Before the marker is first read the synchronous
 * check counts it as there; every write entry point awaits the read, and refuses when it finds no row or fails with no
 * earlier successful read to fall back on.
 *
 * Both rows are read at most once per TTL per process, so a flip reaches every process (app, cron runner, standalone
 * WikiOS) within the TTL. Write entry points await `refreshWikiosEditingFlag()`; any synchronous read of a stale cache
 * starts a background refresh.
 */
import { db } from "~/server/db";
import {
  isWikiosV1Enabled,
  WIKIOS_PROTECTIONS_MARKER_KEY,
  WIKIOS_PROTECTIONS_REASON,
  WIKIOS_READONLY_REASON,
} from "./v1-switch";

export const WIKIOS_EDITING_KEY = "wikios_editing_enabled";
const TTL_MS = 15_000;

let cachedFlag = false;
/** Whether the marker row exists; null until a read of it succeeds. */
let cachedMarker: boolean | null = null;
/** Whether the latest read of the marker failed (it then counts as missing unless an earlier read found it). */
let markerReadFailed = false;
let loadedAt = 0;
let inFlight: Promise<boolean> | null = null;

const stale = () => Date.now() - loadedAt > TTL_MS;
const switchedOn = () => isWikiosV1Enabled() || cachedFlag;
const markerMissing = () => cachedMarker === false || (cachedMarker === null && markerReadFailed);
const effective = () => switchedOn() && !markerMissing();

export function isWikiosEditingForcedByEnv(): boolean {
  return isWikiosV1Enabled();
}

export function isWikiosEditingEnabled(): boolean {
  if (stale()) void refreshWikiosEditingFlag();
  return effective();
}

/** Whether the protections import has run: null until the marker has been read once. */
export function wikiosProtectionsImported(): boolean | null {
  return cachedMarker;
}

/** The admin switch row as last read, whatever the marker says. */
export function wikiosEditingSwitchOn(): boolean {
  return cachedFlag;
}

/** Why a write is refused now: the protections reason when only the marker is missing. */
export function wikiosReadonlyReason(): string {
  return switchedOn() && markerMissing() ? WIKIOS_PROTECTIONS_REASON : WIKIOS_READONLY_REASON;
}

/** Async, so even a client that throws at once becomes a failed read that keeps the last value. */
async function readRow(key: string) {
  return db.systemConfig.findUnique({ where: { key }, select: { value: true } });
}

function warnKept(what: string, error: Error | string): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[wikios] could not read the ${what}; keeping the last value:`, message);
}

async function load(): Promise<boolean> {
  const [flag, marker] = await Promise.allSettled([
    readRow(WIKIOS_EDITING_KEY),
    readRow(WIKIOS_PROTECTIONS_MARKER_KEY),
  ]);
  if (flag.status === "fulfilled") cachedFlag = flag.value?.value === "true";
  else warnKept("editing switch", flag.reason as Error | string);
  markerReadFailed = marker.status === "rejected";
  if (marker.status === "fulfilled") cachedMarker = Boolean(marker.value);
  else warnKept("protections marker", marker.reason as Error | string);
  return effective();
}

export function refreshWikiosEditingFlag(force = false): Promise<boolean> {
  if (!force && !stale()) return Promise.resolve(effective());
  inFlight ??= load().finally(() => {
    loadedAt = Date.now();
    inFlight = null;
  });
  return inFlight;
}

export async function setWikiosEditingFlag(enabled: boolean): Promise<void> {
  const value = enabled ? "true" : "false";
  await db.systemConfig.upsert({
    where: { key: WIKIOS_EDITING_KEY },
    create: { key: WIKIOS_EDITING_KEY, value },
    update: { value },
  });
  cachedFlag = enabled;
  loadedAt = Date.now();
}

export function __resetWikiosEditingCacheForTests(): void {
  cachedFlag = false;
  cachedMarker = null;
  markerReadFailed = false;
  loadedAt = 0;
  inFlight = null;
}
