/**
 * Author display data for a page of rows (reads.ts re-exports it, so call sites do not change).
 */
import type { PrismaClient } from "@prisma/client";
import { personalAvatars } from "./personal-avatars";

export type AuthorsDb = Pick<PrismaClient, "user" | "thinkpagesAccount">;

export interface ForumUserAuthor {
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  flagUrl: string | null;
}
export interface ForumPersonaAuthor {
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

/**
 * Display data for a page of authors in one query per kind. A user is shown by Passport handle, else wiki name,
 * else Discord name, else "Member": never the forum name (it can be a legacy account name) and never a Clerk id.
 * Null ids (imported content whose XenForo author has no IxStats account, phase 4) are skipped.
 */
export async function authorsOf(
  db: AuthorsDb,
  userIds: ReadonlyArray<string | null | undefined>,
  personaIds: ReadonlyArray<string | null | undefined>
) {
  const present = (ids: ReadonlyArray<string | null | undefined>) => [
    ...new Set(ids.filter((id): id is string => !!id)),
  ];
  const uniqueUsers = present(userIds);
  const uniquePersonas = present(personaIds);
  const [users, personas] = await Promise.all([
    uniqueUsers.length
      ? db.user.findMany({
          where: { id: { in: uniqueUsers } },
          select: {
            id: true,
            handle: true,
            wikiUsername: true,
            clerkUserId: true,
            country: { select: { name: true, flag: true } },
          },
        })
      : [],
    uniquePersonas.length
      ? db.thinkpagesAccount.findMany({
          where: { id: { in: uniquePersonas } },
          select: { id: true, displayName: true, username: true, profileImageUrl: true },
        })
      : [],
  ]);
  const avatars = await personalAvatars(
    db,
    users.map((u) => u.clerkUserId)
  );
  return {
    users: new Map<string, ForumUserAuthor>(
      // Public names only: never the Discord name, which a linked account would otherwise publish.
      users.map((u) => [
        u.id,
        {
          name: u.handle ?? u.wikiUsername ?? u.country?.name ?? "Member",
          handle: u.handle,
          avatarUrl: avatars.get(u.clerkUserId) ?? null,
          flagUrl: u.country?.flag ?? null,
        },
      ])
    ),
    personas: new Map<string, ForumPersonaAuthor>(
      personas.map((p) => [
        p.id,
        { displayName: p.displayName, username: p.username, avatarUrl: p.profileImageUrl },
      ])
    ),
  };
}
