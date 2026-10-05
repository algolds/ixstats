/**
 * Realm region pages (docs/specs/2026-10-05-realm-regions-design.md): what /r/[realm] shows — banner, key
 * stats, factbook, officers, embassies, the realm poll, the latest board posts and happenings — and the
 * staff checks every Manage action goes through.
 */
import type { PrismaClient } from "@prisma/client";
import { STAFF_FOUNDER_ID, type RealmPower } from "~/lib/realms/realm-region";
import { resolveDisplayNames } from "~/server/shared/display-names";
import {
  activeBoardRestrictions,
  embassyPartners,
  groupPostTag,
  strongestRestriction,
} from "~/server/shared/realm-board";
import {
  canModerateRealm,
  isRealmOpen,
  isRealmPublished,
  realmPowers,
  type RealmActor,
} from "./realms.access";

type RegionErrorCode = "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST";

export class RealmRegionError extends Error {
  constructor(
    public readonly code: RegionErrorCode,
    message: string
  ) {
    super(message);
    this.name = "RealmRegionError";
  }
}

const STAFF_REALM_SELECT = {
  id: true,
  slug: true,
  name: true,
  ownerId: true,
  status: true,
  officers: { select: { userId: true, powers: true } },
} as const;

/** The realm by slug with its officer grants; drafts are visible to their moderators only. */
export async function loadRegionRealm(
  db: Pick<PrismaClient, "realm">,
  slug: string,
  actor: RealmActor | null
) {
  const realm = await db.realm.findUnique({ where: { slug }, select: STAFF_REALM_SELECT });
  if (!realm) throw new RealmRegionError("NOT_FOUND", "Realm not found");
  if (!isRealmPublished(realm.id, realm.status) && !(actor && canModerateRealm(actor, realm)))
    throw new RealmRegionError("NOT_FOUND", "Realm not found");
  return realm;
}

/**
 * The realm, if `actor` may act on it with `power` (`"founder"`: the founder or a site admin). Archived realms
 * are read-only. Throws FORBIDDEN otherwise.
 */
export async function requireRealmStaff(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  slug: string,
  power: RealmPower | "founder"
) {
  const realm = await loadRegionRealm(db, slug, actor);
  const allowed =
    power === "founder"
      ? canModerateRealm(actor, realm)
      : realmPowers(actor, realm, realm.officers).includes(power);
  if (!allowed) throw new RealmRegionError("FORBIDDEN", "You can't manage this part of the realm");
  if (realm.status === "archived")
    throw new RealmRegionError("FORBIDDEN", "This realm is archived and can't be changed");
  return realm;
}

type OverviewDb = Pick<
  PrismaClient,
  | "realm"
  | "country"
  | "user"
  | "thinkpagesAccount"
  | "realmEmbassy"
  | "realmBoard"
  | "realmBoardBan"
  | "thinkpagesPost"
  | "poll"
  | "pollVote"
  | "realmClaim"
  | "realmOfficer"
  | "activityFeed"
>;

/** Officers (and the founder) shown with the name of their nation in this realm, else their display name. */
async function staffNames(db: OverviewDb, realmId: string, clerkUserIds: string[]) {
  if (clerkUserIds.length === 0) return new Map<string, StaffPerson>();
  const [nations, names] = await Promise.all([
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
  ]);
  const people = new Map<string, StaffPerson>();
  for (const id of clerkUserIds) {
    const nation = nations.find((n) => n.owner?.clerkUserId === id) ?? null;
    people.set(id, {
      name: nation?.name ?? names.get(id) ?? "Unknown user",
      nation: nation
        ? { id: nation.id, name: nation.name, slug: nation.slug, flag: nation.flag }
        : null,
    });
  }
  return people;
}

interface StaffPerson {
  name: string;
  nation: { id: string; name: string; slug: string | null; flag: string | null } | null;
}

