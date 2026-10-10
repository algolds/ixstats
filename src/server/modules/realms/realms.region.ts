/**
 * Realm region pages (docs/specs/2026-10-05-realm-regions-design.md): what /r/[realm] shows — banner, key
 * stats and in-world date, factbook, rules, community links, officers, embassies, the realm poll, the latest
 * forum threads and happenings — and the staff checks every Manage action goes through.
 */
import type { PrismaClient } from "@prisma/client";
import { STAFF_FOUNDER_ID, type HappeningKind, type RealmPower } from "~/lib/realms/realm-region";
import { formatInWorldDate, parseRealmLinks } from "~/lib/realms/realm-community";
import { sanitizeRealmContent, stripHtml } from "~/lib/utils/sanitize-html";
import { resolveDisplayNames } from "~/server/shared/display-names";
import { embassyPartners } from "~/server/shared/realm-board";
import {
  canModerateRealm,
  isRealmOpen,
  isRealmPublished,
  realmPowers,
  type RealmActor,
} from "./realms.access";
import { forumPreview } from "./realms.forum-preview";
import { realmInWorldDate } from "./realms.settings";

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

/** A partner realm shown to everyone: not a draft or generating realm, which only its own staff see (AT-6). */
const PUBLISHED_PARTNER = { status: { notIn: ["draft", "generating"] } };

type OverviewDb = Pick<
  PrismaClient,
  | "realm"
  | "country"
  | "user"
  | "thinkpagesAccount"
  | "realmEmbassy"
  | "forumCategory"
  | "forumThread"
  | "poll"
  | "pollVote"
  | "realmClaim"
  | "realmOfficer"
  | "activityFeed"
>;

/**
 * Officers (and the founder) shown with the name of their nation in this realm, else their display name, plus
 * their passport handle (null until claimed) so realm pages link them to `/@handle`.
 */
