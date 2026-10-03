/**
 * Identity service (plan 188): the four focused passport queries, plus ribbons and the owner's
 * passport settings. Each query resolves the handle itself so a passport tab loads only its own
 * data, and each honours the owner's privacy settings (identity.privacy.ts).
 */
import { db } from "~/server/db";
import { buildAuthoredArticles, buildWikiActivityFeed } from "./identity.feed";
import {
  loadAuthoredArticleRows,
  loadClerkProfile,
  loadConlangs,
  loadCreatedPages,
  loadDirectives,
  loadDiscussionComments,
  loadLoreAwards,
  loadLoreRank,
  loadLoreStats,
  loadNativeRevisions,
  loadSportTeams,
  loadThinkpagesAccount,
  loadWikiContribs,
  loadWikiInfo,
} from "./identity.loaders";
import {
  buildHistoryEvents,
  filterByRealm,
  paginateEvents,
  toAwardHistory,
  toRealmMemberships,
} from "./identity.mappers";
import type { IdentityCountry } from "./identity.selects";
import { resolveIdentity, resolveIdentityNations } from "./identity.resolve";
import type {
  AuthoredArticle,
  IdentityForumGateway,
  IdentityForumMember,
  IdentityHistoryPage,
  PassportForumStats,
  PassportLorewards,
  RealmMembership,
  ResolvedIdentity,
  WikiActivityItem,
} from "./identity.types";
import { resolvePassportVault } from "./identity.vault";
import {
  loadPassportSettings,
  MAX_PINNED_RIBBONS,
  redactPassportSections,
  savePassportSettings,
  type PassportSettingsUpdate,
  type PassportVisibility,
} from "./identity.privacy";
import {
  COUNTRY_RACK_SIZE,
  loadAchievementsShowcase,
  loadUnlocks,
  toRibbons,
  validPinnedKeys,
  type PassportRibbon,
} from "./identity.showcase";

interface IdentityQuery {
  handle: string;
  viewerClerkId: string | null;
}

function membershipsOf(identity: ResolvedIdentity, nations: IdentityCountry[]): RealmMembership[] {
  const featuredIds = [identity.country?.id ?? nations[0]?.id, identity.user?.countryId].filter(
    (id): id is string => Boolean(id)
  );
  return toRealmMemberships(nations, featuredIds, identity.user?.role?.displayName ?? "Leader");
}

/** The wiki activity feed; Lorewards laurels are left out when the owner hides their accolades. */
async function loadWikiFeed(identity: ResolvedIdentity, visibility: PassportVisibility) {
  const [contribs, revisions, comments, awards] = await Promise.all([
    loadWikiContribs(identity.wikiName),
    loadNativeRevisions(identity),
    loadDiscussionComments(identity.user),
    visibility.accolades ? loadLoreAwards(identity.wikiName) : [],
  ]);
  return buildWikiActivityFeed(revisions, contribs, comments, awards, identity.wikiName);
}

type WikiInfo = Awaited<ReturnType<typeof loadWikiInfo>>;

/** A real MediaWiki user id is >= 1; the bridge reports 0 when it has no live MediaWiki data. */
function hasLiveWikiData(info: WikiInfo): info is NonNullable<WikiInfo> {
  return Boolean(info?.exists && info.userId > 0);
}

/**
 * Keep the user's linked forum ids current with what the passport just resolved.
 *
 * Wiki identity is deliberately NOT synced here: `getPassport` is a public read path and the wiki name it
 * resolves can be derived from a country name. Only a verified `WikiAccountLink` (identity.wiki-links.ts)
 * may set the legacy `User.wikiUsername` / `wikiUserId` columns.
 */
function syncLinkedAccounts(identity: ResolvedIdentity, member: IdentityForumMember | null): void {
  const { user } = identity;
  if (!user || !member || user.forumUserId === member.user_id) return;
  db.user
    .update({
      where: { id: user.id },
      data: {
        forumUserId: member.user_id,
        forumUsername: member.username,
        lastForumSync: new Date(),
      },
    })
    .catch(() => null);
}

