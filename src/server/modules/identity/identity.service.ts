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
  loadThinkpagesAccount,
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
import { needsCanonicalRedirect } from "./identity.handle";
import { resolveIdentity, resolveIdentityNations, resolveUserIdentity } from "./identity.resolve";
import { loadLinkPrivacy, passportOnline } from "./identity.link-privacy";
import type {
  AuthoredArticle,
  AwardHistoryItem,
  IdentityForumGateway,
  IdentityForumMember,
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

/** A real MediaWiki user id is >= 1; the bridge reports 0 when it has no live MediaWiki data. */
function hasLiveWikiData(info: WikiInfo): info is NonNullable<WikiInfo> {
  return Boolean(info?.exists && info.userId > 0);
}

/**
 * Refresh the signed-in user's own linked forum name from XenForo. Called only from their own
 * `ixnayid.getStatus`, never from a public read. Never throws: a forum or write failure is ignored.
 *
 * Wiki identity is deliberately NOT synced here: only a verified `WikiAccountLink`
 * (identity.wiki-links.ts) may set the legacy `User.wikiUsername` / `wikiUserId` columns.
 */
export async function syncOwnForumAccount(
  user: { id: string; forumUserId: number | null; forumUsername: string | null },
  forum: Pick<IdentityForumGateway, "getMember">
): Promise<void> {
  if (!user.forumUserId) return;
  try {
    const member = await forum.getMember(user.forumUserId);
    if (!member) return;
    if (member.user_id === user.forumUserId && member.username === user.forumUsername) return;
    await db.user.update({
      where: { id: user.id },
      data: {
        forumUserId: member.user_id,
        forumUsername: member.username,
        lastForumSync: new Date(),
      },
    });
  } catch {
    // Best effort: the stored name stays as it was.
  }
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

/**
 * The handle every display and share surface uses, never the URL segment: the stored handle, else
 * the computed one (verified wiki name, forum name, the segment unless it is `me`, Clerk id). An
 * identity with no user (an external wiki or forum name) keeps its segment.
 */
function canonicalHandleOf(identity: ResolvedIdentity, verifiedWikiName: string | null): string {
  const { user, handle } = identity;
  if (!user) return handle;
  if (user.handle) return user.handle;
  const segment = handle.toLowerCase() === "me" ? null : handle;
  return verifiedWikiName || user.forumUsername || segment || user.clerkUserId;
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

/** The wiki block when the holder turned wiki attribution off (identity.link-privacy.ts). */
const HIDDEN_WIKI = {
  linked: false,
  editCount: null,
  groups: [] as string[],
  lorewards: null,
  awardHistory: [] as AwardHistoryItem[],
};

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
 * Tab 1 — identity essentials, primary nation, linked platforms, civic stature and the showcase
 * (achievements, ribbons, collection highlight, Lorewards). Sections the owner hid in their passport
 * settings are stripped here, for every viewer, before the payload leaves the server.
 */
export async function getPassport(query: IdentityQuery, forum: IdentityForumGateway) {
  const identity = await resolveIdentity(query.handle, query.viewerClerkId, forum);
  if (!identity) return null;
  const { user, wikiName, forumUserId } = identity;
  const [settings, { hideDiscord, hideWiki }] = await Promise.all([
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
    member,
    thinkpages,
    clerk,
    nations,
    vault,
    achievements,
    recruitedCount,
  ] = await Promise.all([
    loadWikiInfo(wikiName),
    loadVerifiedWikiName(user?.id),
    showLore ? loadLoreStats(wikiName) : null,
    showLore ? loadLoreAwards(wikiName) : [],
    forumUserId ? forum.getMember(forumUserId).catch(() => null) : null,
    loadThinkpagesAccount(user),
    loadClerkProfile(identity),
    resolveIdentityNations(identity),
    shown.vaultCards ? resolvePassportVault(user?.id) : null,
    shown.achievements && user
      ? loadAchievementsShowcase(user.clerkUserId, settings.pinnedRibbonKeys)
      : null,
    loadRecruitedCount(user?.id),
  ]);
  const [loreRank, online] = await Promise.all([
    loreStats ? loadLoreRank(loreStats.totalScore) : null,
    passportOnline(identity),
  ]);

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

  const realms = await membershipsOf(identity, nations);
  return {
    ...nationSummaryOf(realms),
    /** Players who joined a realm by the holder's invite (approved invited claims). */
    recruitedCount,
    /** The canonical handle (stored, else computed); share links use this, never the URL segment. */
    handle: canonicalHandleOf(identity, verifiedWikiName),
    /** True when the URL segment is a legacy name and the page should 301 to `/@{handle}`. */
    canonicalRedirect: needsCanonicalRedirect(identity.handle, user?.handle ?? null),
    account: passportAccount(identity, clerk, settings.signature),
    /** Which sections the owner shows; a false section is absent from this payload. */
    privacy: shown,
    /** Shown online (heartbeat in the last two minutes and `showOnlineStatus` on). */
    online,
    wiki: hideWiki
      ? { ...HIDDEN_WIKI, username: null }
      : passportWiki(identity, wikiInfo, verifiedWikiName, sections),
    forum: passportForum(identity, member, sections.forumStats),
    /** Credits and collection; null when the owner hides them. */
    vault: sections.vault,
    showcase: {
      /** Unlocked achievements and their ribbons; null when the owner hides them. */
      achievements: sections.achievements,
    },
    thinkpages: passportThinkpages(thinkpages),
    discord: hideDiscord
      ? { linked: false, username: null }
      : { linked: Boolean(user?.discordUserId), username: user?.discordUsername ?? null },
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
 * The slim public passport summary for the front face, page metadata and the OG image (callable
 * from server components directly). Database reads only: no MediaWiki, XenForo or Clerk call, no
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

  const [realms, persona, verifiedWikiName, lorewards] = await Promise.all([
    resolveIdentityNations(identity).then((nations) => membershipsOf(identity, nations)),
    loadPersonalPersona(user),
    user.handle ? null : loadVerifiedWikiName(user.id),
    loadCardLorewards(identity, settings.visibility.accolades && !hideWiki),
  ]);
  const handle = canonicalHandleOf(identity, verifiedWikiName);
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
  const [feed, directives] = await Promise.all([
    hideWiki ? [] : loadWikiFeed(identity, settings.visibility),
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
