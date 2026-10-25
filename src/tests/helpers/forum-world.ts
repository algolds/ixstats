/**
 * The people, realms and boards of a forum scenario, written through the Prisma API on the in-memory client
 * (`memory-prisma.ts`), with the raw statements the forum takes (advisory locks, the thread row lock) logged as locks.
 * `as` is a member's tRPC context, so a scenario calls the real `thinkpagesForum` and `thinkpagesForumMod` procedures.
 */
import type { PrismaClient } from "@prisma/client";
import { seedRealmCategories } from "~/server/modules/thinkpages-forum/realm-seed";
import { SITE_CATEGORIES } from "~/tests/helpers/forum-site-categories";
import {
  createMemoryPrisma,
  type MemoryPrisma,
  type MemoryStore,
} from "~/tests/helpers/memory-prisma";
import { createMockCallerContext, type MockCallerContext } from "~/tests/helpers/router-context";

type Db = PrismaClient;

export interface Member {
  id: string;
  clerkUserId: string;
  handle: string;
  /** The nation the member acts as. */
  countryId: string | null;
  role: { name: string; level: number } | null;
}

const ADMIN_ROLE = { name: "admin", level: 10 };

/** The forum's raw statements on the memory store: each lock is logged, in order. */
function forumRaws(store: MemoryStore): void {
  store.onRaw(/SELECT pg_advisory_xact_lock\(hashtext\(\?\)\)/, ([key]) => {
    store.log.push({ kind: "advisory", ns: 0, key: String(key) });
    return 1;
  });
  store.onRaw(/FROM "forum_threads" WHERE "id" = \? FOR NO KEY UPDATE/, ([id]) => {
    store.log.push({ kind: "write", model: "ForumThread", op: "lock", where: { id } });
    return 1;
  });
}

/** A memory client with the forum's raw statements. */
export function forumDb(): MemoryPrisma {
  const db = createMemoryPrisma();
  forumRaws(db.store);
  return db;
}

/** A signed-up member with a Passport handle; `admin` makes them a site admin (role level 10). */
export async function addMember(
  db: Db,
  id: string,
  options: { handle?: string; admin?: boolean; countryId?: string | null } = {}
): Promise<Member> {
  let roleId: string | null = null;
  if (options.admin) {
    const role = await db.role.upsert({
      where: { name: ADMIN_ROLE.name },
      create: { name: ADMIN_ROLE.name, displayName: "Admin", level: ADMIN_ROLE.level },
      update: {},
      select: { id: true },
    });
    roleId = role.id;
  }
  const handle = options.handle ?? id;
  await db.user.create({
    data: { id, clerkUserId: `${id}-clerk`, handle, roleId, lastSeenAt: new Date() },
  });
  return {
    id,
    clerkUserId: `${id}-clerk`,
    handle,
    countryId: options.countryId ?? null,
    role: options.admin ? ADMIN_ROLE : null,
  };
}

/** The sitewide boards, each with the id `cat-<key>`. */
export async function addSiteBoards(db: Db): Promise<void> {
  for (const c of SITE_CATEGORIES) {
    await db.forumCategory.create({ data: { id: `cat-${c.key}`, scope: "site", ...c } });
  }
}

/** A realm with its forum section and board, seeded as a new realm is. */
export async function addRealm(
  db: Db,
  realm: { id: string; name: string; ownerClerkId: string; status?: string; visibility?: string }
): Promise<{ id: string; slug: string }> {
  const row = await db.realm.create({
    data: {
      id: realm.id,
      slug: realm.id,
      name: realm.name,
      ownerId: realm.ownerClerkId,
      status: realm.status ?? "active",
      visibility: realm.visibility ?? "public",
    },
    select: { id: true, slug: true },
  });
  await seedRealmCategories(db, { id: realm.id, name: realm.name });
  return row;
}

/** A nation of a realm, owned by `ownerUserId`. */
export async function addNation(
  db: Db,
  id: string,
  realmId: string,
  ownerUserId: string | null,
  name = `Nation ${id}`
): Promise<{ id: string }> {
  return db.country.create({
    data: {
      id,
      realmId,
      ownerUserId,
      name,
      slug: id,
      baselinePopulation: 1,
      baselineGdpPerCapita: 1,
      maxGdpGrowthRate: 0,
      adjustedGdpGrowth: 0,
      populationGrowthRate: 0,
      currentPopulation: 1,
      currentGdpPerCapita: 1,
      currentTotalGdp: 1,
      baselineDate: new Date(Date.UTC(2040, 0, 1)),
      economicTier: "Developing",
      populationTier: "Micro",
    },
    select: { id: true },
  });
}

/** A persona (a ThinkPages account of the member's nation). */
export async function addPersona(
  db: Db,
  id: string,
  member: Member,
  countryId: string,
  displayName: string
): Promise<{ id: string }> {
  const [firstName, lastName = "Persona"] = displayName.split(" ");
  return db.thinkpagesAccount.create({
    data: {
      id,
      clerkUserId: member.clerkUserId,
      countryId,
      accountType: "citizen",
      username: id.replace(/[^a-z0-9]/gi, ""),
      displayName,
      firstName: firstName ?? displayName,
      lastName,
    },
    select: { id: true },
  });
}

/** The tRPC context of a signed-in member, with their own rate-limit bucket. */
export function as(db: Db, member: Member): MockCallerContext {
  return createMockCallerContext({
    db,
    auth: { userId: member.clerkUserId },
    user: {
      id: member.id,
      clerkUserId: member.clerkUserId,
      countryId: member.countryId,
      role: member.role,
    },
    rateLimitIdentifier: `${member.id}-${Math.random()}`,
  });
}

/** The tRPC context of a signed-out visitor. */
export function anonymous(db: Db): MockCallerContext {
  return createMockCallerContext({
    db,
    auth: null,
    user: null,
    rateLimitIdentifier: `anon-${Math.random()}`,
  });
}

/** Lets the write hooks the routers start without awaiting (auto-watch, notices) finish. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 25; i += 1) await new Promise((resolve) => setImmediate(resolve));
}