/** The user's verified ixwiki link, or null. Only this proves the passport's wiki account is theirs. */
async function loadVerifiedWikiName(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const link = await db.wikiAccountLink
    .findFirst({
      where: { userId, source: "ixwiki", verifiedAt: { not: null } },
      select: { username: true },
    })
    .catch(() => null);
  return link?.username ?? null;
}

type LoreStats = Awaited<ReturnType<typeof loadLoreStats>>;
type ClerkProfile = Awaited<ReturnType<typeof loadClerkProfile>>;

function toLorewards(stats: LoreStats, rank: number | null): PassportLorewards | null {
  if (!stats) return null;
  const { totalScore, totalBytes, dailyWins, dailyRunnerUps, weeklyWins, monthlyWins } = stats;
  const { currentStreak, longestStreak } = stats;
  return {
    totalScore,
    totalBytes,
    rank,
    dailyWins,
    dailyRunnerUps,
    weeklyWins,
    monthlyWins,
    currentStreak,
    longestStreak,
  };
}

function toForumStats(member: IdentityForumMember | null): PassportForumStats | null {
  if (!member) return null;
  return {
    userTitle: member.user_title ?? null,
    messageCount: member.message_count ?? 0,
    reactionScore: member.reaction_score ?? 0,
    trophyPoints: member.trophy_points ?? 0,
  };
}

function passportAccount(
  identity: ResolvedIdentity,
  clerk: ClerkProfile,
  signature: string | null
) {
  const { user } = identity;
  return {
    userId: user?.id ?? null,
    roleName: user?.role?.displayName ?? user?.role?.name ?? null,
    isOwner: identity.isOwner,
    createdAt: (user?.createdAt ?? clerk?.createdAt)?.toISOString() ?? null,
    clerkUsername: clerk?.username ?? null,
    clerkDisplayName: clerk?.displayName ?? null,
    clerkImageUrl: clerk?.imageUrl ?? null,
    signature,
  };
}

function passportWiki(
  identity: ResolvedIdentity,
  wikiInfo: WikiInfo,
  verifiedWikiName: string | null,
  sections: Pick<ReturnType<typeof redactPassportSections>, "lorewards" | "awardHistory">
) {
  const live = hasLiveWikiData(wikiInfo);
  return {
    // A user's wiki is "linked" only through a verified link: `wikiName` may be a country name, which
    // proves nothing. A handle with no user and no country is an external wiki name, linked if it exists.
    linked: identity.user
      ? Boolean(verifiedWikiName)
      : !identity.country && Boolean(wikiInfo?.exists),
    username: identity.wikiName,
    // MediaWiki's own numbers, or null / empty when they could not be read (never estimated).
    editCount: live ? wikiInfo.editCount : null,
    groups: live ? wikiInfo.groups : [],
    lorewards: sections.lorewards,
    awardHistory: sections.awardHistory,
  };
}

function passportForum(
  identity: ResolvedIdentity,
  member: IdentityForumMember | null,
  /** Counters; null when hidden or when the forum member could not be read. */
  stats: PassportForumStats | null
) {
  return {
    linked: Boolean(member || identity.forumUserId),
    username: member?.username ?? identity.forumUsername,
    isStaff: Boolean(member?.is_staff),
    joinedDate: member?.register_date ?? null,
    stats,
  };
}

function passportThinkpages(account: Awaited<ReturnType<typeof loadThinkpagesAccount>>) {
  return {
    linked: Boolean(account),
    username: account?.username ?? null,
    bio: account?.bio ?? null,
    postCount: account?.postCount ?? 0,
    followerCount: account?.followerCount ?? 0,
  };
}

/**
 * Tab 1 — identity essentials, featured realm, linked platforms, civic stature and the showcase
 * (achievements, ribbons, collection highlight, Lorewards). Sections the owner hid in their passport
 * settings are stripped here, for every viewer, before the payload leaves the server.
 */
