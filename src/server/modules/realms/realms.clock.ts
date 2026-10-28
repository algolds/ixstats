/**
 * Realm clock actions (docs/specs/2026-10-25-realm-time-design.md §1): the founder (or site staff)
 * changes the speed (at most weekly, staff exempt), the era and the calendar, and jumps the date forward (at most 5
 * of the realm's years, at most weekly, staff exempt). Every realm gets its clock at founding; `startRealmClock`
 * only repairs a realm that lost it. Ixnay's clock is the bot-synced IxTime: only site staff jump it here, and its
 * speed stays in Admin. Reading a realm's time: `~/server/shared/realm-time`.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { persistSharedClock } from "~/lib/ixtime/shared-clock";
import {
  createRealmClock,
  maxJumpDays,
  MAX_JUMP_YEARS,
  nextJumpAt,
  nextSpeedChangeAt,
  realmCalendarMs,
  withCalendar,
  withJump,
  withSpeed,
  type RealmClock,
  type RealmMonth,
} from "~/lib/realms/realm-clock";
import { DAY_MS } from "~/lib/realms/realm-calendar";
import { DEFAULT_REALM_ID, realmSlugWhere } from "~/lib/realms/realm-ids";
import { invalidateRealmClock, ixnayClock, storedRealmClock } from "~/server/shared/realm-time";
import { canModerateRealm, isRealmPublished, isSiteAdmin, type RealmActor } from "./realms.access";
import { RealmRegionError, requireRealmStaff } from "./realms.region";
import { withRealmClock } from "./realms.settings";

type ClockDb = Pick<PrismaClient, "realm" | "country">;
type JumpDb = ClockDb & Pick<PrismaClient, "systemConfig">;

const IXNAY_SPEED = "Ixnay's clock is IxTime: site staff set its speed in Admin";

/** "2026-11-01 UTC". */
const utcDay = (ms: number) => `${new Date(ms).toISOString().slice(0, 10)} UTC`;

async function storedSettings(db: ClockDb, realmId: string): Promise<Prisma.JsonValue | null> {
  const row = await db.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
  return row?.settings ?? null;
}

async function saveClock(
  db: ClockDb,
  realmId: string,
  settings: Prisma.JsonValue | null,
  clock: RealmClock
): Promise<{ clock: RealmClock }> {
  await db.realm.update({
    where: { id: realmId },
    data: { settings: withRealmClock(settings, clock) },
  });
  invalidateRealmClock(realmId);
  return { clock };
}

/** Founder or site staff: give a realm that lost its clock a new one, continuous with Ixnay's time. */
export async function startRealmClock(
  db: ClockDb,
  actor: RealmActor,
  input: { slug: string; startDate: string; era: string; multiplier: number }
): Promise<{ clock: RealmClock }> {
  const realm = await requireRealmStaff(db, actor, input.slug, "founder");
  if (realm.id === DEFAULT_REALM_ID) throw new RealmRegionError("BAD_REQUEST", IXNAY_SPEED);
  const settings = await storedSettings(db, realm.id);
  if (storedRealmClock(settings))
    throw new RealmRegionError("BAD_REQUEST", "This realm's clock is already running");
  const clock = createRealmClock({
    globalNowMs: ixnayClock().now(),
    realNowMs: Date.now(),
    startDate: input.startDate,
    era: input.era,
    multiplier: input.multiplier,
  });
  return saveClock(db, realm.id, settings, clock);
}

function applySpeed(clock: RealmClock, multiplier: number, staff: boolean, now: number) {
  const next = nextSpeedChangeAt(clock);
  if (!staff && now < next)
    throw new RealmRegionError("BAD_REQUEST", `The speed can change again on ${utcDay(next)}`);
  return withSpeed(clock, multiplier, now);
}

/** The realm's stored clock, or BAD_REQUEST (Ixnay has none here; a realm that lost its clock is repaired first). */
async function requireClock(db: ClockDb, realmId: string) {
  if (realmId === DEFAULT_REALM_ID) throw new RealmRegionError("BAD_REQUEST", IXNAY_SPEED);
  const settings = await storedSettings(db, realmId);
  const clock = storedRealmClock(settings);
  if (!clock) throw new RealmRegionError("BAD_REQUEST", "This realm has no clock: set one first");
  return { settings, clock };
}

/**
 * Founder or site staff: a new speed (founder: once a week), era and/or calendar (`months`; null is Gregorian). The
 * clock's time never moves; a new calendar keeps today's year.
 */
export async function updateRealmClock(
  db: ClockDb,
  actor: RealmActor,
  input: { slug: string; multiplier?: number; era?: string; months?: RealmMonth[] | null }
): Promise<{ clock: RealmClock }> {
  const realm = await requireRealmStaff(db, actor, input.slug, "founder");
  const { settings, clock: current } = await requireClock(db, realm.id);
  const now = Date.now();
  let clock = current;
  if (input.multiplier !== undefined && input.multiplier !== current.multiplier)
    clock = applySpeed(clock, input.multiplier, isSiteAdmin(actor), now);
  if (input.era !== undefined) clock = { ...clock, era: input.era.trim() };
  if (input.months !== undefined) clock = withCalendar(clock, input.months, now);
  return saveClock(db, realm.id, settings, clock);
}

