/**
 * Audit nations an IxStates Passport used to credit by leader name. The passport now counts a nation
 * only through `Country.ownerUserId`; this lists unowned countries whose `leader` matches a user's
 * forum name, wiki name or computed handle (case-insensitive), for review before a backfill.
 * Dry run by default: prints `countryId  name  leader  candidateUserId  matchedBy`.
 * --apply sets `ownerUserId` for countries with exactly one candidate user; ambiguous ones are skipped.
 *   bun scripts/identity/audit-leader-ownership.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

type MatchedBy = "forum" | "wiki" | "handle";

interface UserRow {
  id: string;
  clerkUserId: string;
  handle: string | null;
  forumUsername: string | null;
  wikiUsername: string | null;
}

interface CountryRow {
  id: string;
  name: string;
  leader: string | null;
}

interface Candidate {
  country: CountryRow;
  userId: string;
  matchedBy: MatchedBy[];
}

/** lower-cased name to the users carrying it, and how. */
type NameIndex = Map<string, Map<string, Set<MatchedBy>>>;

const key = (name: string) => name.trim().toLowerCase();

async function loadVerifiedWikiNames(): Promise<Map<string, string>> {
  const links = await db.wikiAccountLink.findMany({
    where: { source: "ixwiki", verifiedAt: { not: null } },
    select: { userId: true, username: true },
    orderBy: { verifiedAt: "asc" },
  });
  const names = new Map<string, string>();
  for (const link of links) if (!names.has(link.userId)) names.set(link.userId, link.username);
  return names;
}

/** Mirrors `canonicalHandleOf` in identity.service.ts: stored handle, else verified wiki, forum, Clerk id. */
function computedHandle(user: UserRow, verifiedWikiName: string | undefined): string {
  return user.handle || verifiedWikiName || user.forumUsername || user.clerkUserId;
}

function addName(index: NameIndex, name: string | null | undefined, userId: string, by: MatchedBy) {
  if (!name?.trim()) return;
  const users = index.get(key(name)) ?? new Map<string, Set<MatchedBy>>();
  const how = users.get(userId) ?? new Set<MatchedBy>();
  how.add(by);
  users.set(userId, how);
  index.set(key(name), users);
}

function indexUsers(users: UserRow[], wikiNames: Map<string, string>): NameIndex {
  const index: NameIndex = new Map();
  for (const user of users) {
    const verified = wikiNames.get(user.id);
    addName(index, user.forumUsername, user.id, "forum");
    addName(index, user.wikiUsername, user.id, "wiki");
    addName(index, verified, user.id, "wiki");
    addName(index, computedHandle(user, verified), user.id, "handle");
  }
  return index;
}

function candidatesFor(country: CountryRow, index: NameIndex): Candidate[] {
  const users = country.leader ? index.get(key(country.leader)) : undefined;
  return [...(users ?? new Map<string, Set<MatchedBy>>())].map(([userId, how]) => ({
    country,
    userId,
    matchedBy: [...how],
  }));
}

async function applyOwners(unambiguous: Candidate[]): Promise<number> {
  let applied = 0;
  for (const { country, userId } of unambiguous) {
    // Only while still unowned: never overwrite an owner set since the audit read.
    const { count } = await db.country.updateMany({
      where: { id: country.id, ownerUserId: null },
      data: { ownerUserId: userId },
    });
    applied += count;
  }
  return applied;
}

async function main(): Promise<void> {
  const [countries, users, wikiNames] = await Promise.all([
    db.country.findMany({
      where: { ownerUserId: null, leader: { not: null } },
      select: { id: true, name: true, leader: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      select: {
        id: true,
        clerkUserId: true,
        handle: true,
        forumUsername: true,
        wikiUsername: true,
      },
    }),
    loadVerifiedWikiNames(),
  ]);
  const index = indexUsers(users, wikiNames);
  const perCountry = countries
    .map((country) => candidatesFor(country, index))
    .filter((c) => c.length);

  console.log("countryId  name  leader  candidateUserId  matchedBy");
  for (const { country, userId, matchedBy } of perCountry.flat()) {
    console.log(
      `${country.id}  ${country.name}  ${country.leader}  ${userId}  ${matchedBy.join(",")}`
    );
  }
  const unambiguous = perCountry.flatMap((c) => (c.length === 1 ? c : []));
  const ambiguous = perCountry.filter((c) => c.length > 1).map((c) => c[0]!.country.id);
  console.log(
    `\n${perCountry.length} unowned countries match a user by leader name: ` +
      `${unambiguous.length} unambiguous, ${ambiguous.length} ambiguous.`
  );
  if (ambiguous.length > 0) console.log(`Ambiguous (never applied): ${ambiguous.join(", ")}`);

  if (!apply) {
    console.log("Dry run. Re-run with --apply to set ownerUserId for the unambiguous matches.");
    return;
  }
  console.log(`Applied ${await applyOwners(unambiguous)} owner(s).`);
}

main()
  .catch((error: Error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