export async function getPassport(query: IdentityQuery, forum: IdentityForumGateway) {
  const identity = await resolveIdentity(query.handle, query.viewerClerkId, forum);
  if (!identity) return null;
  const { user, wikiName, forumUserId } = identity;
  const settings = await loadPassportSettings(user?.id);
  const shown = settings.visibility;

  const [
    wikiInfo,
    verifiedWikiName,
    loreStats,
    awards,
    member,
    thinkpages,
    clerk,
    nations,
    vault,
    achievements,
  ] = await Promise.all([
    loadWikiInfo(wikiName),
    loadVerifiedWikiName(user?.id),
    shown.accolades ? loadLoreStats(wikiName) : null,
    shown.accolades ? loadLoreAwards(wikiName) : [],
    forumUserId ? forum.getMember(forumUserId).catch(() => null) : null,
    loadThinkpagesAccount(user),
    loadClerkProfile(identity),
    resolveIdentityNations(identity),
    shown.vaultCards ? resolvePassportVault(user?.id) : null,
    shown.achievements && user
      ? loadAchievementsShowcase(user.clerkUserId, settings.pinnedRibbonKeys)
      : null,
  ]);
  const loreRank = loreStats ? await loadLoreRank(loreStats.totalScore) : null;
  syncLinkedAccounts(identity, member);

  const forumStats = toForumStats(member);
  // Loaders above already skip most hidden sections; the redaction is the single enforcement point.
  const sections = redactPassportSections(
    {
      lorewards: toLorewards(loreStats, loreRank),
      awardHistory: toAwardHistory(awards, wikiName),
      forumStats,
      vault,
      achievements,
    },
    shown
  );

  const realms = membershipsOf(identity, nations);
  return {
    handle: identity.handle,
    account: passportAccount(identity, clerk, settings.signature),
    /** Which sections the owner shows; a false section is absent from this payload. */
    privacy: shown,
    featuredRealm: realms.find((r) => r.isFeatured) ?? realms[0] ?? null,
    realmCount: realms.length,
    wiki: passportWiki(identity, wikiInfo, verifiedWikiName, sections),
    forum: passportForum(identity, member, sections.forumStats),
    /** Credits and collection; null when the owner hides them. */
    vault: sections.vault,
    showcase: {
      /** Unlocked achievements and their ribbons; null when the owner hides them. */
      achievements: sections.achievements,
    },
    thinkpages: passportThinkpages(thinkpages),
    discord: {
      linked: Boolean(user?.discordUserId),
      username: user?.discordUsername ?? null,
    },
  };
}

/** Tab 2 — every realm membership and claimed country; `realm` narrows to one realm. */
export async function getRealms(
  query: IdentityQuery & { realm?: string }
): Promise<RealmMembership[]> {
  const identity = await resolveIdentity(query.handle, query.viewerClerkId);
  if (!identity) return [];
  const memberships = membershipsOf(identity, await resolveIdentityNations(identity));
  return query.realm ? filterByRealm(memberships, query.realm) : memberships;
}

interface IdentityWork {
  authoredArticles: AuthoredArticle[];
  conlangs: Awaited<ReturnType<typeof loadConlangs>>;
  sportTeams: Awaited<ReturnType<typeof loadSportTeams>>;
  directives: Awaited<ReturnType<typeof loadDirectives>>;
  wikiActivityFeed: WikiActivityItem[];
}

/** Tab 3 — creations: WikiOS pages and activity, Onoma packs, MyLeague clubs, directives. */
export async function getWork(query: IdentityQuery): Promise<IdentityWork> {
  const identity = await resolveIdentity(query.handle, query.viewerClerkId);
  if (!identity) {
    return {
      authoredArticles: [],
      conlangs: [],
      sportTeams: [],
      directives: [],
      wikiActivityFeed: [],
    };
  }
  const [nations, settings] = await Promise.all([
    resolveIdentityNations(identity),
    loadPassportSettings(identity.user?.id),
  ]);
  const nationIds = nations.map((n) => n.id);
  const [wikiActivityFeed, articleRows, createdPages, conlangs, sportTeams, directives] =
    await Promise.all([
      loadWikiFeed(identity, settings.visibility),
      loadAuthoredArticleRows(identity),
      loadCreatedPages(identity.wikiName),
      loadConlangs(identity),
      loadSportTeams(nationIds),
      loadDirectives(nationIds),
    ]);
  return {
    authoredArticles: buildAuthoredArticles(articleRows, createdPages),
    conlangs,
    sportTeams,
    directives,
    wikiActivityFeed,
  };
}

