/**
 * Realm clocks (docs/superpowers/specs/2026-10-14-realm-clocks-design.md): the founder (or site staff) switches a
 * realm's clock on once and then changes its speed (at most weekly, staff exempt) and era. Ixnay runs on global
 * IxTime and never has one.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import {
  createRealmClock,
  nextSpeedChangeAt,
  withSpeed,
  type RealmClock,
} from "~/lib/realms/realm-clock";
import { DEFAULT_REALM_ID, realmSlugWhere } from "~/lib/realms/realm-ids";
import { isRealmPublished, isSiteAdmin, type RealmActor } from "./realms.access";
import { RealmRegionError, requireRealmStaff } from "./realms.region";
import { realmClock, withRealmClock } from "./realms.settings";

type ClockDb = Pick<PrismaClient, "realm" | "country">;

async function storedSettings(db: ClockDb, realmId: string): Promise<Prisma.JsonValue | null> {
  const row = await db.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
  return row?.settings ?? null;
}

/** Founder or site staff: switch the realm's clock on, continuous with global IxTime. Once only. */
export async function startRealmClock(
  db: ClockDb,
  actor: RealmActor,
  input: { slug: string; startDate: string; era: string; multiplier: number }
): Promise<{ clock: RealmClock }> {
  const realm = await requireRealmStaff(db, actor, input.slug, "founder");
  if (realm.id === DEFAULT_REALM_ID)
    throw new RealmRegionError("BAD_REQUEST", "Ixnay runs on global IxTime");
  const settings = await storedSettings(db, realm.id);
  if (realmClock(settings))
    throw new RealmRegionError("BAD_REQUEST", "This realm's clock is already running");
  const clock = createRealmClock({
    globalNowMs: IxTime.getCurrentIxTime(),
    realNowMs: Date.now(),
    startDate: input.startDate,
    era: input.era,
    multiplier: input.multiplier,
  });
  await db.realm.update({
    where: { id: realm.id },
    data: { settings: withRealmClock(settings, clock) },
  });
  return { clock };
}

/** Founder or site staff: a new speed (founder: once a week) and/or era. The date never jumps. */
export async function updateRealmClock(
  db: ClockDb,
  actor: RealmActor,
  input: { slug: string; multiplier?: number; era?: string }
): Promise<{ clock: RealmClock }> {
  const realm = await requireRealmStaff(db, actor, input.slug, "founder");
  const settings = await storedSettings(db, realm.id);
  const current = realmClock(settings);
  if (!current) throw new RealmRegionError("BAD_REQUEST", "Start the realm's clock first");
  const now = Date.now();
  let clock = current;
  if (input.multiplier !== undefined && input.multiplier !== current.multiplier) {
    const next = nextSpeedChangeAt(current);
    if (!isSiteAdmin(actor) && now < next)
      throw new RealmRegionError(
        "BAD_REQUEST",
        `The speed can change again on ${new Date(next).toISOString().slice(0, 10)}`
      );
    clock = withSpeed(clock, input.multiplier, now);
  }
  if (input.era !== undefined) clock = { ...clock, era: input.era.trim() };
  await db.realm.update({
    where: { id: realm.id },
    data: { settings: withRealmClock(settings, clock) },
  });
  return { clock };
}

/**
 * The clock that applies in a context: a realm, a country's realm, or the viewer's active nation's realm. Null is
 * global IxTime (Ixnay, a realm whose clock is off, or nothing to resolve).
 */
export async function realmContextClock(
  db: ClockDb,
  input: { realm?: string; country?: string; active?: boolean },
  viewer: { countryId?: string | null } | null
): Promise<RealmClock | null> {
  const countryWhere = input.country
    ? { slug: input.country }
    : input.active && viewer?.countryId
      ? { id: viewer.countryId }
      : null;
  const realmId = countryWhere
    ? (await db.country.findUnique({ where: countryWhere, select: { realmId: true } }))?.realmId
    : null;
  const where = input.realm ? realmSlugWhere(input.realm) : realmId ? { id: realmId } : null;
  if (!where) return null;
  const realm = await db.realm.findUnique({
    where,
    select: { id: true, status: true, settings: true },
  });
  // An unpublished realm stays private (its slug, era and speed), as everywhere else outside its staff.
  if (!realm || realm.id === DEFAULT_REALM_ID || !isRealmPublished(realm.id, realm.status))
    return null;
  return realmClock(realm.settings);
}
