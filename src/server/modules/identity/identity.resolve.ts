/**
 * Resolves a public passport handle to a user, their country and linked wiki/forum names.
 * Order: the viewer's own linked names, then users, then countries, then external wiki/forum names.
 */
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { lookupWikiUser } from "~/lib/wiki-os/adapters/ixstates/user-sync";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import {
  IDENTITY_COUNTRY_SELECT,
  IDENTITY_USER_INCLUDE,
  type IdentityCountry,
} from "./identity.selects";
import type { IdentityForumGateway, ResolvedIdentity } from "./identity.types";

const insensitive = (value: string) => ({ equals: value, mode: "insensitive" as const });

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

function findUserByHandle(handle: string, stripped: string, viewerClerkId: string | null) {
  const isSelf = handle === "me" || handle === viewerClerkId;
  return db.user.findFirst({
    where: {
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
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: IDENTITY_USER_INCLUDE,
  });
}

/** A user without a linked country may still own one through their active ThinkPages account. */
async function findThinkpagesCountry(clerkUserId: string): Promise<IdentityCountry | null> {
  const account = await db.thinkpagesAccount.findFirst({
    where: { clerkUserId, isActive: true },
    select: { countryId: true },
  });
  if (!account?.countryId) return null;
  return db.country.findUnique({
    where: { id: account.countryId },
    select: IDENTITY_COUNTRY_SELECT,
  });
}

const HANDLE_COUNTRY_SELECT = {
  ...IDENTITY_COUNTRY_SELECT,
  owner: { include: { role: true } },
} satisfies Prisma.CountrySelect;

/**
 * A handle names a country by its slug or id (globally unique) first; a bare name or wiki page title
 * is read as an IxWorld nation, since names repeat across realms (ruling E-p).
 */
async function findCountryByHandle(handle: string, stripped: string) {
  const byKey = await db.country.findFirst({
    where: {
      OR: [{ slug: handle.toLowerCase() }, { slug: stripped.toLowerCase() }, { id: handle }],
    },
    select: HANDLE_COUNTRY_SELECT,
  });
  if (byKey) return byKey;
  return db.country.findFirst({
    where: {
      realmId: DEFAULT_REALM_ID,
      OR: [{ name: handle }, { name: stripped }, { wikiPageTitle: handle }],
    },
    select: HANDLE_COUNTRY_SELECT,
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

/** For a handle that matches no user or country: look it up as a forum or wiki username. */
async function findExternalNames(names: string[], forum: IdentityForumGateway | undefined) {
  const forumHit = forum ? await firstHit(names, (name) => forum.lookupUser(name)) : null;
  const wikiHit = await firstHit(names, lookupWikiUser);
  return {
    forumUserId: forumHit?.userId ?? null,
    forumUsername: forumHit?.username ?? null,
    wikiName: wikiHit?.username || (await findWikiNameInDb(names)),
  };
}

async function findUserAndCountry(handle: string, stripped: string, viewerClerkId: string | null) {
  const names = [...new Set([handle, stripped])];
  const matched =
    (await findViewerMatch(
      viewerClerkId,
      names.map((name) => name.toLowerCase())
    )) ?? (await findUserByHandle(handle, stripped, viewerClerkId));
  if (matched) {
    const { country, ...user } = matched;
    return { user, country: country ?? (await findThinkpagesCountry(user.clerkUserId)) };
  }
  const byCountry = await findCountryByHandle(handle, stripped);
  if (!byCountry) return { user: null, country: null };
  const { owner, ...country } = byCountry;
  return { user: owner?.isActive ? owner : null, country };
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

  const linked =
    user || country
      ? {
          wikiName: user?.wikiUsername || country?.wikiPageTitle || country?.name || null,
          forumUserId: user?.forumUserId ?? null,
          forumUsername: user?.forumUsername ?? null,
        }
      : await findExternalNames([...new Set([handle, strippedHandle])], forum);

  if (!user && !country && !linked.wikiName && !linked.forumUserId) return null;

  return {
    handle,
    strippedHandle,
    user,
    country,
    ...linked,
    isOwner: Boolean(viewerClerkId && user?.clerkUserId === viewerClerkId),
  };
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
