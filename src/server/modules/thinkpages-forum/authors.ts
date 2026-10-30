/**
 * Author display data for a page of rows (reads.ts re-exports it, so call sites do not change).
 */
import type { PrismaClient } from "@prisma/client";
import { personaTypeOf, type PersonaType } from "~/lib/thinkpages-forum/persona-type";
import type { PreviewAuthor } from "~/lib/thinkpages-forum/preview";
import { personalProfiles } from "./personal-profiles";

export type AuthorsDb = Pick<PrismaClient, "user" | "thinkpagesAccount">;

export interface ForumUserAuthor {
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  /**
   * The country flag to draw beside the avatar. Null when the avatar already is the flag (no persona picture), so
   * the flag is never drawn twice.
   */
  flagUrl: string | null;
}
export interface ForumPersonaAuthor {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  /** The persona's voice (government, media, citizen); null for a personal account. Never its nation. */
  personaType: PersonaType | null;
}

/**
 * Display data for a page of authors in one query per kind. A user is shown by their personal persona's name, else
 * Passport handle, else country name, else "Member"; their avatar is the persona picture, else the country flag.
 * The personal persona's own name wins, including one seeded from the forum name; the forum name itself (it can be
 * a legacy account name) is never read. Never an old wiki name (a name claim, shown on the passport) and never a
 * Clerk id. The name is the same for every viewer, the member included.
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
  const [rows, personas] = await Promise.all([
    uniqueUsers.length
      ? db.user.findMany({
          where: { id: { in: uniqueUsers } },
          select: {
            id: true,
            handle: true,
            clerkUserId: true,
            country: { select: { name: true, flag: true } },
          },
        })
      : [],
    uniquePersonas.length
      ? db.thinkpagesAccount.findMany({
          where: { id: { in: uniquePersonas } },
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
            accountType: true,
          },
        })
      : [],
  ]);
  const profiles = await personalProfiles(
    db,
    rows.map((u) => u.clerkUserId)
  );
  return {
    users: new Map<string, ForumUserAuthor>(
      // Public names only: never the Discord name, which a linked account would otherwise publish.
      rows.map((u) => {
        const profile = profiles.get(u.clerkUserId);
        const flag = u.country?.flag ?? null;
        const picture = profile?.avatarUrl ?? null;
        return [
          u.id,
          {
            name: profile?.displayName ?? u.handle ?? u.country?.name ?? "Member",
            handle: u.handle,
            avatarUrl: picture ?? flag,
            flagUrl: picture === null ? null : flag,
          },
        ];
      })
    ),
    personas: new Map<string, ForumPersonaAuthor>(
      personas.map((p) => [
        p.id,
        {
          displayName: p.displayName,
          username: p.username,
          avatarUrl: p.profileImageUrl,
          personaType: personaTypeOf(p.accountType),
        },
      ])
    ),
  };
}

export type AuthorMaps = Awaited<ReturnType<typeof authorsOf>>;

/**
 * An author as a preview outside the forum may show them, and the one place that rule lives (the Home feed card and
 * the realm board preview both use it). A persona is its name and picture only: no flag, and the row's user id is
 * never read, so the player cannot appear for any viewer. A member is their public name, picture and flag; imported
 * content its XenForo name; else `fallback`.
 */
export function previewAuthorOf(
  row: {
    authorUserId: string | null;
    authorPersonaId: string | null;
    importedAuthorName: string | null;
  },
  maps: AuthorMaps,
  fallback: string
): PreviewAuthor {
  if (row.authorPersonaId) {
    const persona = maps.personas.get(row.authorPersonaId);
    return {
      name: persona?.displayName ?? "Persona",
      avatarUrl: persona?.avatarUrl ?? null,
      flagUrl: null,
      persona: true,
      personaType: persona?.personaType ?? null,
    };
  }
  const user = row.authorUserId ? maps.users.get(row.authorUserId) : undefined;
  if (user) {
    return {
      name: user.name,
      avatarUrl: user.avatarUrl,
      flagUrl: user.flagUrl,
      persona: false,
      personaType: null,
    };
  }
  return {
    name: row.importedAuthorName ?? fallback,
    avatarUrl: null,
    flagUrl: null,
    persona: false,
    personaType: null,
  };
}
