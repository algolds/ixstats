/**
 * The row steps of an account erasure (Privacy 5.2), run inside one transaction by `eraseAccount`: erase what is
 * personal (messages sent, linked accounts, sessions, settings, notifications, the social graph, private and ephemeral
 * rows, logs), anonymise what is public (personas, forum posts, shared documents, discussions, the activity feed) and
 * tombstone the User row.
 * Social and ThinkPages rows key on the Clerk id, cards, onoma, forum and wiki rows on User.id, and some columns hold
 * either, so every sweep matches both. Moderation cases (forum reports, warnings, bans, appeals, post flags, card
 * inscription reports) are kept (Privacy 5.2(5)).
 */
import type { Prisma } from "@prisma/client";
import { FORMER_MEMBER, formerUsername } from "~/lib/account/deletion";

type Tx = Prisma.TransactionClient;

/** The account being erased: its database id, its Clerk id and the sentinel that replaces the Clerk id. */
export interface ErasureIds {
  userId: string;
  clerkId: string;
  sentinel: string;
}

const both = (ids: ErasureIds) => ({ in: [ids.userId, ids.clerkId] });

/** A ThinkPages persona of the user: a nation's (countryId set) or their personal one. */
export interface ErasedPersona {
  id: string;
  countryId: string | null;
}

/** The user's ThinkPages personas (by Clerk id); read before the erase so their follows go too. */
export async function personasOf(tx: Tx, ids: ErasureIds): Promise<ErasedPersona[]> {
  return tx.thinkpagesAccount.findMany({
    where: { clerkUserId: both(ids) },
    select: { id: true, countryId: true },
  });
}

/** Every ThinkShare and Thinktank message the user sent, with the read receipts on them (there is no DM report). */
async function eraseMessages(tx: Tx, ids: ErasureIds): Promise<void> {
  const [shared, tank] = await Promise.all([
    tx.thinkshareMessage.findMany({ where: { userId: both(ids) }, select: { id: true } }),
    tx.thinktankMessage.findMany({ where: { userId: both(ids) }, select: { id: true } }),
  ]);
  await tx.messageReadReceipt.deleteMany({
    where: {
      OR: [
        { userId: both(ids) },
        { thinkshareMessageId: { in: shared.map((m) => m.id) } },
        { messageId: { in: tank.map((m) => m.id) } },
      ],
    },
  });
  await tx.thinkshareMessage.deleteMany({ where: { userId: both(ids) } });
  await tx.thinktankMessage.deleteMany({ where: { userId: both(ids) } });
}

/** Linked-account associations: wiki accounts and name claims, NationStates, wiki bot passwords and their sessions. */
async function eraseLinkedAccounts(tx: Tx, ids: ErasureIds): Promise<void> {
  const where = { userId: both(ids) };
  await tx.wikiAccountLink.deleteMany({ where });
  await tx.wikiNameClaim.deleteMany({ where });
  await tx.nSVerification.deleteMany({ where });
  await tx.wikiApiSession.deleteMany({ where });
  await tx.wikiBotPassword.deleteMany({ where });
  await tx.wikiUserGroup.deleteMany({ where });
}

async function eraseSessionsAndSettings(tx: Tx, ids: ErasureIds): Promise<void> {
  const where = { userId: both(ids) };
  await tx.userSession.deleteMany({ where: { clerkUserId: both(ids) } });
  await tx.pushSubscription.deleteMany({ where });
  await tx.userPreferences.deleteMany({ where });
  await tx.passportPreference.deleteMany({ where });
  await tx.builderDraft.deleteMany({ where });
  await tx.adminFavorite.deleteMany({ where });
  await tx.userPresence.deleteMany({ where });
  await tx.notificationReceipt.deleteMany({ where });
  await tx.notification.deleteMany({ where });
}

/** Connections both ways, follows by the user or their personas, bookmarks, memberships and officer posts. */
async function eraseSocialGraph(tx: Tx, ids: ErasureIds, personaIds: string[]): Promise<void> {
  const where = { userId: both(ids) };
  await tx.userConnection.deleteMany({ where: { OR: [where, { targetUserId: both(ids) }] } });
  await tx.thinkpagesFollow.deleteMany({
    where: {
      OR: [{ followerClerkUserId: both(ids) }, { followerAccountId: { in: personaIds } }],
    },
  });
  await tx.thinkpagesPersonalAccount.deleteMany({ where: { clerkUserId: both(ids) } });
  await tx.postBookmark.deleteMany({ where });
  await tx.conversationParticipant.deleteMany({ where });
  await tx.thinktankMember.deleteMany({ where });
  await tx.realmOfficer.deleteMany({ where });
}

/**
 * Generation history: the user's favourites, then their events. An event another user favourited stays (deleting it
 * would cascade into that user's favourite); it keeps only the generated names, under the tombstone.
 */
async function eraseGenerationHistory(tx: Tx, ids: ErasureIds): Promise<void> {
  await tx.generationFavorite.deleteMany({ where: { userId: both(ids) } });
  const events = await tx.generationEvent.findMany({
    where: { userId: both(ids) },
    select: { id: true },
  });
  const kept = await tx.generationFavorite.findMany({
    where: { eventId: { in: events.map((e) => e.id) } },
    select: { eventId: true },
  });
  const keep = new Set(kept.map((f) => f.eventId));
  await tx.generationEvent.deleteMany({
    where: { id: { in: events.map((e) => e.id).filter((id) => !keep.has(id)) } },
  });
}

