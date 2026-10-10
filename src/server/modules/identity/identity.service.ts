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
  loadPersonalPersona,
  loadSportTeams,
  loadWikiContribs,
  loadWikiInfo,
} from "./identity.loaders";
import {
  buildHistoryEvents,
  filterByRealm,
  paginateEvents,
  primaryNationOf,
  toAwardHistory,
  toRealmMemberships,
} from "./identity.mappers";
import { loadRecruitedCount } from "./identity.invites";
import { loadRealmRoles } from "./identity.realm-roles";
import type { IdentityCountry } from "./identity.selects";
import {
  loadPassportHandle,
  loadVerifiedWikiName,
  passportHandleOf,
} from "./identity.passport-handle";
import { resolveIdentity, resolveIdentityNations, resolveUserIdentity } from "./identity.resolve";
import { loadLinkPrivacy, passportOnline } from "./identity.link-privacy";
import type {
  AuthoredArticle,
  AwardHistoryItem,
  IdentityForumActivity,
  IdentityForumGateway,
  IdentityHistoryPage,
  PassportCard,
  PassportCardNation,
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

/** One row per held nation, with the realm role and the primary nation marked. */
async function membershipsOf(
  identity: ResolvedIdentity,
  nations: IdentityCountry[]
): Promise<RealmMembership[]> {
  const { user } = identity;
  if (!user) return [];
  const roles = await loadRealmRoles(
    user.clerkUserId,
    nations.map((n) => n.realmId)
  );
  const primary = primaryNationOf(nations, user.countryId);
  return toRealmMemberships(nations, primary?.id ?? null, roles);
}

/** The primary nation and the realm and nation counts, from the holder's realm rows. */
function nationSummaryOf(realms: RealmMembership[]) {
  return {
    /** The primary nation's realm row (country, realm, realm role); null when no nation is held. */
    primaryNation: realms.find((r) => r.isPrimary) ?? null,
    /** Distinct realms the holder has a nation in. */
    realmCount: new Set(realms.map((r) => r.id)).size,
    nationCount: realms.length,
  };
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

/** Counters for a holder with forum content; null without any (or when they could not be read). */
function toForumStats(activity: IdentityForumActivity | null): PassportForumStats | null {
  if (!activity || activity.posts + activity.threads === 0) return null;
  return { messageCount: activity.posts, threadCount: activity.threads };
}

function passportAccount(
  identity: ResolvedIdentity,
  clerk: ClerkProfile,
  signature: string | null
) {
  const { user } = identity;
  return {
    userId: user?.id ?? null,
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
  return {
    // A user's wiki is "linked" only through a verified link (a legacy `User.wikiUsername` proves
    // nothing). A handle with no user is an external wiki name, linked if it exists.
    linked: identity.user ? Boolean(verifiedWikiName) : Boolean(wikiInfo?.exists),
    username: identity.wikiName,
    lorewards: sections.lorewards,
    awardHistory: sections.awardHistory,
  };
}

/** The wiki block when the holder turned wiki attribution off (identity.link-privacy.ts). */
const HIDDEN_WIKI = {
  linked: false,
  lorewards: null,
  awardHistory: [] as AwardHistoryItem[],
};

/** The old forum account (the kept `forumUserId` / `forumUsername` columns, or an imported name) and counters. */
function passportForum(
  identity: ResolvedIdentity,
  /** Counters; null when hidden, empty or unreadable. */
  stats: PassportForumStats | null
) {
  return {
    linked: Boolean(identity.forumUserId),
    username: identity.forumUsername,
    stats,
  };
}

/**
 * Tab 1 — identity essentials, primary nation, linked platforms, civic stature and the showcase
 * (achievements, ribbons, collection highlight, Lorewards). Sections the owner hid in their passport
 * settings are stripped here, for every viewer, before the payload leaves the server.
 */
export async function getPassport(query: IdentityQuery, forum: IdentityForumGateway) {
  const identity = await resolveIdentity(query.handle, query.viewerClerkId, forum);
  if (!identity) return null;
  const { user, wikiName } = identity;
  const [settings, { hideWiki }] = await Promise.all([
    loadPassportSettings(user?.id),
    loadLinkPrivacy(identity),
  ]);
  const shown = settings.visibility;
  // Lorewards are wiki attribution: a visitor sees none when the holder turned it off (as on the card).
  const showLore = shown.accolades && !hideWiki;

  const [
    wikiInfo,
    verifiedWikiName,
    loreStats,
    awards,
    forumActivity,
    persona,
    clerk,
    nations,
    vault,
    achievements,
    recruitedCount,
  ] = await Promise.all([
    // Only an external wiki name needs MediaWiki: a user's wiki is linked by their verified link.
    user ? null : loadWikiInfo(wikiName),
    loadVerifiedWikiName(user?.id),
    showLore ? loadLoreStats(wikiName) : null,
    showLore ? loadLoreAwards(wikiName) : [],
    shown.forumStats && user ? forum.getActivity(user.id).catch(() => null) : null,
    loadPersonalPersona(user),
    loadClerkProfile(identity),
    resolveIdentityNations(identity),
    shown.vaultCards ? resolvePassportVault(user?.id) : null,
    shown.achievements && user
      ? loadAchievementsShowcase(user.clerkUserId, settings.pinnedRibbonKeys)
      : null,
    loadRecruitedCount(user?.id),
  ]);
  const [loreRank, online, handle] = await Promise.all([
    loreStats ? loadLoreRank(loreStats.totalScore) : null,
    passportOnline(identity),
    user ? passportHandleOf(user, verifiedWikiName) : identity.handle,
  ]);

  const forumStats = toForumStats(forumActivity);
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

  const realms = await membershipsOf(identity, nations);
  return {
    ...nationSummaryOf(realms),
    /** Players who joined a realm by the holder's invite (approved invited claims). */
    recruitedCount,
    /**
     * The passport handle (`passportHandleOf`); share links use this, never the URL segment. An
     * identity with no user (an external wiki or forum name) keeps its segment.
     */
    handle,
    account: passportAccount(identity, clerk, settings.signature),
    /** Which sections the owner shows; a false section is absent from this payload. */
    privacy: shown,
    /** Shown online (heartbeat in the last two minutes and `showOnlineStatus` on). */
    online,
    wiki: hideWiki
      ? { ...HIDDEN_WIKI, username: null }
      : passportWiki(identity, wikiInfo, verifiedWikiName, sections),
    forum: passportForum(identity, sections.forumStats),
    /** Credits and collection; null when the owner hides them. */
    vault: sections.vault,
    showcase: {
      /** Unlocked achievements and their ribbons; null when the owner hides them. */
      achievements: sections.achievements,
    },
    /** The personal ThinkPages persona's bio (never a nation or character persona's). */
    thinkpages: { bio: persona?.bio ?? null },
  };
}

/** The card's primary nation line: flag, name, realm and realm role. */
function toCardNation(row: RealmMembership | null): PassportCardNation | null {
  if (!row) return null;
  const { country, name, slug, role } = row;
  return {
    name: country.name,
    slug: country.slug,
    flagUrl: country.flagUrl,
    realm: { name, slug },
    role,
  };
}

/** Lorewards score and rank, or null without loading them when hidden from this viewer. */
async function loadCardLorewards(identity: ResolvedIdentity, shown: boolean) {
  if (!shown) return null;
  const stats = await loadLoreStats(identity.wikiName);
  if (!stats) return null;
  return { score: stats.totalScore, rank: await loadLoreRank(stats.totalScore) };
}

/**
 * The slim public passport summary for page metadata and the OG image (callable from server
 * components directly). Database reads only: no MediaWiki, XenForo or Clerk call, no
 * write. Null when the handle names no user (external wiki or forum names have no card).
 * `{ preview: false }` when the holder turned link previews off.
 */
export async function getPassportCard(query: IdentityQuery): Promise<PassportCard | null> {
  const identity = await resolveUserIdentity(query.handle, query.viewerClerkId);
  const user = identity?.user;
  if (!identity || !user) return null;
  const [settings, { hideWiki }] = await Promise.all([
    loadPassportSettings(user.id),
    loadLinkPrivacy(identity),
  ]);
  if (!settings.visibility.linkPreview) return { preview: false };

  const [realms, persona, handle, lorewards] = await Promise.all([
    resolveIdentityNations(identity).then((nations) => membershipsOf(identity, nations)),
    loadPersonalPersona(user),
    loadPassportHandle(user),
    loadCardLorewards(identity, settings.visibility.accolades && !hideWiki),
  ]);
  const { primaryNation, realmCount, nationCount } = nationSummaryOf(realms);
  return {
    preview: true,
    handle,
    displayName: persona?.displayName || user.forumUsername || handle,
    avatarUrl: persona?.profileImageUrl || null,
    primaryNation: toCardNation(primaryNation),
    lorewards,
    realmCount,
    nationCount,
    joinedAt: user.createdAt,
    signature: settings.signature,
    bio: persona?.bio?.trim() || null,
  };
}

/** Tab 2 — every realm membership and claimed country; `realm` narrows to one realm. */
export async function getRealms(
  query: IdentityQuery & { realm?: string }
): Promise<RealmMembership[]> {
  const identity = await resolveIdentity(query.handle, query.viewerClerkId);
  if (!identity) return [];
  const memberships = await membershipsOf(identity, await resolveIdentityNations(identity));
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
  const [nations, settings, { hideWiki }] = await Promise.all([
    resolveIdentityNations(identity),
    loadPassportSettings(identity.user?.id),
    loadLinkPrivacy(identity),
  ]);
  const nationIds = nations.map((n) => n.id);
  const [wikiActivityFeed, articleRows, createdPages, conlangs, sportTeams, directives] =
    await Promise.all([
      hideWiki ? [] : loadWikiFeed(identity, settings.visibility),
      hideWiki ? [] : loadAuthoredArticleRows(identity),
      hideWiki ? [] : loadCreatedPages(identity.wikiName),
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
 * hides their activity history; without wiki items when wiki attribution is off for this viewer.
 */
export async function getHistory(
  query: IdentityQuery & { limit: number; cursor?: string | null }
): Promise<IdentityHistoryPage> {
  const identity = await resolveIdentity(query.handle, query.viewerClerkId);
  if (!identity) return { items: [], nextCursor: null };
  const [settings, { hideWiki }] = await Promise.all([
    loadPassportSettings(identity.user?.id),
    loadLinkPrivacy(identity),
  ]);
  if (!settings.visibility.historyStream) return { items: [], nextCursor: null };
  const nations = await resolveIdentityNations(identity);
  const nationIds = nations.map((n) => n.id);
  // Wiki attribution off hides wiki activity here exactly as it does on the Work tab.
  const [feed, directives, handle] = await Promise.all([
    hideWiki ? [] : loadWikiFeed(identity, settings.visibility),
    loadDirectives(nationIds),
    identity.user ? loadPassportHandle(identity.user) : identity.handle,
  ]);
  const events = buildHistoryEvents({
    identityId: identity.user?.id ?? identity.handle,
    handle,
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
