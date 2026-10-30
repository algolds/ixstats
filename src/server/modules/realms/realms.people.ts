/**
 * How the realm page names a person (an officer, the founder, a founding member): the name of their nation in the
 * realm, else their display name, plus the passport handle they link to.
 */
import type { PrismaClient } from "@prisma/client";
import { personHref } from "~/lib/realms/realm-region";
import { resolveDisplayNames } from "~/server/shared/display-names";

export type PeopleDb = Pick<PrismaClient, "country" | "user" | "thinkpagesAccount">;

export interface StaffPerson {
  name: string;
  handle: string | null;
  nation: { id: string; name: string; slug: string | null; flag: string | null } | null;
}

/**
 * Officers (and the founder) shown with the name of their nation in this realm, else their display name, plus
 * their passport handle (null until claimed) so realm pages link them to `/@handle`.
 */
export async function staffNames(db: PeopleDb, realmId: string, clerkUserIds: string[]) {
  if (clerkUserIds.length === 0) return new Map<string, StaffPerson>();
  const [nations, names, users] = await Promise.all([
    db.country.findMany({
      where: { realmId, owner: { clerkUserId: { in: clerkUserIds } } },
      orderBy: { name: "asc" },
      select: {
        name: true,
        slug: true,
        id: true,
        flag: true,
        owner: { select: { clerkUserId: true } },
      },
    }),
    resolveDisplayNames(db, clerkUserIds),
    db.user.findMany({
      where: { clerkUserId: { in: clerkUserIds } },
      select: { clerkUserId: true, handle: true },
    }),
  ]);
  const handles = new Map(users.map((u) => [u.clerkUserId, u.handle]));
  const people = new Map<string, StaffPerson>();
  for (const id of clerkUserIds) {
    const nation = nations.find((n) => n.owner?.clerkUserId === id) ?? null;
    people.set(id, {
      name: nation?.name ?? names.get(id) ?? "Unknown user",
      handle: handles.get(id) ?? null,
      nation: nation
        ? { id: nation.id, name: nation.name, slug: nation.slug, flag: nation.flag }
        : null,
    });
  }
  return people;
}

/**
 * The realm's founding members in header order, named and linked the way the founder line is (`staffNames`,
 * `personHref`). `userId` is for staff pickers; the public overview drops it.
 */
export async function listFounders(
  db: PeopleDb & Pick<PrismaClient, "realmFounder">,
  realmId: string
) {
  const rows = await db.realmFounder.findMany({
    where: { realmId },
    orderBy: { order: "asc" },
    select: { userId: true },
  });
  const people = await staffNames(
    db,
    realmId,
    rows.map((r) => r.userId)
  );
  return rows.map(({ userId }) => {
    const person = people.get(userId);
    return {
      userId,
      name: person?.name ?? "Unknown user",
      link: person ? personHref(person) : null,
    };
  });
}
