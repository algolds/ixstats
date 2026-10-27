/**
 * The daily realm-inactivity job (ToS §2.8, cron row `realm-inactivity`): in every active realm with inactivity
 * release on, an owner who has not been seen for the realm's period is warned, then 14 days later their nation is
 * released and its flag and arms are held for the 180-day reclaim window. An owner who comes back is un-warned.
 * Then every due material hold (§2.7) is purged with the local images it named.
 */
import type { PrismaClient } from "@prisma/client";
import { invalidateCache } from "~/lib/cache";
import {
  holdPurgeAfter,
  inactivityReleaseDate,
  inactivityStep,
  realmInactivityDays,
  realmReclaimWindowExclusive,
} from "~/lib/realms/realm-content";
import { deleteLocalFlagImages } from "./realms.flags";
import { holdNationMaterial, purgeDueHolds } from "./realms.material";
import { notifyInactivity, type InactivityNotice } from "./realms.notices";
import { dropOfficerPostWithoutNation, releaseNation } from "./realms.ownership";

type InactivityDb = Pick<
  PrismaClient,
  "realm" | "country" | "user" | "realmOfficer" | "nationMaterialHold" | "$transaction"
>;

export interface InactivityDeps {
  now?: () => Date;
  notify: (notice: InactivityNotice) => Promise<void>;
  deleteImages: (images: (string | null)[]) => Promise<number>;
}

interface RealmRow {
  id: string;
  name: string;
  slug: string;
  days: number;
  exclusiveWindow: boolean;
}

interface NationRow {
  id: string;
  name: string;
  inactivityNoticeAt: Date | null;
  owner: { id: string; clerkUserId: string; lastSeenAt: Date | null } | null;
}

interface Tally {
  warned: number;
  released: number;
  reset: number;
}

/** Release one nation whose owner stayed away through the notice; false when it changed hands since the read. */
async function release(db: InactivityDb, nation: NationRow, realmId: string, now: Date) {
  const owner = nation.owner;
  if (!owner) return false;
  return db.$transaction(async (tx) => {
    const current = await tx.country.findUnique({
      where: { id: nation.id },
      select: { ownerUserId: true },
    });
    if (current?.ownerUserId !== owner.id) return false;
    await holdNationMaterial(tx, {
      countryId: nation.id,
      formerOwnerUserId: owner.id,
      reason: "inactive",
      now,
    });
    await releaseNation(tx, nation.id);
    await dropOfficerPostWithoutNation(tx, realmId, owner);
    return true;
  });
}

/** One nation's step: warn, release, un-warn or nothing. Notices go out after the write; a failed one is logged. */
async function stepNation(
  db: InactivityDb,
  deps: InactivityDeps,
  realm: RealmRow,
  nation: NationRow,
  now: Date,
  tally: Tally
): Promise<void> {
  const owner = nation.owner;
  if (!owner) return;
  const step = inactivityStep({
    lastSeenAt: owner.lastSeenAt,
    noticeAt: nation.inactivityNoticeAt,
    now,
    days: realm.days,
  });
  const notice = { clerkUserId: owner.clerkUserId, nationName: nation.name, realmName: realm.name };
  const common = {
    ...notice,
    realmSlug: realm.slug,
    days: realm.days,
    exclusiveWindow: realm.exclusiveWindow,
  };
  if (step === "reset") {
    await db.country.update({ where: { id: nation.id }, data: { inactivityNoticeAt: null } });
    tally.reset++;
  } else if (step === "notify") {
    await db.country.update({ where: { id: nation.id }, data: { inactivityNoticeAt: now } });
    tally.warned++;
    await deps
      .notify({ kind: "warning", date: inactivityReleaseDate(now), ...common })
      .catch((error) => console.error("[realm-inactivity] warning not sent:", error));
  } else if (step === "release" && (await release(db, nation, realm.id, now))) {
    tally.released++;
    await deps
      .notify({ kind: "released", date: holdPurgeAfter("inactive", now), ...common })
      .catch((error) => console.error("[realm-inactivity] release notice not sent:", error));
  }
}

/** The active realms with inactivity release on, with their period. */
async function inactivityRealms(db: InactivityDb): Promise<RealmRow[]> {
  const realms = await db.realm.findMany({
    where: { status: "active" },
    select: { id: true, name: true, slug: true, settings: true },
  });
  return realms.flatMap((r) => {
    const days = realmInactivityDays(r.id, r.settings);
    if (days === null) return [];
    const exclusiveWindow = realmReclaimWindowExclusive(r.settings);
    return [{ id: r.id, name: r.name, slug: r.slug, days, exclusiveWindow }];
  });
}

export async function runRealmInactivity(
  db: InactivityDb,
  deps: InactivityDeps
): Promise<Tally & { purged: number; files: number }> {
  const now = deps.now?.() ?? new Date();
  const tally: Tally = { warned: 0, released: 0, reset: 0 };
  for (const realm of await inactivityRealms(db)) {
    const nations = await db.country.findMany({
      where: { realmId: realm.id, ownerUserId: { not: null } },
      select: {
        id: true,
        name: true,
        inactivityNoticeAt: true,
        owner: { select: { id: true, clerkUserId: true, lastSeenAt: true } },
      },
    });
    for (const nation of nations) await stepNation(db, deps, realm, nation, now, tally);
  }
  // Ownership and flags show in cached country reads (lists, profiles, the map's panel).
  if (tally.released > 0) await invalidateCache(["countries.", "geoCore."]).catch(() => undefined);
  const purge = await purgeDueHolds(db, deps.deleteImages, now);
  return { ...tally, ...purge };
}

/** The cron row's run: live notices and image deletion. */
export async function liveRealmInactivity(db: PrismaClient) {
  return runRealmInactivity(db, {
    notify: notifyInactivity,
    deleteImages: (images) => deleteLocalFlagImages(db, images),
  });
}
