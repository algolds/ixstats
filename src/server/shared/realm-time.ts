/**
 * Every realm's time (docs/superpowers/specs/2026-10-25-realm-time-design.md §1): one server API that answers "what
 * time is it for this realm / this nation". A realm's clock lives in `Realm.settings.clock`; Ixnay's clock is the
 * bot-synced IxTime (`~/lib/ixtime/shared-clock`). A realm without a clock is an error: it is logged and reads
 * Ixnay's clock (`fallback: true`) so pages and crons keep running.
 *
 * Shared core (not a realms module) so every domain module may read a nation's time. Stored clocks are cached per
 * process for REALM_CLOCK_TTL_MS, like the shared IxTime clock; a write in this process drops its entry at once.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { CLOCK_REFRESH_TTL_MS, refreshSharedClock } from "~/lib/ixtime/shared-clock";
import {
  ixnayClockReader,
  parseRealmClock,
  realmClockReader,
  type RealmClock,
  type RealmClockReader,
} from "~/lib/realms/realm-clock";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";

export type { RealmClockReader } from "~/lib/realms/realm-clock";

type RealmTimeDb = Pick<PrismaClient, "realm" | "systemConfig">;
type CountryTimeDb = RealmTimeDb & Pick<PrismaClient, "country">;

/** How long a process trusts its copy of a realm's stored clock. */
export const REALM_CLOCK_TTL_MS = CLOCK_REFRESH_TTL_MS;

const cache = new Map<string, { clock: RealmClock | null; at: number }>();

/** The stored clock in `Realm.settings`, or null. */
export function storedRealmClock(settings: Prisma.JsonValue | null | undefined): RealmClock | null {
  const object: Prisma.JsonObject =
    settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  return parseRealmClock(object.clock);
}

/**
 * Ixnay's clock as this process knows it (bot-synced IxTime). Synchronous: the tRPC context and the cron runner
 * refresh the shared clock first; `clockForRealm` and `realmClocks` refresh it themselves.
 */
export function ixnayClock(realmId = DEFAULT_REALM_ID, fallback = false): RealmClockReader {
  return ixnayClockReader(
    realmId,
    { now: () => IxTime.getCurrentIxTime(), multiplier: IxTime.getTimeMultiplier() },
    fallback
  );
}

function missingClock(realmId: string): RealmClockReader {
  console.error(`[realm-time] Realm ${realmId} has no clock; reading Ixnay's until it gets one`);
  return ixnayClock(realmId, true);
}

/** The reader for a realm whose stored clock is known (null: missing, which is logged). */
export function readerFor(realmId: string, clock: RealmClock | null): RealmClockReader {
  if (realmId === DEFAULT_REALM_ID) return ixnayClock();
  return clock ? realmClockReader(realmId, clock) : missingClock(realmId);
}

/** The reader from a realm row's settings already in hand (no query). */
export function readerFromSettings(
  realmId: string,
  settings: Prisma.JsonValue | null | undefined
): RealmClockReader {
  return readerFor(realmId, storedRealmClock(settings));
}

async function cachedClock(db: RealmTimeDb, realmId: string): Promise<RealmClock | null> {
  const hit = cache.get(realmId);
  if (hit && Date.now() - hit.at < REALM_CLOCK_TTL_MS) return hit.clock;
  const row = await db.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
  const clock = storedRealmClock(row?.settings);
  cache.set(realmId, { clock, at: Date.now() });
  return clock;
}

/** A realm's clock. */
export async function clockForRealm(db: RealmTimeDb, realmId: string): Promise<RealmClockReader> {
  await refreshSharedClock(db);
  if (realmId === DEFAULT_REALM_ID) return ixnayClock();
  return readerFor(realmId, await cachedClock(db, realmId));
}

/** A nation's clock: its realm's. Takes the country row (with `realmId`, no query) or its id. */
export async function clockForCountry(
  db: CountryTimeDb,
  country: string | { realmId: string | null }
): Promise<RealmClockReader> {
  const realmId =
    typeof country === "string"
      ? (await db.country.findUnique({ where: { id: country }, select: { realmId: true } }))
          ?.realmId
      : country.realmId;
  return clockForRealm(db, realmId ?? DEFAULT_REALM_ID);
}

/** Every realm's clock (system realms aside), read once: for crons that group nations by realm. */
export async function realmClocks(db: RealmTimeDb): Promise<Map<string, RealmClockReader>> {
  await refreshSharedClock(db);
  const rows = await db.realm.findMany({
    where: { isSystem: false },
    select: { id: true, settings: true },
  });
  const clocks = new Map<string, RealmClockReader>([[DEFAULT_REALM_ID, ixnayClock()]]);
  const at = Date.now();
  for (const row of rows) {
    if (row.id === DEFAULT_REALM_ID) continue;
    const clock = storedRealmClock(row.settings);
    cache.set(row.id, { clock, at });
    clocks.set(row.id, readerFor(row.id, clock));
  }
  return clocks;
}

/** A realm's reader from `realmClocks`' map; a realm it lacks (null: Ixnay) reads Ixnay's clock, logged. */
export function pickClock(
  clocks: ReadonlyMap<string, RealmClockReader>,
  realmId: string | null | undefined
): RealmClockReader {
  const id = realmId ?? DEFAULT_REALM_ID;
  return clocks.get(id) ?? (id === DEFAULT_REALM_ID ? ixnayClock() : missingClock(id));
}

/** Forget a realm's cached clock (after this process writes it). */
export function invalidateRealmClock(realmId: string): void {
  cache.delete(realmId);
}

/** Test seam: forget every cached clock. */
export function resetRealmClockCache(): void {
  cache.clear();
}
