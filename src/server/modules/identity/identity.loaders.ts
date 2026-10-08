/**
 * Data loaders for the identity module. Each loader degrades to an empty value on failure so one
 * unavailable system (MediaWiki, Clerk, a table) never blanks the whole passport.
 */
import { db } from "~/server/db";
import { PERSONAL_ACCOUNT_TYPE } from "~/server/shared/thinkpages-personal-account";
import { archivedTitlesAmong } from "~/lib/wiki-os/core/archived-titles";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import type {
  AuthoredArticleRow,
  CreatedPageRow,
  DiscussionCommentRow,
  LoreAwardRow,
  NativeRevisionRow,
  WikiContribRow,
} from "./identity.feed";
import type { DirectiveRow } from "./identity.mappers";
import type { IdentityUser } from "./identity.selects";
import type { ResolvedIdentity } from "./identity.types";

const insensitive = (value: string) => ({ equals: value, mode: "insensitive" as const });

async function orEmpty<T>(work: Promise<T[]>): Promise<T[]> {
  return work.catch(() => []);
}

async function orNull<T>(work: Promise<T | null>): Promise<T | null> {
  return work.catch(() => null);
}

/** The handle itself also counts as a name for loose wiki matching, except the `me` alias. */
function looseName(identity: ResolvedIdentity): string | null {
  return identity.handle && identity.handle !== "me" ? identity.handle : null;
}

function wikiBridge() {
  return import("~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers");
}

export async function loadWikiInfo(wikiName: string | null) {
  if (!wikiName) return null;
  const { getUserInfo } = await wikiBridge();
  return orNull(getUserInfo(wikiName));
}

export async function loadWikiContribs(wikiName: string | null): Promise<WikiContribRow[]> {
  if (!wikiName) return [];
  const { getUserContribs } = await wikiBridge();
  return orEmpty(getUserContribs(wikiName, 100));
}

export async function loadCreatedPages(wikiName: string | null): Promise<CreatedPageRow[]> {
  if (!wikiName) return [];
  const { getUserCreatedPages } = await wikiBridge();
  return orEmpty(getUserCreatedPages(wikiName, 100));
}

export async function loadLoreAwards(wikiName: string | null): Promise<LoreAwardRow[]> {
  if (!wikiName) return [];
  return orEmpty(
    db.lorewardEntry.findMany({
      where: {
        OR: [{ winnerUser: insensitive(wikiName) }, { runnerUpUser: insensitive(wikiName) }],
        status: "approved",
      },
      orderBy: { date: "desc" },
      take: 30,
    })
  );
}

export async function loadLoreStats(wikiName: string | null) {
  if (!wikiName) return null;
  return orNull(db.lorewardUserStats.findFirst({ where: { username: insensitive(wikiName) } }));
}

/** 1-based global Lorewards rank, or null when unranked. */
export async function loadLoreRank(totalScore: number | null | undefined): Promise<number | null> {
  if (!totalScore || totalScore <= 0) return null;
  try {
    return (await db.lorewardUserStats.count({ where: { totalScore: { gt: totalScore } } })) + 1;
  } catch (err) {
    console.warn("[Passport] Lore rank lookup failed:", err);
    return null;
  }
}

export async function loadNativeRevisions(
  identity: ResolvedIdentity
): Promise<NativeRevisionRow[]> {
  const names = [identity.wikiName, looseName(identity)];
  return orEmpty(
    db.wikiRevision.findMany({
      where: {
        OR: [
          ...(identity.user ? [{ authorId: identity.user.id }] : []),
          ...names.flatMap((name) => (name ? [{ author: insensitive(name) }] : [])),
        ],
        // A deleted page is not part of anyone's public work.
        article: { status: "PUBLISHED" },
      },
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        summary: true,
        minor: true,
        parked: true,
        createdAt: true,
        article: { select: { title: true, slug: true } },
      },
    })
  );
}

export async function loadDiscussionComments(
  user: IdentityUser | null
): Promise<DiscussionCommentRow[]> {
  if (!user) return [];
  return orEmpty(
    (async () => {
      const comments = await db.wikiDiscussionComment.findMany({
        where: { OR: [{ userId: user.id }, { userId: user.clerkUserId }] },
        take: 30,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          thread: { select: { title: true, articleTitle: true } },
        },
      });
      // A thread only names its page, so the deleted pages' comments are dropped after the read.
      const hidden = await archivedTitlesAmong(comments.map((c) => c.thread.articleTitle));
      return comments.filter(
        (comment) => !hidden.has(canonicalizeTitle(comment.thread.articleTitle)?.title ?? "")
      );
    })()
  );
}

