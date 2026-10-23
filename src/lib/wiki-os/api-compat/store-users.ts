/**
 * store-users.ts — the users of the Prisma `ApiStore` (plan 410, IxnayID): api.php knows an account by its
 * passport handle (`list=allusers` lists handles), its groups come by account or through a rights-passing claimed
 * name, and a revision's author reports the MediaWiki id its approved claim records. Read-only, like the rest of the
 * store (see store.ts).
 */

import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { isActive } from "~/lib/wiki-os/rights";
import { claimName, IXWIKI, namesOfUsers, type ClaimedName } from "~/lib/identity/wiki-names";
import { syntheticUserId } from "./auth-store";
import type { UserListQuery, UserListRow } from "./store-types";

const SOURCE = "ixwiki";

/** The MediaWiki user id of each author name when its approved claim records one. */
export async function authorIds(names: readonly string[]): Promise<Map<string, number>> {
  const unique = [...new Set(names)];
  if (unique.length === 0) return new Map();
  const claims = await db.wikiNameClaim.findMany({
    where: {
      source: IXWIKI,
      status: "APPROVED",
      name: { in: [...new Set(unique.map(claimName))] },
      mwUserId: { not: null },
    },
    select: { name: true, mwUserId: true },
  });
  const byName = new Map(
    claims.flatMap((claim) =>
      claim.mwUserId === null ? [] : [[claim.name, claim.mwUserId] as const]
    )
  );
  return new Map(
    unique.flatMap((author) => {
      const id = byName.get(claimName(author));
      return id === undefined ? [] : [[author, id] as const];
    })
  );
}

/** The user ids and wiki names holding `group` explicitly (not expired). */
async function groupMembers(group: string): Promise<{ ids: string[]; names: string[] }> {
  const rows = await db.wikiUserGroup.findMany({
    where: { group },
    select: { userId: true, wikiUsername: true, expiresAt: true },
    take: 5000,
  });
  const now = new Date();
  const live = rows.filter((row) => isActive(row.expiresAt, now));
  return {
    ids: live.flatMap((row) => row.userId ?? []),
    names: live.flatMap((row) => row.wikiUsername ?? []),
  };
}

/** Members by account, or through a claimed name a system owner let the name's imported groups pass with. */
const memberFilter = ({
  ids,
  names,
}: {
  ids: string[];
  names: string[];
}): Prisma.UserWhereInput => ({
  OR: [
    { id: { in: ids } },
    {
      wikiNameClaims: {
        some: { source: IXWIKI, status: "APPROVED", rightsPass: true, name: { in: names } },
      },
    },
  ],
});

/** A name as `list-users` passes it (MediaWiki's form, `Foo bar`) in a handle's form (`foo_bar`). */
const asHandle = (name: string) => name.toLowerCase().replace(/ /g, "_");

function handleFilter(
  query: UserListQuery,
  lower?: string,
  upper?: string
): Prisma.UserWhereInput["handle"] {
  return {
    not: null,
    ...(query.prefix ? { startsWith: asHandle(query.prefix) } : {}),
    ...(lower ? { gte: asHandle(lower) } : {}),
    ...(upper ? { lte: asHandle(upper) } : {}),
  };
}

const passingNames = (claims: readonly ClaimedName[] | undefined) =>
  (claims ?? []).filter((claim) => claim.rightsPass).map((claim) => claim.name);

/** The group rows of each account, by its id or by one of its rights-passing claimed names, in force now. */
async function groupsOf(
  ids: readonly string[],
  claims: ReadonlyMap<string, ClaimedName[]>
): Promise<Map<string, string[]>> {
  const names = [...claims.values()].flatMap(passingNames);
  const rows = await db.wikiUserGroup.findMany({
    where: { OR: [{ userId: { in: [...ids] } }, { wikiUsername: { in: names } }] },
    select: { userId: true, wikiUsername: true, group: true, expiresAt: true },
    // Several rows per user: more than the guard's default 1000 for a full page of users.
    take: 50_000,
  });
  const now = new Date();
  const live = rows.filter((row) => isActive(row.expiresAt, now));
  return new Map(
    ids.map((id) => {
      const own = new Set(passingNames(claims.get(id)));
      const held = live.filter(
        (row) => row.userId === id || (row.wikiUsername !== null && own.has(row.wikiUsername))
      );
      return [id, held.map((row) => row.group)] as const;
    })
  );
}

/** Revisions signed with each handle. */
async function editCountsOf(handles: readonly string[]): Promise<Map<string, number>> {
  const rows = await db.wikiRevision.groupBy({
    by: ["author"],
    where: { source: SOURCE, parked: false, author: { in: [...handles] } },
    _count: { _all: true },
  });
  return new Map(
    rows.flatMap((row) => (row.author ? [[row.author, row._count._all] as const] : []))
  );
}

/** Accounts by passport handle (IxnayID: api.php's users are handles; claimed names are aliases, not users). */
export async function listUsers(query: UserListQuery): Promise<UserListRow[]> {
  const ascending = query.dir === "ascending";
  const [lower, upper] = ascending ? [query.start, query.end] : [query.end, query.start];
  const and: Prisma.UserWhereInput[] = [];
  if (query.group) and.push(memberFilter(await groupMembers(query.group)));
  if (query.excludeGroup) and.push({ NOT: memberFilter(await groupMembers(query.excludeGroup)) });

  const found = await db.user.findMany({
    where: { handle: handleFilter(query, lower, upper), ...(and.length > 0 ? { AND: and } : {}) },
    orderBy: { handle: ascending ? "asc" : "desc" },
    take: query.limit + 1,
    select: { id: true, handle: true, createdAt: true },
  });
  const users = found.flatMap((user) => (user.handle ? [{ ...user, handle: user.handle }] : []));
  if (users.length === 0) return [];
  const ids = users.map((user) => user.id);
  const claims = await namesOfUsers(db, ids);
  const [groups, edits] = await Promise.all([
    groupsOf(ids, claims),
    query.withEditCount
      ? editCountsOf(users.map((user) => user.handle))
      : new Map<string, number>(),
  ]);
  return users.map((user) => ({
    name: user.handle,
    userId: claims.get(user.id)?.[0]?.mwUserId ?? syntheticUserId(user.id),
    registration: user.createdAt,
    editCount: edits.get(user.handle) ?? 0,
    groups: groups.get(user.id) ?? [],
  }));
}
