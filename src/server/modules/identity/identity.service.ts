/**
 * Identity service (plan 188): the four focused passport queries. Each resolves the handle itself
 * so a passport tab loads only its own data.
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
  RealmMembership,
  ResolvedIdentity,
  WikiActivityItem,
} from "./identity.types";
import { resolvePassportVault } from "./identity.vault";

export interface IdentityQuery {
  handle: string;
  viewerClerkId: string | null;
}

function membershipsOf(identity: ResolvedIdentity, nations: IdentityCountry[]): RealmMembership[] {
  const featuredIds = [identity.country?.id ?? nations[0]?.id, identity.user?.countryId].filter(
    (id): id is string => Boolean(id)
  );
  return toRealmMemberships(nations, featuredIds, identity.user?.role?.displayName ?? "Leader");
}

async function loadWikiFeed(identity: ResolvedIdentity) {
  const [contribs, revisions, comments, awards] = await Promise.all([
    loadWikiContribs(identity.wikiName),
    loadNativeRevisions(identity),
    loadDiscussionComments(identity.user),
    loadLoreAwards(identity.wikiName),
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

/** Tab 1 — identity essentials, featured realm, linked platforms and civic stature. */
export async function getPassport(query: IdentityQuery, forum: IdentityForumGateway) {
  const identity = await resolveIdentity(query.handle, query.viewerClerkId, forum);
  if (!identity) return null;
  const { user, wikiName, forumUserId } = identity;

  const [wikiInfo, verifiedWikiName, loreStats, awards, member, thinkpages, clerk, nations, vault] =
    await Promise.all([
      loadWikiInfo(wikiName),
      loadVerifiedWikiName(user?.id),
      loadLoreStats(wikiName),
      loadLoreAwards(wikiName),
      forumUserId ? forum.getMember(forumUserId).catch(() => null) : null,
      loadThinkpagesAccount(user),
      loadClerkProfile(identity),
      resolveIdentityNations(identity),
      resolvePassportVault(user?.id),
    ]);
  const loreRank = await loadLoreRank(loreStats?.totalScore);
  syncLinkedAccounts(identity, member);

  const realms = membershipsOf(identity, nations);
  return {
    handle: identity.handle,
    account: {
      userId: user?.id ?? null,
      roleName: user?.role?.displayName ?? user?.role?.name ?? null,
      isOwner: identity.isOwner,
      createdAt: (user?.createdAt ?? clerk?.createdAt)?.toISOString() ?? null,
      clerkUsername: clerk?.username ?? null,
      clerkDisplayName: clerk?.displayName ?? null,
      clerkImageUrl: clerk?.imageUrl ?? null,
    },
    featuredRealm: realms.find((r) => r.isFeatured) ?? realms[0] ?? null,
    realmCount: realms.length,
    wiki: {
      // A user's wiki is "linked" only through a verified link: `wikiName` may be a country name, which
      // proves nothing. A handle with no user and no country is an external wiki name, linked if it exists.
      linked: user ? Boolean(verifiedWikiName) : !identity.country && Boolean(wikiInfo?.exists),
      username: wikiName,
      // MediaWiki's own numbers, or null / empty when they could not be read (never estimated).
      editCount: hasLiveWikiData(wikiInfo) ? wikiInfo.editCount : null,
      groups: hasLiveWikiData(wikiInfo) ? wikiInfo.groups : [],
      lorewards: loreStats
        ? {
            totalScore: loreStats.totalScore,
            totalBytes: loreStats.totalBytes,
            rank: loreRank,
            dailyWins: loreStats.dailyWins,
            dailyRunnerUps: loreStats.dailyRunnerUps,
            weeklyWins: loreStats.weeklyWins,
            monthlyWins: loreStats.monthlyWins,
            currentStreak: loreStats.currentStreak,
            longestStreak: loreStats.longestStreak,
          }
        : null,
      awardHistory: toAwardHistory(awards, wikiName),
    },
    forum: {
      linked: Boolean(member || forumUserId),
      username: member?.username ?? identity.forumUsername,
      userTitle: member?.user_title ?? null,
      isStaff: Boolean(member?.is_staff),
      messageCount: member?.message_count ?? 0,
      reactionScore: member?.reaction_score ?? 0,
      trophyPoints: member?.trophy_points ?? 0,
      joinedDate: member?.register_date ?? null,
    },
    vault,
    thinkpages: {
      linked: Boolean(thinkpages),
      username: thinkpages?.username ?? null,
      bio: thinkpages?.bio ?? null,
      postCount: thinkpages?.postCount ?? 0,
      followerCount: thinkpages?.followerCount ?? 0,
    },
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

export interface IdentityWork {
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
    return { authoredArticles: [], conlangs: [], sportTeams: [], directives: [], wikiActivityFeed: [] };
  }
  const nationIds = (await resolveIdentityNations(identity)).map((n) => n.id);
  const [wikiActivityFeed, articleRows, createdPages, conlangs, sportTeams, directives] =
    await Promise.all([
      loadWikiFeed(identity),
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

/** Tab 4 — the cross-platform History stream, newest first, paged by event id. */
export async function getHistory(
  query: IdentityQuery & { limit: number; cursor?: string | null }
): Promise<IdentityHistoryPage> {
  const identity = await resolveIdentity(query.handle, query.viewerClerkId);
  if (!identity) return { items: [], nextCursor: null };
  const nations = await resolveIdentityNations(identity);
  const nationIds = nations.map((n) => n.id);
  const [feed, directives] = await Promise.all([
    loadWikiFeed(identity),
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