/** The realm's open poll (one at a time) with its counts and the viewer's ballot. */
export async function realmPoll(
  db: Pick<PrismaClient, "poll" | "pollVote">,
  realmId: string,
  viewer: { clerkUserId: string } | null,
  canVote: boolean
) {
  const poll = await db.poll.findFirst({
    where: { realmId, isActive: true },
    orderBy: { createdAt: "desc" },
    include: { options: { include: { _count: { select: { votes: true } } } } },
  });
  if (!poll) return null;
  const mine = viewer
    ? await db.pollVote.findMany({
        where: { pollId: poll.id, userId: viewer.clerkUserId },
        select: { optionId: true },
      })
    : [];
  const expired = poll.endDate !== null && poll.endDate < new Date();
  return {
    id: poll.id,
    question: poll.question,
    description: poll.description,
    multiple: poll.multiple,
    endDate: poll.endDate,
    expired,
    options: poll.options.map((o) => ({ id: o.id, label: o.label, votes: o._count.votes })),
    totalVotes: poll.options.reduce((sum, o) => sum + o._count.votes, 0),
    userVotedOptionIds: mine.map((v) => v.optionId),
    canVote: canVote && !expired && mine.length === 0,
  };
}

const BOARD_PREVIEW_SIZE = 5;

/** The board's latest posts for the front page (the full board is on its own tab). */
async function boardPreview(db: OverviewDb, realmId: string) {
  const board = await db.realmBoard.findUnique({ where: { realmId }, select: { groupId: true } });
  if (!board) return { groupId: null, posts: [] };
  const posts = await db.thinkpagesPost.findMany({
    where: {
      hashtags: { contains: `"${groupPostTag(board.groupId)}"` },
      visibility: { not: "removed" },
    },
    orderBy: { createdAt: "desc" },
    take: BOARD_PREVIEW_SIZE,
    select: {
      id: true,
      content: true,
      createdAt: true,
      account: {
        select: {
          displayName: true,
          username: true,
          country: { select: { name: true, slug: true, flag: true } },
        },
      },
    },
  });
  return {
    groupId: board.groupId,
    posts: posts.map((p) => ({
      id: p.id,
      content: p.content,
      createdAt: p.createdAt,
      author: {
        name: p.account?.displayName ?? p.account?.username ?? "Unknown",
        username: p.account?.username ?? null,
        country: p.account?.country ?? null,
      },
    })),
  };
}

/** Everything the realm page's front page and header need, in one call. */
export async function getRealmOverview(db: OverviewDb, slug: string, viewer: RealmActor | null) {
  const realm = await db.realm.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      thumbnail: true,
      bannerUrl: true,
      tags: true,
      status: true,
      ownerId: true,
      foundedAt: true,
      createdAt: true,
      factbookHtml: true,
      factbookUpdatedAt: true,
      officers: {
        orderBy: { createdAt: "asc" },
        select: { userId: true, title: true, powers: true },
      },
    },
  });
  if (!realm) return null;
  if (!isRealmPublished(realm.id, realm.status) && !(viewer && canModerateRealm(viewer, realm)))
    return null;

  const [stats, claimed, ownedNations, partners, preview] = await Promise.all([
    db.country.aggregate({
      where: { realmId: realm.id },
      _count: { _all: true },
      _sum: { currentPopulation: true },
    }),
    db.country.count({ where: { realmId: realm.id, ownerUserId: { not: null } } }),
    viewer
      ? db.country.findMany({
          where: { realmId: realm.id, ownerUserId: viewer.id },
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true },
        })
      : Promise.resolve([]),
    embassyPartners(db, realm.id),
    boardPreview(db, realm.id),
  ]);

  const founderIsStaff = realm.ownerId === STAFF_FOUNDER_ID;
  const people = await staffNames(db, realm.id, [
    ...(founderIsStaff ? [] : [realm.ownerId]),
    ...realm.officers.map((o) => o.userId),
  ]);
  const powers = realmPowers(viewer, realm, realm.officers);
  const restrictions =
    viewer && ownedNations.length > 0
      ? await activeBoardRestrictions(
          db,
          realm.id,
          ownedNations.map((n) => n.id)
        )
      : [];
  const partnerIds = [...partners.keys()];
  const partnerLooks =
    partnerIds.length > 0
      ? await db.realm.findMany({
          // A partner that went back to draft is hidden from everyone but its own staff (AT-6).
          where: { id: { in: partnerIds }, status: { notIn: ["draft", "generating"] } },
          orderBy: { name: "asc" },
          select: { slug: true, name: true, bannerUrl: true, thumbnail: true },
        })
      : [];

  return {
    realm: {
      id: realm.id,
      slug: realm.slug,
      name: realm.name,
      description: realm.description,
      thumbnail: realm.thumbnail,
      bannerUrl: realm.bannerUrl,
      tags: realm.tags,
      status: realm.status,
      foundedAt: realm.foundedAt ?? realm.createdAt,
      claimsOpen: isRealmOpen(realm.id, realm.status),
    },
    founder: founderIsStaff ? null : (people.get(realm.ownerId) ?? null),
    stats: {
      nations: stats._count._all,
      claimedNations: claimed,
      population: stats._sum.currentPopulation ?? 0,
    },
    factbook: realm.factbookHtml
      ? { html: realm.factbookHtml, updatedAt: realm.factbookUpdatedAt }
      : null,
    officers: realm.officers.map((o) => ({
      title: o.title,
      powers: o.powers,
      ...(people.get(o.userId) ?? { name: "Unknown user", nation: null }),
    })),
    embassies: partnerLooks,
    poll: await realmPoll(db, realm.id, viewer, ownedNations.length > 0),
    board: preview,
    viewer: {
      signedIn: viewer !== null,
      powers,
      isFounder: viewer !== null && canModerateRealm(viewer, realm),
      canManage: powers.length > 0,
      ownedNations,
      boardRestriction: strongestRestriction(restrictions),
    },
  };
}

