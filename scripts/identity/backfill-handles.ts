/**
 * Backfill IxStates Passport handles for users that have none.
 * Dry run by default: prints a table of `userId  source  handle`; --apply writes.
 *   bun scripts/identity/backfill-handles.ts [--apply]
 * Source order (`chooseBackfillHandle`): verified ixwiki link name, forum username, personal
 * ThinkPages persona name, primary owned nation name (`Country.ownerUserId`: the held
 * `User.countryId`, else the largest economy). A name whose slug has no letter or digit is skipped.
 * A user with no usable name keeps no handle (never one minted from a Clerk id or row id). Handles
 * are de-duplicated against existing handles and against earlier picks in the same run.
 */
import { PrismaClient } from "@prisma/client";
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

async function loadVerifiedWikiNames(userIds: string[]): Promise<Map<string, string>> {
  const links = await db.wikiAccountLink.findMany({
    where: { userId: { in: userIds }, source: "ixwiki", verifiedAt: { not: null } },
    select: { userId: true, username: true },
    orderBy: { verifiedAt: "asc" },
  });
  return firstByKey(links, (l) => l.userId, (l) => l.username);
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
  return firstByKey(personas, (p) => p.clerkUserId, (p) => p.displayName);
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
  const [wikiNames, personaNames, nationNames] = await Promise.all([
    loadVerifiedWikiNames(users.map((u) => u.id)),
    loadPersonaNames(users.map((u) => u.clerkUserId)),
    loadNationNames(users),
  ]);

  const picks: Pick[] = [];
  for (const user of users) {
    const choice = chooseBackfillHandle({
      wiki: wikiNames.get(user.id) ?? null,
      forum: user.forumUsername,
      persona: personaNames.get(user.clerkUserId) ?? null,
      nation: nationNames.get(user.id) ?? null,
    });
    if (!choice) continue;
    const handle = pickAvailableHandle(choice.handle, taken);
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