/**
 * Private and ephemeral rows: achievements, stashes (their items and annotations cascade, none another user's),
 * custom field values, the wiki watchlist, forum read marks and watches, generation history.
 */
async function erasePrivateRows(tx: Tx, ids: ErasureIds): Promise<void> {
  const where = { userId: both(ids) };
  await tx.userAchievement.deleteMany({ where });
  await tx.stash.deleteMany({ where });
  await tx.customFieldValue.deleteMany({ where });
  await tx.wikiWatchlist.deleteMany({ where });
  await tx.forumThreadRead.deleteMany({ where });
  await tx.forumThreadWatch.deleteMany({ where });
  await eraseGenerationHistory(tx, ids);
}

async function eraseLogs(tx: Tx, ids: ErasureIds): Promise<void> {
  await tx.systemLog.deleteMany({ where: { userId: both(ids) } });
  await tx.auditLog.deleteMany({ where: { userId: both(ids) } });
}

export async function eraseRecords(
  tx: Tx,
  ids: ErasureIds,
  personas: readonly ErasedPersona[]
): Promise<void> {
  await eraseMessages(tx, ids);
  await eraseLinkedAccounts(tx, ids);
  await eraseSessionsAndSettings(tx, ids);
  await eraseSocialGraph(
    tx,
    ids,
    personas.map((p) => p.id)
  );
  await erasePrivateRows(tx, ids);
  await eraseLogs(tx, ids);
}

/**
 * A nation's persona is part of its Shared Record: it keeps its name, bio and posts, and is retired (inactive, the
 * sentinel as its holder) so the nation's next owner gets a fresh one (intent-summation looks up active accounts).
 * A personal persona keeps its posts, renamed: no name, bio or picture of the user's.
 */
async function anonymisePersonas(
  tx: Tx,
  ids: ErasureIds,
  personas: readonly ErasedPersona[]
): Promise<void> {
  const nationIds = personas.filter((p) => p.countryId !== null).map((p) => p.id);
  await tx.thinkpagesAccount.updateMany({
    where: { id: { in: nationIds } },
    data: { clerkUserId: ids.sentinel, isActive: false },
  });
  for (const { id } of personas.filter((p) => p.countryId === null)) {
    await tx.thinkpagesAccount.update({
      where: { id },
      data: {
        clerkUserId: ids.sentinel,
        username: formerUsername(id),
        displayName: FORMER_MEMBER,
        firstName: FORMER_MEMBER,
        lastName: "",
        bio: null,
        profileImageUrl: null,
      },
    });
  }
}

/**
 * Forum threads and posts read "a former member" through the imported-author fallback (thinkpages-forum/authors).
 * The XenForo author id goes too: relinking that old forum account (imported-authors-relink) would otherwise
 * attribute these rows to whoever links it. Imports dedupe on the thread and post ids, never on this one.
 */
async function anonymiseForum(tx: Tx, ids: ErasureIds): Promise<void> {
  const where = { authorUserId: both(ids) };
  const data = { authorUserId: null, xenforoUserId: null, importedAuthorName: FORMER_MEMBER };
  await tx.forumThread.updateMany({ where, data });
  await tx.forumPost.updateMany({ where, data });
}

/** Shared documents, groups, wiki discussions and the activity feed stay, credited to nobody. */
async function anonymiseContributions(tx: Tx, ids: ErasureIds): Promise<void> {
  const sentinel = ids.sentinel;
  await tx.collaborativeDoc.updateMany({
    where: { createdBy: both(ids) },
    data: { createdBy: sentinel },
  });
  await tx.collaborativeDoc.updateMany({
    where: { lastEditBy: both(ids) },
    data: { lastEditBy: null },
  });
  await tx.thinktankGroup.updateMany({
    where: { createdBy: both(ids) },
    data: { createdBy: sentinel },
  });
  await tx.wikiDiscussionThread.updateMany({
    where: { createdBy: both(ids) },
    data: { createdBy: sentinel },
  });
  await tx.wikiDiscussionComment.updateMany({
    where: { userId: both(ids) },
    data: { userId: sentinel },
  });
  await tx.activityFeed.updateMany({ where: { userId: both(ids) }, data: { userId: null } });
}

export async function anonymiseRecords(
  tx: Tx,
  ids: ErasureIds,
  personas: readonly ErasedPersona[]
): Promise<void> {
  await anonymisePersonas(tx, ids, personas);
  await anonymiseForum(tx, ids);
  await anonymiseContributions(tx, ids);
}

/**
 * The User row stays (deleting it would cascade into other users' shareholdings, auction bids and onoma forks, and
 * BlurbResponse refuses), stripped of every identifier and access. Its own onoma packs and reviews stay attached.
 */
export async function tombstoneUser(tx: Tx, ids: ErasureIds): Promise<void> {
  await tx.user.update({
    where: { id: ids.userId },
    data: {
      clerkUserId: ids.sentinel,
      handle: null,
      handleChangedAt: null,
      discordUserId: null,
      discordUsername: null,
      lastDiscordSync: null,
      forumUserId: null,
      forumUsername: null,
      lastForumSync: null,
      lastSeenAt: null,
      countryId: null,
      roleId: null,
      isActive: false,
    },
  });
}
