/**
 * The account export (Privacy 5.1 "Export"; Settings → Privacy & security → Export your data).
 *
 * One JSON object of what the user put in and what identifies them: the account (with the Clerk
 * email and username, since email is not stored here), linked accounts, nations, personas and all
 * their ThinkPages posts, forum threads and posts, the ThinkShare and ThinkTank messages they sent,
 * Onoma work, cards, trades, realm claims, achievements and preferences.
 *
 * Never in it: link tokens and verification codes, other users' messages, and other users' ids
 * (a trade names the user's side, not the other party; a realm claim leaves out its reviewer and
 * inviter; a card copy leaves out who signed it). Read by `users.exportUserData`.
 */
import type { PrismaClient } from "@prisma/client";

export interface ClerkIdentity {
  email: string | null;
  username: string | null;
}

export type ReadClerkIdentity = (clerkUserId: string) => Promise<ClerkIdentity>;

/** The primary email and username Clerk holds; nulls when Clerk cannot be reached. */
export async function clerkIdentity(clerkUserId: string): Promise<ClerkIdentity> {
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const user = await (await clerkClient()).users.getUser(clerkUserId);
    return { email: user.primaryEmailAddress?.emailAddress ?? null, username: user.username };
  } catch {
    return { email: null, username: null };
  }
}

const ACCOUNT_SELECT = {
  id: true,
  countryId: true,
  handle: true,
  handleChangedAt: true,
  membershipTier: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  lastSeenAt: true,
  deletionRequestedAt: true,
  discordUserId: true,
  discordUsername: true,
  lastDiscordSync: true,
  forumUserId: true,
  forumUsername: true,
  lastForumSync: true,
  role: { select: { name: true } },
} as const;

type AccountRow = NonNullable<Awaited<ReturnType<typeof loadAccountRow>>>;

function loadAccountRow(db: PrismaClient, clerkUserId: string) {
  return db.user.findUnique({ where: { clerkUserId }, select: ACCOUNT_SELECT });
}

function accountSection(user: AccountRow | null, clerk: ClerkIdentity) {
  if (!user) return { ...clerk, handle: null };
  return {
    ...clerk,
    handle: user.handle,
    handleChangedAt: user.handleChangedAt,
    role: user.role?.name ?? null,
    membershipTier: user.membershipTier,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSeenAt: user.lastSeenAt,
    deletionRequestedAt: user.deletionRequestedAt,
  };
}