const HAPPENINGS_SIZE = 15;

export interface Happening {
  id: string;
  at: Date;
  kind: "nation" | "claim" | "embassy" | "officer" | "activity";
  text: string;
  href: string | null;
}

/**
 * The realm's happenings: game events from its nations (the activity feed), new nations, approved claims,
 * embassies opened and officers appointed — newest first. Composed on read; nothing is stored twice.
 */
export async function getRealmHappenings(db: OverviewDb, slug: string, viewer: RealmActor | null) {
  const realm = await loadRegionRealm(db, slug, viewer);
  const take = HAPPENINGS_SIZE;
  const [nations, claims, embassies, officers] = await Promise.all([
    db.country.findMany({
      where: { realmId: realm.id },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, name: true, slug: true, createdAt: true },
    }),
    db.realmClaim.findMany({
      where: { realmId: realm.id, status: "approved", reviewedAt: { not: null } },
      orderBy: { reviewedAt: "desc" },
      take,
      select: {
        id: true,
        reviewedAt: true,
        wikiPageTitle: true,
        country: { select: { name: true, slug: true } },
      },
    }),
    db.realmEmbassy.findMany({
      where: {
        status: "active",
        openedAt: { not: null },
        OR: [{ fromRealmId: realm.id }, { toRealmId: realm.id }],
      },
      orderBy: { openedAt: "desc" },
      take,
      select: {
        id: true,
        openedAt: true,
        fromRealmId: true,
        fromRealm: { select: { name: true, slug: true } },
        toRealm: { select: { name: true, slug: true } },
      },
    }),
    db.realmOfficer.findMany({
      where: { realmId: realm.id },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, userId: true, title: true, createdAt: true },
    }),
  ]);
  const countryIds = (
    await db.country.findMany({ where: { realmId: realm.id }, select: { id: true } })
  ).map((c) => c.id);
  const activity =
    countryIds.length > 0
      ? await db.activityFeed.findMany({
          where: { countryId: { in: countryIds }, visibility: "public", category: "game" },
          orderBy: { createdAt: "desc" },
          take,
          select: { id: true, title: true, createdAt: true },
        })
      : [];
  const people = await staffNames(
    db,
    realm.id,
    officers.map((o) => o.userId)
  );

  const nationHref = (c: { slug: string | null; id?: string }) =>
    c.slug ? `/countries/${c.slug}` : c.id ? `/countries/${c.id}` : null;
  const items: Happening[] = [
    ...nations.map((n) => ({
      id: `nation:${n.id}`,
      at: n.createdAt,
      kind: "nation" as const,
      text: `${n.name} was founded`,
      href: nationHref(n),
    })),
    ...claims.map((c) => ({
      id: `claim:${c.id}`,
      at: c.reviewedAt!,
      kind: "claim" as const,
      text: `${c.country?.name ?? c.wikiPageTitle ?? "A nation"} was claimed by a new player`,
      href: c.country ? nationHref(c.country) : null,
    })),
    ...embassies.map((e) => {
      const partner = e.fromRealmId === realm.id ? e.toRealm : e.fromRealm;
      return {
        id: `embassy:${e.id}`,
        at: e.openedAt!,
        kind: "embassy" as const,
        text: `An embassy with ${partner.name} opened`,
        href: `/r/${partner.slug}`,
      };
    }),
    ...officers.map((o) => ({
      id: `officer:${o.id}`,
      at: o.createdAt,
      kind: "officer" as const,
      text: `${people.get(o.userId)?.name ?? "A player"} became ${o.title}`,
      href: null,
    })),
    ...activity.map((a) => ({
      id: `activity:${a.id}`,
      at: a.createdAt,
      kind: "activity" as const,
      text: a.title,
      href: null,
    })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, HAPPENINGS_SIZE);
}

