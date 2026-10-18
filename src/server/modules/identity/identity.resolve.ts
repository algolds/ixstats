/**
 * Resolves a public passport handle to a user and their linked wiki/forum names.
 * Order: the stored IxStates Passport handle, then the viewer's own linked names, then users by
 * forum name, wiki name, Clerk id or id, then external wiki/forum names. A country name, slug or id
 * does not resolve a person (country-name passport URLs are dropped).
 *
 * A legacy wiki name resolves to its player only while they show wiki attribution
 * (`showWikiAttribution`): the switch is read in one batch for the users holding the name, and a
 * read error counts as off. With it off, a link carrying the wiki name (an old one) does not open
 * their passport; it falls through to the external wiki name, if any. The viewer's own names
 * (findViewerMatch) still resolve to themself.
 */
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { lookupWikiUser } from "~/lib/wiki-os/adapters/ixstates/user-sync";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";
import { validateHandle } from "./identity.handle";
import { IDENTITY_COUNTRY_SELECT, type IdentityCountry } from "./identity.selects";
import type { IdentityForumGateway, ResolvedIdentity } from "./identity.types";
import { likeLiteral } from "~/lib/utils/like-literal";
import { withoutHiddenWikiNames } from "~/server/shared/privacy-permissions";

/** A case-insensitive exact match: Prisma compiles it to ILIKE, so the value's wildcards are escaped. */
const insensitive = (value: string) => ({
  equals: likeLiteral(value),
  mode: "insensitive" as const,
});

/** The user holding the stored handle the segment names; only a valid handle can name one. */
async function findUserByStoredHandle(segment: string) {
  const valid = validateHandle(segment);
  if (!valid.ok) return null;
  return db.user.findUnique({ where: { handle: valid.handle } });
}

async function findViewerMatch(viewerClerkId: string | null, names: string[]) {
  if (!viewerClerkId) return null;
  const viewer = await db.user.findUnique({
    where: { clerkUserId: viewerClerkId },
  });
  if (!viewer) return null;
  const linked = [viewer.wikiUsername, viewer.forumUsername];
  return linked.some((name) => (name ? names.includes(name.toLowerCase()) : false)) ? viewer : null;
}

const WIKI_NAME_HOLDER_SELECT = {
  id: true,
  clerkUserId: true,
  wikiUsername: true,
} satisfies Prisma.UserSelect;
type WikiNameHolder = Prisma.UserGetPayload<{ select: typeof WIKI_NAME_HOLDER_SELECT }>;

/** The users holding one of `names` as their legacy `User.wikiUsername`; none when the read fails. */
async function wikiNameHolders(names: string[]): Promise<WikiNameHolder[]> {
  try {
    return await db.user.findMany({
      where: { OR: names.map((name) => ({ wikiUsername: insensitive(name) })) },
      select: WIKI_NAME_HOLDER_SELECT,
    });
  } catch {
    return [];
  }
}

/**
 * The legacy wiki-name match for `names`: the users holding one of them who show wiki attribution, by id. One
 * query for the holders and one batch switch read (withoutHiddenWikiNames); a read error matches nobody.
 */
async function attributedWikiNameMatch(names: string[]): Promise<Prisma.UserWhereInput[]> {
  const holders = await wikiNameHolders(names);
  if (holders.length === 0) return [];
  const shown = (await withoutHiddenWikiNames(db, holders)).filter((u) => u.wikiUsername);
  return shown.length > 0 ? [{ id: { in: shown.map((u) => u.id) } }] : [];
}

/**
 * Legacy names a passport segment may carry: Clerk id, forum name, wiki name (only while its owner shows wiki
 * attribution), user id, and `me`.
 */
async function legacyNameWhere(
  handle: string,
  stripped: string,
  viewerClerkId: string | null
): Promise<Prisma.UserWhereInput> {
  const isSelf = handle === "me" || handle === viewerClerkId;
  return {
    OR: [
      ...(isSelf && viewerClerkId ? [{ clerkUserId: viewerClerkId }] : []),
      { clerkUserId: handle },
      { forumUsername: insensitive(handle) },
      { id: handle },
      ...(stripped !== handle
        ? [{ forumUsername: insensitive(stripped) }, { clerkUserId: stripped }]
        : []),
      ...(await attributedWikiNameMatch([...new Set([handle, stripped])])),
    ],
  };
}