async function staffNames(db: OverviewDb, realmId: string, clerkUserIds: string[]) {
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

interface StaffPerson {
  name: string;
  handle: string | null;
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

const RULES_SUMMARY_LENGTH = 280;

/** The rules' opening as plain text, for the claim form beside "Read the rules". */
function rulesSummary(html: string): string {
  const text = stripHtml(html);
  return text.length > RULES_SUMMARY_LENGTH
    ? `${text.slice(0, RULES_SUMMARY_LENGTH).trimEnd()}…`
    : text;
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
      rulesHtml: true,
      rulesUpdatedAt: true,
      communityLinks: true,
      settings: true,
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
    forumPreview(db, realm.id, viewer),
  ]);

  const founderIsStaff = realm.ownerId === STAFF_FOUNDER_ID;
  const people = await staffNames(db, realm.id, [
    ...(founderIsStaff ? [] : [realm.ownerId]),
    ...realm.officers.map((o) => o.userId),
  ]);
  const powers = realmPowers(viewer, realm, realm.officers);
  const partnerIds = [...partners.keys()];
  const partnerLooks =
    partnerIds.length > 0
      ? await db.realm.findMany({
          // A partner that went back to draft is hidden from everyone but its own staff (AT-6).
          where: { id: { in: partnerIds }, ...PUBLISHED_PARTNER },
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
    // Sanitized again on read: HTML saved before the realm sanitizer could still carry styling.
    factbook: realm.factbookHtml
      ? { html: sanitizeRealmContent(realm.factbookHtml), updatedAt: realm.factbookUpdatedAt }
      : null,
    rules: realm.rulesHtml
      ? {
          html: sanitizeRealmContent(realm.rulesHtml),
          summary: rulesSummary(realm.rulesHtml),
          updatedAt: realm.rulesUpdatedAt,
        }
      : null,
    links: parseRealmLinks(realm.communityLinks),
    inWorldDate: formatInWorldDate(realmInWorldDate(realm.settings)),
    officers: realm.officers.map((o) => ({
      title: o.title,
      powers: o.powers,
      ...(people.get(o.userId) ?? { name: "Unknown user", handle: null, nation: null }),
    })),
    embassies: partnerLooks,
    poll: await realmPoll(db, realm.id, viewer, ownedNations.length > 0),
    forum: preview,
    viewer: {
      signedIn: viewer !== null,
      powers,
      isFounder: viewer !== null && canModerateRealm(viewer, realm),
      canManage: powers.length > 0,
      ownedNations,
    },
  };
}

/** The sidebar shows this many; the full history pages through them this many at a time by default. */
export const HAPPENINGS_SIZE = 15;

export interface Happening {
  id: string;
  at: Date;
  kind: HappeningKind;
  text: string;
  href: string | null;
}

export interface HappeningsQuery {
  /** Only happenings strictly older than this (the previous page's `nextCursor`). */
  before?: Date | null;
  /** Only these kinds; all when omitted or empty. */
  kinds?: readonly HappeningKind[];
  limit?: number;
}

/**
 * The realm's happenings: game events from its nations (the activity feed), new nations, approved claims,
 * embassies opened and officers appointed — newest first, a page at a time. Composed on read (nothing is stored
 * twice): each source reads one more than the page from before `before`, and `nextCursor` is the oldest item
 * shown when more remain.
 */
export async function getRealmHappenings(
  db: OverviewDb,
  slug: string,
  viewer: RealmActor | null,
  query: HappeningsQuery = {}
): Promise<{ items: Happening[]; nextCursor: string | null }> {
  const realm = await loadRegionRealm(db, slug, viewer);
  const limit = query.limit ?? HAPPENINGS_SIZE;
  const take = limit + 1;
  const wants = (kind: HappeningKind) => !query.kinds?.length || query.kinds.includes(kind);
  const older = query.before ? { lt: query.before } : undefined;
  const none = Promise.resolve([]);

  const [nations, claims, embassies, officers, activity] = await Promise.all([
    wants("nation")
      ? db.country.findMany({
          where: { realmId: realm.id, ...(older && { createdAt: older }) },
          orderBy: { createdAt: "desc" },
          take,
          select: { id: true, name: true, slug: true, createdAt: true },
        })
      : none,
    wants("claim")
      ? db.realmClaim.findMany({
          where: {
            realmId: realm.id,
            status: "approved",
            reviewedAt: older ?? { not: null },
          },
          orderBy: { reviewedAt: "desc" },
          take,
          select: {
            id: true,
            reviewedAt: true,
            wikiPageTitle: true,
            country: { select: { name: true, slug: true } },
          },
        })
      : none,
    wants("embassy")
      ? db.realmEmbassy.findMany({
          where: {
            status: "active",
            openedAt: older ?? { not: null },
            // As in the overview's embassies panel, a partner back in draft is hidden (AT-6).
            OR: [
              { fromRealmId: realm.id, toRealm: PUBLISHED_PARTNER },
              { toRealmId: realm.id, fromRealm: PUBLISHED_PARTNER },
            ],
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
        })
      : none,
    wants("officer")
      ? db.realmOfficer.findMany({
          where: { realmId: realm.id, ...(older && { createdAt: older }) },
          orderBy: { createdAt: "desc" },
          take,
          select: { id: true, userId: true, title: true, createdAt: true },
        })
      : none,
    wants("activity") ? realmActivity(db, realm.id, take, older) : none,
  ]);
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
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const page = items.slice(0, limit);
  const more = items.length > limit;
  return { items: page, nextCursor: more ? page[page.length - 1]!.at.toISOString() : null };
}

/** The public game events of the realm's nations. */
async function realmActivity(
  db: OverviewDb,
  realmId: string,
  take: number,
  older: { lt: Date } | undefined
) {
  const countryIds = (await db.country.findMany({ where: { realmId }, select: { id: true } })).map(
    (c) => c.id
  );
  if (countryIds.length === 0) return [];
  return db.activityFeed.findMany({
    where: {
      countryId: { in: countryIds },
      visibility: "public",
      category: "game",
      ...(older && { createdAt: older }),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, title: true, createdAt: true },
  });
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
      thumbnail: true,
      emblemUrl: true,
      tags: true,
      factbookWikitext: true,
      factbookUpdatedAt: true,
      rulesWikitext: true,
      rulesUpdatedAt: true,
      communityLinks: true,
      settings: true,
      ownerId: true,
    },
  });

  const [officers, embassies, polls] = await Promise.all([
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
  return {
    realm: { id: staff.id, slug: staff.slug, name: staff.name, status: staff.status },
    powers,
    isFounder,
    /** Only the realm's own founder hands it over here; site admins transfer from /admin/realms. */
    canHandOver: staff.ownerId === actor.clerkUserId && staff.status !== "archived",
    archived: staff.status === "archived",
    appearance: can("appearance")
      ? {
          description: realm.description,
          bannerUrl: realm.bannerUrl,
          thumbnail: realm.thumbnail,
          emblemUrl: realm.emblemUrl,
          tags: realm.tags,
        }
      : null,
    factbook: can("appearance")
      ? { wikitext: realm.factbookWikitext ?? "", updatedAt: realm.factbookUpdatedAt }
      : null,
    rules: can("appearance")
      ? { wikitext: realm.rulesWikitext ?? "", updatedAt: realm.rulesUpdatedAt }
      : null,
    links: can("appearance") ? parseRealmLinks(realm.communityLinks) : null,
    inWorldDate: can("appearance") ? { value: realmInWorldDate(realm.settings) } : null,
    officers: officers.map((o) => ({
      userId: o.userId,
      title: o.title,
      powers: o.powers,
      appointedAt: o.createdAt,
      ...(people.get(o.userId) ?? { name: "Unknown user", handle: null, nation: null }),
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
    polls: polls.map(({ _count, ...p }) => ({ ...p, votes: _count.votes })),
  };
}