/** The Manage tab's data. Each section is filled only when the actor holds its power. */
export async function getRealmManage(db: OverviewDb, slug: string, actor: RealmActor) {
  const staff = await loadRegionRealm(db, slug, actor);
  const powers = realmPowers(actor, staff, staff.officers);
  if (powers.length === 0) throw new RealmRegionError("FORBIDDEN", "You can't manage this realm");
  const isFounder = canModerateRealm(actor, staff);
  const can = (p: RealmPower) => powers.includes(p);

  const realm = await db.realm.findUniqueOrThrow({
    where: { id: staff.id },
    select: {
      description: true,
      bannerUrl: true,
      tags: true,
      factbookWikitext: true,
      factbookUpdatedAt: true,
      ownerId: true,
    },
  });

  const [officers, embassies, restrictions, polls] = await Promise.all([
    db.realmOfficer.findMany({
      where: { realmId: staff.id },
      orderBy: { createdAt: "asc" },
      select: { userId: true, title: true, powers: true, createdAt: true },
    }),
    can("diplomacy")
      ? db.realmEmbassy.findMany({
          where: {
            status: { in: ["proposed", "active"] },
            OR: [{ fromRealmId: staff.id }, { toRealmId: staff.id }],
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            status: true,
            fromRealmId: true,
            openedAt: true,
            createdAt: true,
            fromRealm: { select: { name: true, slug: true } },
            toRealm: { select: { name: true, slug: true } },
          },
        })
      : Promise.resolve([]),
    can("board")
      ? db.realmBoardBan.findMany({
          where: { realmId: staff.id, OR: [{ until: null }, { until: { gt: new Date() } }] },
          orderBy: { createdAt: "desc" },
          select: {
            countryId: true,
            kind: true,
            reason: true,
            until: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    can("diplomacy")
      ? db.poll.findMany({
          where: { realmId: staff.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            question: true,
            isActive: true,
            endDate: true,
            createdAt: true,
            _count: { select: { votes: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const people = await staffNames(
    db,
    staff.id,
    officers.map((o) => o.userId)
  );
  const restrictedNations =
    restrictions.length > 0
      ? await db.country.findMany({
          where: { id: { in: restrictions.map((r) => r.countryId) } },
          select: { id: true, name: true, slug: true, flag: true },
        })
      : [];

  return {
    realm: { id: staff.id, slug: staff.slug, name: staff.name, status: staff.status },
    powers,
    isFounder,
    archived: staff.status === "archived",
    appearance: can("appearance")
      ? { description: realm.description, bannerUrl: realm.bannerUrl, tags: realm.tags }
      : null,
    factbook: can("appearance")
      ? { wikitext: realm.factbookWikitext ?? "", updatedAt: realm.factbookUpdatedAt }
      : null,
    officers: officers.map((o) => ({
      userId: o.userId,
      title: o.title,
      powers: o.powers,
      appointedAt: o.createdAt,
      ...(people.get(o.userId) ?? { name: "Unknown user", nation: null }),
    })),
    embassies: embassies.map((e) => {
      const outgoing = e.fromRealmId === staff.id;
      return {
        id: e.id,
        status: e.status,
        direction: outgoing ? ("outgoing" as const) : ("incoming" as const),
        partner: outgoing ? e.toRealm : e.fromRealm,
        openedAt: e.openedAt,
        createdAt: e.createdAt,
      };
    }),
    boardRestrictions: restrictions.map((r) => ({
      ...r,
      nation: restrictedNations.find((n) => n.id === r.countryId) ?? null,
    })),
    polls: polls.map(({ _count, ...p }) => ({ ...p, votes: _count.votes })),
  };
}
