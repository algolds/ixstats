/**
 * Backfill IxStates Passport handles for users that have none.
 * Dry run by default: prints a table of `userId  source  handle`; --apply writes.
 *   bun scripts/identity/backfill-handles.ts [--apply]
 * Source order mirrors `passportHandle` in src/server/api/routers/ixnayid/core.ts, minus the country slug,
 * country name and Clerk session username (not stored on the user row): verified ixwiki link name,
 * forum username, Clerk user id, user id. Handles are de-duplicated against existing handles and
 * against earlier picks in the same run.
 */
import { PrismaClient } from "@prisma/client";
import { pickAvailableHandle, slugifyHandle } from "~/server/modules/identity/identity.handle";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

type SourceKind = "wiki" | "forum" | "clerk" | "id";

interface UserRow {
  id: string;
  clerkUserId: string;
  forumUsername: string | null;
}

interface Pick {
  userId: string;
  source: SourceKind;
  handle: string;
}

function chooseSource(user: UserRow, wikiName: string | undefined): { source: SourceKind; value: string } {
  if (wikiName) return { source: "wiki", value: wikiName };
  if (user.forumUsername) return { source: "forum", value: user.forumUsername };
  if (user.clerkUserId) return { source: "clerk", value: user.clerkUserId };
  return { source: "id", value: user.id };
}

async function loadVerifiedWikiNames(userIds: string[]): Promise<Map<string, string>> {
  const links = await db.wikiAccountLink.findMany({
    where: { userId: { in: userIds }, source: "ixwiki", verifiedAt: { not: null } },
    select: { userId: true, username: true },
    orderBy: { verifiedAt: "asc" },
  });
  const names = new Map<string, string>();
  for (const link of links) if (!names.has(link.userId)) names.set(link.userId, link.username);
  return names;
}

async function main(): Promise<void> {
  const [users, existing] = await Promise.all([
    db.user.findMany({
      where: { handle: null },
      select: { id: true, clerkUserId: true, forumUsername: true },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findMany({ where: { handle: { not: null } }, select: { handle: true } }),
  ]);
  const taken = new Set<string>(existing.flatMap((u) => (u.handle ? [u.handle] : [])));
  const wikiNames = await loadVerifiedWikiNames(users.map((u) => u.id));

  const picks: Pick[] = users.map((user) => {
    const { source, value } = chooseSource(user, wikiNames.get(user.id));
    const handle = pickAvailableHandle(slugifyHandle(value), taken);
    taken.add(handle);
    return { userId: user.id, source, handle };
  });

  console.log("userId  source  handle");
  for (const pick of picks) console.log(`${pick.userId}  ${pick.source}  ${pick.handle}`);
  console.log(`\n${picks.length} user(s) without a handle.`);

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
