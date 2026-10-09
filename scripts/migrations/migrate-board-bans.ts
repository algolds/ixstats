/**
 * ThinkPages forum phase 3 (M6): carry every Realm Board mute and ban still in force over to a realm-scope forum ban
 * for each player it binds (`restrictionHolders`), keeping its reason, end, creation time and creator.
 * Dry run by default; pass --apply to write.
 *   bun run db:migrate-board-bans [-- --apply] [-- --production]
 * It refuses the production database ("ixstats") unless --production is passed. Preflight: the phase 3 tables must
 * exist (apply migration 20261010120000_thinkpages_forum_moderation first).
 * Idempotent and resumable by `sourceRef` (`realm_board_ban:<id>:<userId>`): one transaction per chunk inserts the
 * bans it does not find and writes one `ban.migrate` mod log row per ban it actually inserted, so a rerun or a run
 * after a partial one creates nothing twice. Each chunk takes the bound members' moderation locks (`lockMember`, in
 * a fixed order) first, as every live ban and warning does, so a moderator acting on one of them waits for it.
 * Issuer: the board ban's creator (a Clerk id) mapped to their User id, else "system" (counted). Log actor: "system";
 * the detail names the original issuer. Expired rows and rows that bind nobody are skipped and counted, and so is
 * a bound player who moderates the realm today (site admin, founder, `board` officer), whom the board never
 * restricted: one report line each. The realm_board_bans rows are left in place, frozen, for phase 4.
 */
import "../lib/load-env";
import { Prisma, PrismaClient } from "@prisma/client";
import type { RealmOfficerGrant } from "~/server/modules/realms/realms.access";
import { logModAction } from "~/server/modules/thinkpages-forum/mod-log";
import { lockMember } from "~/server/modules/thinkpages-forum/mod-scope";
import { databaseLabel, productionDatabaseRefusal } from "../lib/database-guard";
import {
  BAN_SOURCE_REF_PREFIX,
  MIGRATION_ACTOR,
  planBoardBanMigration,
  summarizeBanMigration,
  type BanMigrationPlan,
  type BoardBanRow,
  type ClaimRow,
  type CountryRow,
  type ModeratorFacts,
  type ModeratorSkip,
  type PlannedBan,
} from "./board-bans-to-forum-plan";

const CHUNK = 500;
const TRANSACTION_TIMEOUT_MS = 120_000;

const argv = process.argv.slice(2);
const apply = argv.includes("--apply") && !argv.includes("--dry-run");

interface RealmRun {
  realm: string;
  rows: number;
  plan: BanMigrationPlan;
}

/** Whether the phase 3 tables exist: a missing table is Prisma's P2021. */
async function forumBansReady(db: PrismaClient): Promise<boolean> {
  try {
    await db.forumBan.count();
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021")
      return false;
    throw error;
  }
}

/** Approved claims on `countryIds`, in every realm (the planner reads each ban's own realm). */
async function approvedClaims(db: PrismaClient, countryIds: string[]): Promise<ClaimRow[]> {
  const rows = await db.realmClaim.findMany({
    where: { status: "approved", reviewedAt: { not: null }, countryId: { in: countryIds } },
    select: { realmId: true, userId: true, countryId: true, reviewedAt: true },
  });
  return rows.flatMap(({ realmId, userId, countryId, reviewedAt }) =>
    countryId && reviewedAt ? [{ realmId, userId, countryId, reviewedAt }] : []
  );
}

/** Each realm's label for the report and its founder (`Realm.ownerId`, a Clerk id). */
async function loadRealms(db: PrismaClient, realmIds: string[]) {
  const realms = await db.realm.findMany({
    where: { id: { in: realmIds } },
    select: { id: true, name: true, slug: true, ownerId: true },
  });
  return {
    labels: new Map(realms.map((r) => [r.id, `${r.name} (${r.slug})`])),
    owners: new Map(realms.map((r) => [r.id, r.ownerId])),
  };
}

/** Whether each possible bound player moderates a realm: their role, the founders and the officers. */
async function moderatorFacts(
  db: PrismaClient,
  realmIds: string[],
  realmOwners: Map<string, string>,
  userIds: string[]
): Promise<ModeratorFacts> {
  const [users, officers] = await Promise.all([
    db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, clerkUserId: true, role: { select: { name: true, level: true } } },
    }),
    db.realmOfficer.findMany({
      where: { realmId: { in: realmIds } },
      select: { realmId: true, userId: true, powers: true },
    }),
  ]);
  const byRealm = new Map<string, RealmOfficerGrant[]>();
  for (const { realmId, ...grant } of officers) {
    byRealm.set(realmId, [...(byRealm.get(realmId) ?? []), grant]);
  }
  return {
    users: new Map(users.map(({ id, ...user }) => [id, user])),
    realmOwners,
    officers: byRealm,
  };
}

/**
 * Plans every realm's board bans against one snapshot of claims, nations, issuers, moderators and migrated refs.
 */
