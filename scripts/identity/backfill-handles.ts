/**
 * Backfill IxStates Passport handles for users that have none.
 * Dry run by default: prints a table of `userId  source  handle`; --apply writes.
 *   bun scripts/identity/backfill-handles.ts [--apply]
 * Source order (`chooseBackfillHandle`): the first approved ixwiki name claim the user shows (a
 * handle is public, so a hidden claim never seeds one), forum username, personal
 * ThinkPages persona name, primary owned nation name (`Country.ownerUserId`: the held
 * `User.countryId`, else the largest economy). A name whose slug has no letter or digit is skipped, and
 * so is a name that is, or whose handle spells, one of the user's hidden claims. A user with no usable
 * name keeps no handle (never one minted from a Clerk id or row id). Handles are de-duplicated against
 * existing handles, earlier picks in the same run and the old wiki names other accounts hold (which
 * `setUserHandle` refuses).
 */
import { PrismaClient } from "@prisma/client";
import { claimName, IXWIKI, namesOfUsers } from "~/lib/identity/wiki-names";
import { PERSONAL_ACCOUNT_TYPE } from "~/server/shared/thinkpages-personal-account";
import {
  chooseBackfillHandle,
  pickAvailableHandle,
  type BackfillSource,
} from "~/server/modules/identity/identity.handle";
import { primaryNationOf } from "~/server/modules/identity/identity.mappers";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

interface UserRow {
  id: string;
  clerkUserId: string;
  forumUsername: string | null;
  countryId: string | null;
}

interface Pick {
  userId: string;
  source: BackfillSource;
  handle: string;
}

/** The first value per key, in row order. */
function firstByKey<T>(rows: T[], key: (row: T) => string, value: (row: T) => string) {
  const map = new Map<string, string>();
  for (const row of rows) if (!map.has(key(row))) map.set(key(row), value(row));
  return map;
}

interface ClaimedNames {
  /** The first approved claim the user shows (a hidden one never seeds a public handle). */
  shown: string | null;
  /** The user's hidden claims, which no handle may spell. */
  hidden: string[];
}

/** Each user's approved claims, split into the first shown one and the hidden ones. */
async function loadClaimedWikiNames(userIds: string[]): Promise<Map<string, ClaimedNames>> {
  const names = await namesOfUsers(db, userIds);
  return new Map(
    [...names].map(([userId, claims]) => [
      userId,
      {
        shown: claims.find((claim) => claim.visible)?.name ?? null,
        hidden: claims.filter((claim) => !claim.visible).map((claim) => claim.name),
      },
    ])
  );
}

/** Every approved claimed name (stored form) to the account holding it. */
async function loadClaimOwners(): Promise<Map<string, string>> {
  const claims = await db.wikiNameClaim.findMany({
    where: { source: IXWIKI, status: "APPROVED" },
    select: { name: true, userId: true },
  });
  return new Map(claims.map((claim) => [claim.name, claim.userId]));
}

/** Personal ThinkPages persona names by Clerk id (the persona `loadPersonalPersona` reads). */
async function loadPersonaNames(clerkUserIds: string[]): Promise<Map<string, string>> {
  const personas = await db.thinkpagesAccount.findMany({
    where: {
      clerkUserId: { in: clerkUserIds },
      isActive: true,
      accountType: PERSONAL_ACCOUNT_TYPE,
    },
    select: { clerkUserId: true, displayName: true },
    orderBy: { createdAt: "asc" },
  });
  return firstByKey(
    personas,
    (p) => p.clerkUserId,
    (p) => p.displayName
  );
}

/** Primary owned nation names by user id. */
async function loadNationNames(users: UserRow[]): Promise<Map<string, string>> {
  const nations = await db.country.findMany({
    where: { ownerUserId: { in: users.map((u) => u.id) } },
    select: { id: true, name: true, ownerUserId: true, currentTotalGdp: true },
  });
  const names = new Map<string, string>();
  for (const user of users) {
    const held = nations.filter((n) => n.ownerUserId === user.id);
    const primary = primaryNationOf(held, user.countryId);
    if (primary) names.set(user.id, primary.name);
  }
  return names;
}

async function main(): Promise<void> {
  const [users, existing] = await Promise.all([
    db.user.findMany({
      where: { handle: null },
      select: { id: true, clerkUserId: true, forumUsername: true, countryId: true },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findMany({ where: { handle: { not: null } }, select: { handle: true } }),
  ]);
  const taken = new Set<string>(existing.flatMap((u) => (u.handle ? [u.handle] : [])));
  const [wikiNames, claimOwners, personaNames, nationNames] = await Promise.all([
    loadClaimedWikiNames(users.map((u) => u.id)),
    loadClaimOwners(),
    loadPersonaNames(users.map((u) => u.clerkUserId)),
    loadNationNames(users),
  ]);

  const picks: Pick[] = [];
  for (const user of users) {
    const claimed = wikiNames.get(user.id);
    const choice = chooseBackfillHandle(
      {
        wiki: claimed?.shown ?? null,
        forum: user.forumUsername,
        persona: personaNames.get(user.clerkUserId) ?? null,
        nation: nationNames.get(user.id) ?? null,
      },
      claimed?.hidden ?? []
    );
    if (!choice) continue;
    const handle = pickAvailableHandle(choice.handle, {
      has: (candidate) =>
        taken.has(candidate) || (claimOwners.get(claimName(candidate)) ?? user.id) !== user.id,
    });
    taken.add(handle);
    picks.push({ userId: user.id, source: choice.source, handle });
  }

  console.log("userId  source  handle");
  for (const pick of picks) console.log(`${pick.userId}  ${pick.source}  ${pick.handle}`);
  console.log(
    `\n${users.length} user(s) without a handle; ${picks.length} get one, ` +
      `${users.length - picks.length} have no usable name and keep none.`
  );

  if (!apply) {
    console.log("Dry run. Re-run with --apply to write.");
    return;
  }
  for (const pick of picks) {
    await db.user.update({ where: { id: pick.userId }, data: { handle: pick.handle } });
  }
  console.log(`Applied ${picks.length} handle(s).`);
}

main()
  .catch((error: Error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