function checkJumpLength(days: number, max: number) {
  if (days > max)
    throw new RealmRegionError(
      "BAD_REQUEST",
      `One jump moves the date at most ${MAX_JUMP_YEARS} years (${max} days)`
    );
}

/** Ixnay's jump moves the bot's clock (and this process's, shared with the others). Site staff only. */
async function jumpIxnay(db: JumpDb, days: number): Promise<{ clock: null; botSynced: boolean }> {
  const now = IxTime.getCurrentIxTime();
  checkJumpLength(days, maxJumpDays(now));
  const target = now + days * DAY_MS;
  const bot = await IxTime.setBotTimeOverride(target);
  IxTime.setTimeOverride(target);
  await persistSharedClock(db);
  return { clock: null, botSynced: bot.success };
}

/**
 * Founder or site staff: jump the realm's date `days` ahead. Time really passes: its nations' economies, budget
 * years, elections and deadlines catch up on their next run. At most 5 of the realm's years; the founder once a
 * week. Ixnay: site staff only.
 */
export async function jumpRealmClock(
  db: JumpDb,
  actor: RealmActor,
  input: { slug: string; days: number }
): Promise<{ clock: RealmClock | null; botSynced?: boolean }> {
  const realm = await requireRealmStaff(db, actor, input.slug, "founder");
  const staff = isSiteAdmin(actor);
  if (realm.id === DEFAULT_REALM_ID) {
    if (!staff) throw new RealmRegionError("FORBIDDEN", "Only site staff move Ixnay's clock");
    return jumpIxnay(db, input.days);
  }
  const { settings, clock } = await requireClock(db, realm.id);
  const now = Date.now();
  checkJumpLength(input.days, maxJumpDays(realmCalendarMs(clock, now), clock.months));
  const next = nextJumpAt(clock);
  if (!staff && now < next)
    throw new RealmRegionError("BAD_REQUEST", `The date can jump again on ${utcDay(next)}`);
  return saveClock(db, realm.id, settings, withJump(clock, input.days, now));
}

/** Where a context's realm is found: by id, by slug, by a country's realm, or the viewer's active nation's. */
async function contextRealmWhere(
  db: ClockDb,
  input: { realmId?: string; realm?: string; country?: string; active?: boolean },
  viewer: { countryId?: string | null } | null
): Promise<{ id: string } | { slug: string } | null> {
  if (input.realmId) return { id: input.realmId };
  if (input.realm) return realmSlugWhere(input.realm);
  const countryWhere = input.country
    ? { slug: input.country }
    : input.active && viewer?.countryId
      ? { id: viewer.countryId }
      : null;
  if (!countryWhere) return null;
  const country = await db.country.findUnique({ where: countryWhere, select: { realmId: true } });
  return country ? { id: country.realmId } : null;
}

/** Who asks for a context clock: anyone; a signed-in viewer brings their active nation and, for staff, their role. */
export type ClockViewer = { countryId?: string | null } & Partial<RealmActor>;

/**
 * Whether `viewer` may read an unpublished realm's clock: its staff (the founder and site admins), and a viewer whose
 * active nation is in it, whose MyCountry runs on that clock.
 */
async function readsUnpublishedClock(
  db: ClockDb,
  realm: { id: string; ownerId: string },
  viewer: ClockViewer | null
): Promise<boolean> {
  if (!viewer) return false;
  const { id, clerkUserId, role } = viewer;
  if (id && clerkUserId && canModerateRealm({ id, clerkUserId, role }, realm)) return true;
  if (!viewer.countryId) return false;
  const own = await db.country.findUnique({
    where: { id: viewer.countryId },
    select: { realmId: true },
  });
  return own?.realmId === realm.id;
}

/**
 * The clock that applies in a context. `clock` null reads Ixnay's clock (IxTime): Ixnay, nothing to resolve, an
 * unpublished realm the viewer may not see (`realmId` is then Ixnay's, so nothing leaks; its staff and its own
 * nations' owners read it), or a realm missing its clock (logged).
 */
export async function realmContextClock(
  db: ClockDb,
  input: { realmId?: string; realm?: string; country?: string; active?: boolean },
  viewer: ClockViewer | null
): Promise<{ realmId: string; clock: RealmClock | null }> {
  const ixnay = { realmId: DEFAULT_REALM_ID, clock: null };
  const where = await contextRealmWhere(db, input, viewer);
  if (!where) return ixnay;
  const realm = await db.realm.findUnique({
    where,
    select: { id: true, status: true, settings: true, ownerId: true },
  });
  if (!realm || realm.id === DEFAULT_REALM_ID) return ixnay;
  // An unpublished realm stays private (its slug, era and speed) outside its staff and its own nations.
  if (!isRealmPublished(realm.id, realm.status) && !(await readsUnpublishedClock(db, realm, viewer)))
    return ixnay;
  const clock = storedRealmClock(realm.settings);
  if (!clock) console.error(`[realm-time] Realm ${realm.id} has no clock; showing Ixnay's`);
  return { realmId: realm.id, clock };
}