async function planRealms(db: PrismaClient, rows: BoardBanRow[], now: Date): Promise<RealmRun[]> {
  const countryIds = [...new Set(rows.map((r) => r.countryId))];
  const realmIds = [...new Set(rows.map((r) => r.realmId))];
  const [claims, nations, users, migrated, realms] = await Promise.all([
    approvedClaims(db, countryIds),
    db.country.findMany({
      where: { id: { in: countryIds } },
      select: { id: true, realmId: true, ownerUserId: true },
    }),
    db.user.findMany({
      where: { clerkUserId: { in: [...new Set(rows.map((r) => r.createdBy))] } },
      select: { id: true, clerkUserId: true },
    }),
    db.forumBan.findMany({
      where: { sourceRef: { startsWith: BAN_SOURCE_REF_PREFIX } },
      select: { sourceRef: true },
    }),
    loadRealms(db, realmIds),
  ]);
  const boundUserIds = new Set([
    ...claims.map((c) => c.userId),
    ...nations.flatMap((n) => (n.ownerUserId ? [n.ownerUserId] : [])),
  ]);
  const moderators = await moderatorFacts(db, realmIds, realms.owners, [...boundUserIds]);
  const input = {
    claims,
    countries: new Map<string, CountryRow>(nations.map(({ id, ...nation }) => [id, nation])),
    userIdByClerk: new Map(users.map((u) => [u.clerkUserId, u.id])),
    migrated: new Set(migrated.flatMap((m) => (m.sourceRef ? [m.sourceRef] : []))),
    moderators,
    now,
  };
  return realmIds.map((realmId) => {
    const inRealm = rows.filter((r) => r.realmId === realmId);
    return {
      realm: realms.labels.get(realmId) ?? realmId,
      rows: inRealm.length,
      plan: planBoardBanMigration({ ...input, rows: inRealm }),
    };
  });
}

const banLine = (ban: PlannedBan) =>
  `    board ban ${ban.detail.realmBoardBanId} (${ban.detail.kind}, nation ${ban.detail.countryId}) -> ` +
  `user ${ban.userId}, ${ban.expiresAt ? `until ${ban.expiresAt.toISOString()}` : "permanent"}, ` +
  `issued by ${ban.issuedBy}`;

const skipLine = (skip: ModeratorSkip) =>
  `    board ban ${skip.realmBoardBanId} -> user ${skip.userId} skipped: binds a realm moderator (${skip.holder})`;

/** A planned ban as a forum_bans row (the detail goes to the mod log). */
const banData = (ban: PlannedBan): Prisma.ForumBanCreateManyInput => ({
  sourceRef: ban.sourceRef,
  userId: ban.userId,
  scope: ban.scope,
  scopeId: ban.scopeId,
  reason: ban.reason,
  issuedBy: ban.issuedBy,
  expiresAt: ban.expiresAt,
  auto: ban.auto,
  createdAt: ban.createdAt,
});

/** Writes one chunk in one transaction; returns how many bans it inserted. */
async function applyChunk(db: PrismaClient, chunk: PlannedBan[]): Promise<number> {
  return db.$transaction(
    async (tx) => {
      // Sorted, so two runs (or a run and a multi-member action) never wait on each other in a cycle.
      for (const userId of [...new Set(chunk.map((b) => b.userId))].sort()) {
        await lockMember(tx, userId);
      }
      const created = await tx.forumBan.createManyAndReturn({
        data: chunk.map(banData),
        skipDuplicates: true,
        select: { id: true, sourceRef: true },
      });
      const planned = new Map(chunk.map((b) => [b.sourceRef, b]));
      for (const { id, sourceRef } of created) {
        const ban = planned.get(sourceRef ?? "");
        if (!ban) throw new Error(`Inserted a ban that was not planned: ${sourceRef}`);
        await logModAction(tx, {
          actorId: MIGRATION_ACTOR,
          action: "ban.migrate",
          targetType: "user",
          targetId: ban.userId,
          scope: { kind: "realm", realmId: ban.scopeId },
          detail: {
            banId: id,
            sourceRef: ban.sourceRef,
            ...ban.detail,
            issuedBy: ban.issuedBy,
            reason: ban.reason,
            expiresAt: ban.expiresAt?.toISOString() ?? null,
          },
        });
      }
      return created.length;
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );
}

async function main(db: PrismaClient): Promise<number> {
  if (!(await forumBansReady(db))) {
    console.error("forum_bans does not exist: apply the phase 3 migration first.");
    return 1;
  }
  const now = new Date();
  const rows = await db.realmBoardBan.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const runs = await planRealms(db, rows, now);
  const summary = summarizeBanMigration(runs);
  runs.forEach((run, i) => {
    console.log(`  ${summary[i]}`);
    for (const ban of run.plan.bans) console.log(banLine(ban));
    for (const skip of run.plan.moderatorSkips) console.log(skipLine(skip));
  });
  console.log(`  ${summary[summary.length - 1]}`);
  if (!apply) return 0;

  const bans = runs.flatMap((run) => run.plan.bans);
  let created = 0;
  for (let i = 0; i < bans.length; i += CHUNK)
    created += await applyChunk(db, bans.slice(i, i + CHUNK));
  console.log(
    `Applied: ${created} forum bans created (${bans.length - created} already present), ` +
      `${created} ban.migrate log rows written. realm_board_bans left in place.`
  );
  return 0;
}

console.log(apply ? "APPLY mode" : "DRY RUN — pass --apply to write");
console.log(`Database: ${databaseLabel(process.env.DATABASE_URL)}`);
const refusal = productionDatabaseRefusal(process.env.DATABASE_URL, argv.includes("--production"));
if (refusal) {
  console.error(refusal);
  process.exit(1);
}

const db = new PrismaClient();
main(db)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  // The server modules' imports open a Redis client (the rate limiter) that keeps the event loop alive: exit.
  .finally(async () => {
    await db.$disconnect();
    process.exit();
  });