const NEWEST_FIRST: Prisma.UserOrderByWithRelationInput[] = [
  { updatedAt: "desc" },
  { createdAt: "desc" },
];

async function findUserByHandle(handle: string, stripped: string, viewerClerkId: string | null) {
  return db.user.findFirst({
    where: await legacyNameWhere(handle, stripped, viewerClerkId),
    orderBy: NEWEST_FIRST,
  });
}

async function firstHit<T>(names: string[], lookup: (name: string) => Promise<T | null>) {
  for (const name of names) {
    const hit = await lookup(name).catch(() => null);
    if (hit) return hit;
  }
  return null;
}

async function findWikiNameInDb(names: string[]): Promise<string | null> {
  const stats = await db.lorewardUserStats.findFirst({
    where: { OR: names.map((name) => ({ username: insensitive(name) })) },
    select: { username: true },
  });
  if (stats) return stats.username;
  const revision = await db.wikiRevision.findFirst({
    where: { OR: names.map((name) => ({ author: insensitive(name) })) },
    select: { author: true },
  });
  return revision?.author ?? null;
}

/** For a handle that matches no user: look it up as a forum or wiki username. */
async function findExternalNames(names: string[], forum: IdentityForumGateway | undefined) {
  const forumHit = forum ? await firstHit(names, (name) => forum.lookupUser(name)) : null;
  const wikiHit = await firstHit(names, lookupWikiUser);
  return {
    forumUserId: forumHit?.userId ?? null,
    forumUsername: forumHit?.username ?? null,
    wikiName: wikiHit?.username || (await findWikiNameInDb(names)),
  };
}

/** The user a segment names: stored handle first, then the viewer's own names, then legacy names. */
async function findPerson(handle: string, stripped: string, viewerClerkId: string | null) {
  const names = [...new Set([handle, stripped])].map((name) => name.toLowerCase());
  return (
    (await findUserByStoredHandle(handle)) ??
    (await findViewerMatch(viewerClerkId, names)) ??
    (await findUserByHandle(handle, stripped, viewerClerkId))
  );
}

type FoundUser = Awaited<ReturnType<typeof findPerson>>;
type LinkedNames = Pick<ResolvedIdentity, "wikiName" | "forumUserId" | "forumUsername">;

/**
 * The linked names of a found user. The wiki name is only `User.wikiUsername` (kept in sync with the
 * verified ixwiki link): a country's page title or name is never taken for the holder's wiki account,
 * so another wiki user's Lorewards, work and history are never attributed to them.
 */
function linkedNamesOf(user: FoundUser): LinkedNames | null {
  if (!user) return null;
  return {
    wikiName: user.wikiUsername || null,
    forumUserId: user.forumUserId ?? null,
    forumUsername: user.forumUsername ?? null,
  };
}

function toIdentity(
  handle: string,
  user: FoundUser,
  linked: LinkedNames,
  viewerClerkId: string | null
): ResolvedIdentity {
  return {
    handle,
    strippedHandle: handle.replace(/_$/, ""),
    user,
    ...linked,
    isOwner: Boolean(viewerClerkId && user?.clerkUserId === viewerClerkId),
  };
}

/** The URL segment as a handle, and the user it names. */
async function findBySegment(rawHandle: string, viewerClerkId: string | null) {
  const handle = rawHandle.replace(/^@/, "").trim();
  return { handle, user: await findPerson(handle, handle.replace(/_$/, ""), viewerClerkId) };
}

/**
 * Resolve a handle. `forum` is optional: only the Passport needs forum-only identities, so the
 * other tabs skip the XenForo round-trip.
 */
export async function resolveIdentity(
  rawHandle: string,
  viewerClerkId: string | null,
  forum?: IdentityForumGateway
): Promise<ResolvedIdentity | null> {
  const { handle, user } = await findBySegment(rawHandle, viewerClerkId);
  const linked =
    linkedNamesOf(user) ??
    (await findExternalNames([...new Set([handle, handle.replace(/_$/, "")])], forum));

  if (!user && !linked.wikiName && !linked.forumUserId) return null;
  return toIdentity(handle, user, linked, viewerClerkId);
}