async function linkedAccountsSection(db: PrismaClient, user: AccountRow) {
  const [wikis, nationStates, wikiNames] = await Promise.all([
    db.wikiAccountLink.findMany({
      where: { userId: user.id },
      select: { source: true, username: true, verifiedAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.nSVerification.findMany({
      where: { userId: user.id },
      select: { nationName: true, verified: true, verifiedAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    // Every old wiki name the user asked for or holds, whatever became of the claim
    db.wikiNameClaim.findMany({
      where: { userId: user.id },
      select: { source: true, name: true, status: true, visible: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return {
    discord: {
      userId: user.discordUserId,
      username: user.discordUsername,
      lastSync: user.lastDiscordSync,
    },
    forum: {
      userId: user.forumUserId,
      username: user.forumUsername,
      lastSync: user.lastForumSync,
    },
    wikis,
    nationStates,
    wikiNames,
  };
}

function nationsSection(db: PrismaClient, user: AccountRow) {
  const mine = user.countryId ? [{ id: user.countryId }] : [];
  return db.country.findMany({
    where: { OR: [{ ownerUserId: user.id }, ...mine] },
    select: {
      id: true,
      name: true,
      slug: true,
      leader: true,
      governmentType: true,
      economicTier: true,
      populationTier: true,
      currentPopulation: true,
      currentGdpPerCapita: true,
      hideDiplomaticOps: true,
      hideStratcommIntel: true,
      createdAt: true,
      realm: { select: { name: true, slug: true } },
    },
  });
}

async function thinkpagesSection(db: PrismaClient, clerkUserId: string) {
  const personas = await db.thinkpagesAccount.findMany({
    where: { clerkUserId },
    select: {
      id: true,
      accountType: true,
      username: true,
      displayName: true,
      firstName: true,
      lastName: true,
      bio: true,
      profileImageUrl: true,
      verified: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const posts = personas.length
    ? await db.thinkpagesPost.findMany({
        where: { accountId: { in: personas.map((p) => p.id) } },
        select: {
          id: true,
          accountId: true,
          content: true,
          contentWarning: true,
          hashtags: true,
          visualizations: true,
          postType: true,
          parentPostId: true,
          repostOfId: true,
          visibility: true,
          ixTimeTimestamp: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];
  return { personas, posts };
}

async function forumSection(db: PrismaClient, user: AccountRow) {
  const [threads, posts] = await Promise.all([
    db.forumThread.findMany({
      where: { authorUserId: user.id },
      select: { id: true, title: true, authorPersonaId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.forumPost.findMany({
      where: { authorUserId: user.id },
      select: {
        id: true,
        threadId: true,
        authorPersonaId: true,
        contentWikitext: true,
        contentHtml: true,
        createdAt: true,
        editedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { threads, posts };
}

const MESSAGE_FIELDS = {
  id: true,
  content: true,
  messageType: true,
  replyToId: true,
  attachments: true,
  ixTimeTimestamp: true,
  editedAt: true,
  deletedAt: true,
} as const;

/** Only messages the user sent. Older rows hold the database id instead of the Clerk id. */
async function messagesSection(db: PrismaClient, user: AccountRow, clerkUserId: string) {
  const where = { userId: { in: [clerkUserId, user.id] } };
  const [thinkshare, thinktank] = await Promise.all([
    db.thinkshareMessage.findMany({
      where,
      select: { ...MESSAGE_FIELDS, conversationId: true, subject: true },
      orderBy: { ixTimeTimestamp: "asc" },
    }),
    db.thinktankMessage.findMany({
      where,
      select: { ...MESSAGE_FIELDS, groupId: true },
      orderBy: { ixTimeTimestamp: "asc" },
    }),
  ]);
  return { thinkshare, thinktank };
}

async function onomaSection(db: PrismaClient, user: AccountRow) {
  const mine = { where: { userId: user.id }, omit: { userId: true } } as const;
  const [languagePacks, etymologyRoots, grammarProfiles, writingSystems, nameBanks] =
    await Promise.all([
      db.languagePack.findMany(mine),
      db.etymologyRoot.findMany(mine),
      db.grammarProfile.findMany(mine),
      db.writingSystem.findMany(mine),
      db.nameBank.findMany(mine),
    ]);
  return { languagePacks, etymologyRoots, grammarProfiles, writingSystems, nameBanks };
}

function cardsSection(db: PrismaClient, user: AccountRow) {
  return db.cardOwnership.findMany({
    where: { ownerId: user.id },
    select: {
      id: true,
      serialNumber: true,
      level: true,
      finish: true,
      acquiredAt: true,
      cards: {
        select: {
          id: true,
          title: true,
          rarity: true,
          cardType: true,
          season: true,
          realm: { select: { name: true } },
        },
      },
    },
    orderBy: { acquiredAt: "asc" },
  });
}

/** Each trade from the user's side: which side they were on, and the message only when they wrote it. */
async function tradesSection(db: PrismaClient, user: AccountRow) {
  const trades = await db.tradeOffer.findMany({
    where: { OR: [{ initiatorId: user.id }, { recipientId: user.id }] },
    select: {
      id: true,
      status: true,
      initiatorId: true,
      initiatorCardIds: true,
      recipientCardIds: true,
      initiatorCredits: true,
      recipientCredits: true,
      message: true,
      proposerId: true,
      isCrossRealm: true,
      createdAt: true,
      respondedAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return trades.map((trade) => {
    const initiated = trade.initiatorId === user.id;
    return {
      id: trade.id,
      side: initiated ? ("initiator" as const) : ("recipient" as const),
      status: trade.status,
      initiatorCardIds: trade.initiatorCardIds,
      recipientCardIds: trade.recipientCardIds,
      initiatorCredits: trade.initiatorCredits,
      recipientCredits: trade.recipientCredits,
      // The message belongs to the current proposer: a counter rewrites both.
      message: trade.proposerId === user.id ? trade.message : null,
      isCrossRealm: trade.isCrossRealm,
      createdAt: trade.createdAt,
      respondedAt: trade.respondedAt,
      expiresAt: trade.expiresAt,
    };
  });
}

function realmClaimsSection(db: PrismaClient, user: AccountRow) {
  return db.realmClaim.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      status: true,
      realm: { select: { name: true, slug: true } },
      countryId: true,
      wikiSource: true,
      wikiPageTitle: true,
      rejectionReason: true,
      consentVersion: true,
      consentAt: true,
      consentBasis: true,
      permissionNote: true,
      createdAt: true,
      reviewedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

async function vaultSection(db: PrismaClient, user: AccountRow) {
  return db.myVault.findUnique({
    where: { userId: user.id },
    select: { credits: true, vaultLevel: true, vaultXp: true, equippedCosmetics: true },
  });
}

async function accountContent(db: PrismaClient, user: AccountRow, clerkUserId: string) {
  const [linkedAccounts, nations, forum, messages, onoma, cards, trades, realmClaims, vault] =
    await Promise.all([
      linkedAccountsSection(db, user),
      nationsSection(db, user),
      forumSection(db, user),
      messagesSection(db, user, clerkUserId),
      onomaSection(db, user),
      cardsSection(db, user),
      tradesSection(db, user),
      realmClaimsSection(db, user),
      vaultSection(db, user),
    ]);
  return { linkedAccounts, nations, forum, messages, onoma, cards, trades, realmClaims, vault };
}

/** The same shape for a Clerk user who never got an account row: only what Clerk and the Clerk-keyed rows hold. */
function emptyContent(): Awaited<ReturnType<typeof accountContent>> {
  return {
    linkedAccounts: {
      discord: { userId: null, username: null, lastSync: null },
      forum: { userId: null, username: null, lastSync: null },
      wikis: [],
      nationStates: [],
      wikiNames: [],
    },
    nations: [],
    forum: { threads: [], posts: [] },
    messages: { thinkshare: [], thinktank: [] },
    onoma: {
      languagePacks: [],
      etymologyRoots: [],
      grammarProfiles: [],
      writingSystems: [],
      nameBanks: [],
    },
    cards: [],
    trades: [],
    realmClaims: [],
    vault: null,
  };
}

export async function buildAccountExport(
  db: PrismaClient,
  clerkUserId: string,
  readClerk: ReadClerkIdentity = clerkIdentity
) {
  const [user, clerk, thinkpages, achievements, preferences] = await Promise.all([
    loadAccountRow(db, clerkUserId),
    readClerk(clerkUserId),
    thinkpagesSection(db, clerkUserId),
    db.userAchievement.findMany({
      where: { userId: clerkUserId },
      select: {
        achievementId: true,
        title: true,
        description: true,
        category: true,
        rarity: true,
        unlockedAt: true,
      },
      orderBy: { unlockedAt: "asc" },
    }),
    db.userPreferences.findUnique({
      where: { userId: clerkUserId },
      omit: { id: true, userId: true },
    }),
  ]);
  const content = user ? await accountContent(db, user, clerkUserId) : emptyContent();
  return {
    exportedAt: new Date().toISOString(),
    account: accountSection(user, clerk),
    ...content,
    personas: thinkpages.personas,
    thinkpagesPosts: thinkpages.posts,
    achievements,
    preferences,
  };
}

export type AccountExport = Awaited<ReturnType<typeof buildAccountExport>>;