/**
 * Tab 4 — the cross-platform History stream, newest first, paged by event id. Empty when the owner
 * hides their activity history.
 */
export async function getHistory(
  query: IdentityQuery & { limit: number; cursor?: string | null }
): Promise<IdentityHistoryPage> {
  const identity = await resolveIdentity(query.handle, query.viewerClerkId);
  if (!identity) return { items: [], nextCursor: null };
  const settings = await loadPassportSettings(identity.user?.id);
  if (!settings.visibility.historyStream) return { items: [], nextCursor: null };
  const nations = await resolveIdentityNations(identity);
  const nationIds = nations.map((n) => n.id);
  const [feed, directives] = await Promise.all([
    loadWikiFeed(identity, settings.visibility),
    loadDirectives(nationIds),
  ]);
  const events = buildHistoryEvents({
    identityId: identity.user?.id ?? identity.handle,
    handle: identity.handle,
    feed,
    directives,
    countryNames: new Map(nations.map((n) => [n.id, n.name])),
    joinedAt: identity.user?.createdAt ?? null,
  });
  return paginateEvents(events, query.limit, query.cursor);
}

interface RibbonRack {
  ribbons: PassportRibbon[];
  /** Every ribbon the user holds, of which `ribbons` may be the first few. */
  total: number;
}

const EMPTY_RACK: RibbonRack = { ribbons: [], total: 0 };

/** Ribbons of a user (by Clerk id), honouring their privacy settings; `limit` keeps the first few. */
async function rackOf(
  user: { id: string; clerkUserId: string } | null,
  limit?: number
): Promise<RibbonRack> {
  if (!user) return EMPTY_RACK;
  const settings = await loadPassportSettings(user.id);
  if (!settings.visibility.achievements) return EMPTY_RACK;
  const ribbons = toRibbons(await loadUnlocks(user.clerkUserId), settings.pinnedRibbonKeys);
  return {
    ribbons: limit === undefined ? ribbons : ribbons.slice(0, limit),
    total: ribbons.length,
  };
}

/** Every ribbon a passport holder earned: pinned first, then rarest, then newest. */
export async function getRibbons(query: IdentityQuery): Promise<RibbonRack> {
  const identity = await resolveIdentity(query.handle, query.viewerClerkId);
  return rackOf(identity?.user ?? null);
}

/**
 * The country-page rack: the owning user's top ribbons. Empty when the country has no active owner,
 * the owner has no achievements, or the owner hides them.
 */
export async function getCountryRibbons(countrySlug: string): Promise<RibbonRack> {
  const country = await db.country.findUnique({
    where: { slug: countrySlug },
    select: { owner: { select: { id: true, clerkUserId: true, isActive: true } } },
  });
  const owner = country?.owner?.isActive ? country.owner : null;
  return rackOf(owner, COUNTRY_RACK_SIZE);
}

/** The signed-in owner's passport settings, with every ribbon they can pin. */
export async function getOwnPassportSettings(user: { id: string; clerkUserId: string }) {
  const [settings, unlocks] = await Promise.all([
    loadPassportSettings(user.id),
    loadUnlocks(user.clerkUserId),
  ]);
  return { ...settings, ribbons: toRibbons(unlocks, settings.pinnedRibbonKeys) };
}

/** Save the owner's settings. Pins are kept only for achievements the owner has unlocked. */
export async function updateOwnPassportSettings(
  user: { id: string; clerkUserId: string },
  update: PassportSettingsUpdate
) {
  const pinnedRibbonKeys =
    update.pinnedRibbonKeys === undefined
      ? undefined
      : validPinnedKeys(
          update.pinnedRibbonKeys,
          (await loadUnlocks(user.clerkUserId)).map((u) => u.achievementId),
          MAX_PINNED_RIBBONS
        );
  return savePassportSettings(user.id, { ...update, pinnedRibbonKeys });
}