/**
 * Resolve a handle to a user only: database reads, no external wiki or forum lookups (for the
 * passport card). Null when the handle names no user, including external wiki or forum names.
 */
export async function resolveUserIdentity(
  rawHandle: string,
  viewerClerkId: string | null
): Promise<ResolvedIdentity | null> {
  const { handle, user } = await findBySegment(rawHandle, viewerClerkId);
  const linked = linkedNamesOf(user);
  return linked ? toIdentity(handle, user, linked, viewerClerkId) : null;
}

/**
 * The Clerk id of the user a passport handle belongs to, without the external wiki and forum
 * lookups (for page metadata). Null when the handle names no user.
 */
export async function resolveHandleOwnerClerkId(rawHandle: string): Promise<string | null> {
  const handle = rawHandle.replace(/^@/, "").trim();
  if (!handle || handle === "me") return null;
  const user = await findPerson(handle, handle.replace(/_$/, ""), null);
  return user?.clerkUserId ?? null;
}

/**
 * The stored handle of the user a passport URL segment names, for the canonical 308. Looks up the
 * user only (no loaders, no external calls). Null for `me`, an unknown name, or a user with no
 * stored handle yet.
 */
export async function resolveCanonicalHandle(segment: string): Promise<{ handle: string } | null> {
  const lookup = segmentLookup(segment);
  if (!lookup) return null;
  // Handle column only.
  const select = { handle: true } as const;
  const user =
    (lookup.stored
      ? await db.user.findUnique({ where: { handle: lookup.stored }, select })
      : null) ??
    (await db.user.findFirst({ where: await lookup.legacy(), orderBy: NEWEST_FIRST, select }));
  return user?.handle ? { handle: user.handle } : null;
}

/**
 * How a segment names a user without a viewer, in findPerson's order: the stored handle it can be (null when
 * it cannot be one), then the legacy-name filter (built only when the stored handle names nobody). Null for an
 * empty segment or `me`.
 */
function segmentLookup(segment: string) {
  const handle = segment.replace(/^@/, "").trim();
  if (!handle || handle.toLowerCase() === "me") return null;
  const valid = validateHandle(handle);
  return {
    stored: valid.ok ? valid.handle : null,
    legacy: () => legacyNameWhere(handle, handle.replace(/_$/, ""), null),
  };
}

const HANDLE_USER_SELECT = {
  id: true,
  clerkUserId: true,
  handle: true,
  forumUsername: true,
} satisfies Prisma.UserSelect;

export type HandleUser = Prisma.UserGetPayload<{ select: typeof HANDLE_USER_SELECT }>;

/**
 * The user a handle names (an invite's `via`): stored handle, then legacy names, no viewer. Database reads
 * only, no external wiki or forum lookups. Null when it names nobody.
 */
export async function resolveHandleUser(segment: string): Promise<HandleUser | null> {
  const lookup = segmentLookup(segment);
  if (!lookup) return null;
  const select = HANDLE_USER_SELECT;
  return (
    (lookup.stored
      ? await db.user.findUnique({ where: { handle: lookup.stored }, select })
      : null) ??
    (await db.user.findFirst({ where: await lookup.legacy(), orderBy: NEWEST_FIRST, select }))
  );
}

/**
 * The nations the identity's user holds (`Country.ownerUserId`), in realms the directory lists,
 * largest economy first. Leader names, the linked `User.countryId` and the resolved country confer
 * nothing (see scripts/identity/audit-leader-ownership.ts for leader-name backfills).
 */
export async function resolveIdentityNations(
  identity: ResolvedIdentity
): Promise<IdentityCountry[]> {
  const { user } = identity;
  if (!user) return [];
  return db.country.findMany({
    where: {
      ownerUserId: user.id,
      // Ixnay nations count even when Ixnay has no realm row (the relation filter needs one).
      OR: [{ realmId: DEFAULT_REALM_ID }, { realm: DIRECTORY_REALM_WHERE }],
    },
    select: IDENTITY_COUNTRY_SELECT,
    orderBy: { currentTotalGdp: "desc" },
  });
}
