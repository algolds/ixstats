/**
 * Resolves a public passport handle to a user, their country and linked wiki/forum names.
 * Order: the stored IxStates Passport handle, then the viewer's own linked names, then users by
 * forum name, wiki name, Clerk id or id, then external wiki/forum names. A country name, slug or id
 * does not resolve a person (country-name passport URLs are dropped).
 */
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { lookupWikiUser } from "~/lib/wiki-os/adapters/ixstates/user-sync";
import { validateHandle } from "./identity.handle";
import {
  IDENTITY_COUNTRY_SELECT,
  IDENTITY_USER_INCLUDE,
  type IdentityCountry,
} from "./identity.selects";
import type { IdentityForumGateway, ResolvedIdentity } from "./identity.types";

const insensitive = (value: string) => ({ equals: value, mode: "insensitive" as const });

/** The user holding the stored handle the segment names; only a valid handle can name one. */
async function findUserByStoredHandle(segment: string) {
  const valid = validateHandle(segment);
  if (!valid.ok) return null;
  return db.user.findUnique({ where: { handle: valid.handle }, include: IDENTITY_USER_INCLUDE });
}

async function findViewerMatch(viewerClerkId: string | null, names: string[]) {
  if (!viewerClerkId) return null;
  const viewer = await db.user.findUnique({
    where: { clerkUserId: viewerClerkId },
    include: IDENTITY_USER_INCLUDE,
  });
  if (!viewer) return null;
  const linked = [viewer.wikiUsername, viewer.forumUsername];
  return linked.some((name) => (name ? names.includes(name.toLowerCase()) : false)) ? viewer : null;
}

/** Legacy names a passport segment may carry: Clerk id, forum name, wiki name, user id, and `me`. */
function legacyNameWhere(
  handle: string,
  stripped: string,
  viewerClerkId: string | null
): Prisma.UserWhereInput {
  const isSelf = handle === "me" || handle === viewerClerkId;
  return {
    OR: [
      ...(isSelf && viewerClerkId ? [{ clerkUserId: viewerClerkId }] : []),
      { clerkUserId: handle },
      { forumUsername: insensitive(handle) },
      { wikiUsername: insensitive(handle) },
      { id: handle },
      ...(stripped !== handle
        ? [
            { forumUsername: insensitive(stripped) },
            { wikiUsername: insensitive(stripped) },
            { clerkUserId: stripped },
          ]
        : []),
    ],
  };
}

const NEWEST_FIRST: Prisma.UserOrderByWithRelationInput[] = [
  { updatedAt: "desc" },
  { createdAt: "desc" },
];

function findUserByHandle(handle: string, stripped: string, viewerClerkId: string | null) {
  return db.user.findFirst({
    where: legacyNameWhere(handle, stripped, viewerClerkId),
    orderBy: NEWEST_FIRST,
    include: IDENTITY_USER_INCLUDE,
  });
}

/** A user without a linked country may still own one through their active ThinkPages account. */
async function findThinkpagesCountry(clerkUserId: string): Promise<IdentityCountry | null> {
  const account = await db.thinkpagesAccount.findFirst({
    where: { clerkUserId, isActive: true, countryId: { not: null } },
    select: { countryId: true },
  });
  if (!account?.countryId) return null;
  return db.country.findUnique({
    where: { id: account.countryId },
    select: IDENTITY_COUNTRY_SELECT,
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

async function findUserAndCountry(handle: string, stripped: string, viewerClerkId: string | null) {
  const matched = await findPerson(handle, stripped, viewerClerkId);
  if (!matched) return { user: null, country: null };
  const { country, ...user } = matched;
  return { user, country: country ?? (await findThinkpagesCountry(user.clerkUserId)) };
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
  const handle = rawHandle.replace(/^@/, "").trim();
  const strippedHandle = handle.replace(/_$/, "");
  const { user, country } = await findUserAndCountry(handle, strippedHandle, viewerClerkId);

  const linked = user
    ? {
        wikiName: user.wikiUsername || country?.wikiPageTitle || country?.name || null,
        forumUserId: user.forumUserId ?? null,
        forumUsername: user.forumUsername ?? null,
      }
    : await findExternalNames([...new Set([handle, strippedHandle])], forum);

  if (!user && !linked.wikiName && !linked.forumUserId) return null;

  return {
    handle,
    strippedHandle,
    user,
    country,
    ...linked,
    isOwner: Boolean(viewerClerkId && user?.clerkUserId === viewerClerkId),
  };
}

/**
 * The Clerk id of the user a passport handle belongs to, without the external wiki and forum
 * lookups (for page metadata). Null when the handle names no user.
 */
export async function resolveHandleOwnerClerkId(rawHandle: string): Promise<string | null> {
  const handle = rawHandle.replace(/^@/, "").trim();
  if (!handle || handle === "me") return null;
  const { user } = await findUserAndCountry(handle, handle.replace(/_$/, ""), null);
  return user?.clerkUserId ?? null;
}

/**
 * The stored handle of the user a passport URL segment names, for the canonical 301. Looks up the
 * user only (no loaders, no external calls). Null for `me`, an unknown name, or a user with no
 * stored handle yet.
 */
export async function resolveCanonicalHandle(segment: string): Promise<{ handle: string } | null> {
  const handle = segment.replace(/^@/, "").trim();
  if (!handle || handle.toLowerCase() === "me") return null;
  // Same order as findPerson without a viewer: stored handle, then legacy names. Handle column only.
  const valid = validateHandle(handle);
  const byHandle = valid.ok
    ? await db.user.findUnique({ where: { handle: valid.handle }, select: { handle: true } })
    : null;
  const user =
    byHandle ??
    (await db.user.findFirst({
      where: legacyNameWhere(handle, handle.replace(/_$/, ""), null),
      orderBy: NEWEST_FIRST,
      select: { handle: true },
    }));
  return user?.handle ? { handle: user.handle } : null;
}

/** Every country the identity leads or is linked to, largest economy first. */
export async function resolveIdentityNations(
  identity: ResolvedIdentity
): Promise<IdentityCountry[]> {
  const { user, country, handle } = identity;
  if (!user) return country ? [country] : [];
  const leaderNames = [user.forumUsername, user.wikiUsername, handle === "me" ? null : handle];
  const nations = await db.country.findMany({
    where: {
      OR: [
        { ownerUserId: user.id },
        ...(user.countryId ? [{ id: user.countryId }] : []),
        ...(country ? [{ id: country.id }] : []),
        ...leaderNames.flatMap((name) => (name ? [{ leader: insensitive(name) }] : [])),
      ],
    },
    select: IDENTITY_COUNTRY_SELECT,
    orderBy: { currentTotalGdp: "desc" },
  });
  return nations.length === 0 && country ? [country] : nations;
}