/** Native articles the user wrote or last edited, plus titles/slugs matching their names. */
export async function loadAuthoredArticleRows(
  identity: ResolvedIdentity
): Promise<AuthoredArticleRow[]> {
  const names = [identity.wikiName, looseName(identity)];
  return orEmpty(
    db.wikiArticle.findMany({
      where: {
        // A deleted page is not part of anyone's public work.
        status: "PUBLISHED",
        OR: [
          ...(identity.user
            ? [{ authorId: identity.user.id }, { lastEditorId: identity.user.id }]
            : []),
          ...names.flatMap((name) =>
            name
              ? [
                  { title: { contains: name, mode: "insensitive" as const } },
                  { slug: { contains: name.toLowerCase() } },
                ]
              : []
          ),
        ],
      },
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        updatedAt: true,
        createdAt: true,
      },
    })
  );
}

/** Onoma language packs. Visitors see published packs only; the owner also sees drafts. */
export async function loadConlangs(identity: ResolvedIdentity) {
  if (!identity.user) return [];
  return orEmpty(
    db.languagePack.findMany({
      where: {
        userId: identity.user.id,
        ...(identity.isOwner ? {} : { visibility: "public" }),
      },
      take: 20,
      select: { id: true, name: true, description: true, culturalFamily: true, slug: true },
    })
  );
}

export async function loadSportTeams(nationIds: string[]) {
  if (nationIds.length === 0) return [];
  return orEmpty(
    db.sportTeam.findMany({
      where: { nationId: { in: nationIds } },
      take: 20,
      select: { id: true, name: true, shortName: true, city: true, logo: true },
    })
  );
}

export async function loadDirectives(
  nationIds: string[]
): Promise<Array<DirectiveRow & { summary: string | null }>> {
  if (nationIds.length === 0) return [];
  return orEmpty(
    db.intent.findMany({
      where: { countryId: { in: nationIds } },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        goal: true,
        tier: true,
        category: true,
        status: true,
        summary: true,
        countryId: true,
        createdAt: true,
      },
    })
  );
}

export async function loadThinkpagesAccount(user: IdentityUser | null) {
  if (!user) return null;
  return orNull(
    db.thinkpagesAccount.findFirst({
      where: { clerkUserId: user.clerkUserId, isActive: true },
      select: { username: true, bio: true, postCount: true, followerCount: true },
    })
  );
}

/**
 * The user's personal ThinkPages persona ("you", not a nation or a character): the passport card's
 * stored name, avatar and bio, read without a Clerk call.
 */
export async function loadPersonalPersona(
  user: Pick<IdentityUser, "clerkUserId"> | null
) {
  if (!user) return null;
  return orNull(
    db.thinkpagesAccount.findFirst({
      where: { clerkUserId: user.clerkUserId, isActive: true, accountType: PERSONAL_ACCOUNT_TYPE },
      select: { displayName: true, profileImageUrl: true, bio: true },
    })
  );
}

interface ClerkProfile {
  createdAt: Date;
  username: string | null;
  displayName: string | null;
  imageUrl: string;
}

/** The identity's Clerk account: by linked id, a `user_…` handle, or a Clerk username. */
export async function loadClerkProfile(identity: ResolvedIdentity): Promise<ClerkProfile | null> {
  const { handle, strippedHandle, user } = identity;
  const clerkId = user?.clerkUserId ?? (handle.startsWith("user_") ? handle : null);
  if (!clerkId && !handle) return null;
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const found = clerkId
      ? await client.users.getUser(clerkId).catch(() => null)
      : ((await client.users
          .getUserList({ username: [handle, strippedHandle] })
          .catch(() => null))?.data[0] ?? null);
    if (!found) return null;
    return {
      createdAt: new Date(found.createdAt),
      username: found.username,
      displayName:
        [found.firstName, found.lastName].filter(Boolean).join(" ") || found.username || null,
      imageUrl: found.imageUrl,
    };
  } catch {
    return null;
  }
}
