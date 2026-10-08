/**
 * The WikiOS editing switch (admin toggle, /admin/wikios-settings): whether WikiOS takes writes and mirrors them to
 * classic MediaWiki, without the full v1 cutover. `WIKIOS_V1_ENABLED` (v1-switch.ts) forces it on. Inbound sync, lore
 * cards, lorewards, search and background renders stay on the v1 switch.
 *
 * The flag is a SystemConfig row read at most once per TTL per process, so a flip reaches every process (app, cron
 * runner, standalone WikiOS) within the TTL. Write entry points await `refreshWikiosEditingFlag()`; any synchronous
 * read of a stale cache starts a background refresh.
 */
import { db } from "~/server/db";
import { isWikiosV1Enabled } from "./v1-switch";

export const WIKIOS_EDITING_KEY = "wikios_editing_enabled";
const TTL_MS = 15_000;

let cached = false;
let loadedAt = 0;
let inFlight: Promise<boolean> | null = null;

const stale = () => Date.now() - loadedAt > TTL_MS;

export function isWikiosEditingForcedByEnv(): boolean {
  return isWikiosV1Enabled();
}

export function isWikiosEditingEnabled(): boolean {
  if (isWikiosV1Enabled()) return true;
  if (stale()) void refreshWikiosEditingFlag();
  return cached;
}

export function refreshWikiosEditingFlag(force = false): Promise<boolean> {
  if (!force && !stale()) return Promise.resolve(cached);
  inFlight ??= db.systemConfig
    .findUnique({ where: { key: WIKIOS_EDITING_KEY }, select: { value: true } })
    .then((row) => {
      cached = row?.value === "true";
      return cached;
    })
    .catch((error: Error) => {
      console.warn("[wikios] could not read the editing switch; keeping the last value:", error.message);
      return cached;
    })
    .finally(() => {
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
  cached = enabled;
  loadedAt = Date.now();
}

export function __resetWikiosEditingCacheForTests(): void {
  cached = false;
  loadedAt = 0;
  inFlight = null;
}
