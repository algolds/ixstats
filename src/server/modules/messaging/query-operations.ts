/**
 * Messaging Query Operations (Plan 163)
 *
 * Encapsulates read paths, message folder indexing, unread counters,
 * pagination cursor resolution, and user search.
 */

import type { Prisma, PrismaClient, ThinkshareMessage } from "@prisma/client";
import {
  type GetConversationsByFolderInput,
  type GetConversationMessagesInput,
  type SearchUsersInput,
  type MessagingDependencies,
  type BridgeCollaborator,
  type TelemetryLogger,
} from "./contracts";
import { MessagingForbiddenError, MessagingNotFoundError } from "./errors";
import { formatMessagesConversation } from "./formatters";
import { recordMessagingTelemetry } from "./telemetry";
import { batchResolveMessagingAccounts } from "./account-resolver";
import { historyStart } from "./access";
import { afterCursor, cursorOrder, encodeCursor } from "./cursor";
import { blockedUserClerkIds } from "~/server/shared/user-blocks";
import { usersWithSwitchOff } from "~/server/shared/privacy-permissions";
import { visibleOnlineUserIds } from "~/server/shared/presence";
import { pickDisplayName, UNKNOWN_DISPLAY_NAME } from "~/server/shared/display-names";
import { enrollThinktankMember, realmBoardChatRevoked } from "./thinktank-enrollment";

const FOLDER_SOURCES = new Set(["diplomatic", "wiki", "forum"]);
const COUNTED_SOURCES = ["thinktank", "diplomatic", "wiki", "forum"] as const;
type CountedSource = (typeof COUNTED_SOURCES)[number];

const CONVERSATION_DETAIL_INCLUDE = {
  participants: { where: { isActive: true } },
  thinktankGroup: { include: { members: { where: { isActive: true } } } },
  messages: { take: 1, orderBy: { ixTimeTimestamp: "desc" } },
} satisfies Prisma.ThinkshareConversationInclude;

/** How many most-recent conversations a folder page holds when the caller does not say. */
const DEFAULT_FOLDER_PAGE = 20;
const DEFAULT_MESSAGE_PAGE = 50;

interface ListedConversation {
  id: string;
  participants: Array<{ userId: string }>;
  messages: Array<{ userId: string }>;
}

export class MessagingQueryOperations {
  private db: PrismaClient;
  private wikiBridge?: BridgeCollaborator;
  private telemetry?: TelemetryLogger;

  constructor(dependencies: MessagingDependencies) {
    this.db = dependencies.db;
    this.wikiBridge = dependencies.wikiBridge;
    this.telemetry = dependencies.telemetry;
  }

  /** Accounts for the actor, every listed participant and every last-message sender. */
  private resolveListAccounts(conversations: ListedConversation[], actorId: string) {
    const userIds: string[] = [actorId];
    for (const conv of conversations) {
      for (const p of conv.participants) userIds.push(p.userId);
      if (conv.messages[0]) userIds.push(conv.messages[0].userId);
    }
    return batchResolveMessagingAccounts(userIds, this.db);
  }

  /**
   * Unread message count per conversation (messages from others after the actor's last read), in one grouped
   * query. In group conversations, messages from `blocked` senders are hidden from the actor, so they are not
   * counted either.
   */
  private async unreadCounts(conversationIds: string[], actorId: string, blocked: string[]) {
    const unreadMap = new Map<string, number>();
    if (conversationIds.length === 0) return unreadMap;

    const rows = await this.db.$queryRaw<{ conversationId: string; unread: number }[]>`
      SELECT m."conversationId" AS "conversationId", COUNT(*)::int AS unread
      FROM "ThinkshareMessage" m
      JOIN "ConversationParticipant" p
        ON p."conversationId" = m."conversationId"
       AND p."userId" = ${actorId}
       AND p."isActive" = true
      JOIN "ThinkshareConversation" c ON c."id" = m."conversationId"
      WHERE m."conversationId" = ANY(${conversationIds}::text[])
        AND m."userId" <> ${actorId}
        AND m."deletedAt" IS NULL
        AND m."ixTimeTimestamp" > p."lastReadAt"
        AND (c."type" = 'direct' OR m."userId" <> ALL(${blocked}::text[]))
      GROUP BY m."conversationId"
    `;
    for (const row of rows) unreadMap.set(row.conversationId, Number(row.unread));
    return unreadMap;
  }

  /** Runs a list query and records its success/failure telemetry. */
  private async withTelemetry<T>(
    surface: "messages" | "thinkpages",
    procedure: string,
    actorId: string,
    run: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const record = (authenticated: boolean, success: boolean) =>
      recordMessagingTelemetry(
        { surface, procedure, authenticated, success, durationMs: Date.now() - startTime },
        this.telemetry
      );

    try {
      const result = await run();
      record(true, true);
      return result;
    } catch (err) {
      record(Boolean(actorId), false);
      throw err;
    }
  }

  /**
   * Swaps a group conversation's preview for its latest message from a sender not in `blocked`. Only the groups
   * whose latest message is from a blocked sender need a lookup, so this is rarely more than a query or two.
   */
  private async replaceBlockedPreviews(
    groups: Array<{ id: string; messages: ThinkshareMessage[] }>,
    blocked: readonly string[]
  ) {
    const hidden = new Set(blocked);
    await Promise.all(
      groups
        .filter((conv) => conv.messages[0] && hidden.has(conv.messages[0].userId))
        .map(async (conv) => {
          const visible = await this.db.thinkshareMessage.findFirst({
            where: { conversationId: conv.id, userId: { notIn: [...blocked] } },
            orderBy: { ixTimeTimestamp: "desc" },
          });
          conv.messages = visible ? [visible] : [];
        })
    );
  }

  /** The other participants of direct conversations who are online and let others see it. */
  private onlineDirectParticipants(
    conversations: Array<{ type: string; participants: Array<{ userId: string }> }>,
    actorId: string
  ) {
    const ids = conversations
      .filter((c) => c.type === "direct")
      .flatMap((c) => c.participants.map((p) => p.userId))
      .filter((id) => id !== actorId);
    return visibleOnlineUserIds(this.db, ids);
  }

  /**
   * Read receipts (SL-4): in a direct conversation, when the other participant last read it.
   * Null unless both people allow read receipts, and while the other person holds the
   * conversation as an unanswered message request. A message counts as seen when it was sent
   * before `seenAt`.
   */
  public async getSeenState(actorId: string, conversationId: string) {
    const conv = await this.db.thinkshareConversation.findUnique({
      where: { id: conversationId },
      select: {
        type: true,
        participants: {
          where: { isActive: true },
          select: { userId: true, lastReadAt: true, requestStatus: true },
        },
      },
    });
    if (!conv) throw new MessagingNotFoundError();
    const participants = conv.participants;
    if (!participants.some((p) => p.userId === actorId)) throw new MessagingForbiddenError();

    const other = conv.type === "direct" ? participants.find((p) => p.userId !== actorId) : null;
    if (!other || other.requestStatus === "pending") return { seenAt: null };
    try {
      const off = await usersWithSwitchOff(this.db, [actorId, other.userId], "dmReadReceipts");
      return { seenAt: off.size > 0 ? null : other.lastReadAt };
    } catch {
      return { seenAt: null };
    }
  }

  /** The cursor after the last conversation kept: drops the look-ahead row of a `limit + 1` page. */
  private trimPage<T extends { id: string; lastActivity: Date }>(rows: T[], limit: number) {
    if (rows.length <= limit) return { page: rows, nextCursor: null };
    const page = rows.slice(0, limit);
    const last = page[page.length - 1]!;
    return { page, nextCursor: encodeCursor(last.lastActivity, last.id) };
  }

  /** Which conversations a folder lists for the actor. */
  private folderWhere(
    folder: GetConversationsByFolderInput["folder"],
    actorId: string
  ): Prisma.ThinkshareConversationWhereInput {
    const isMember = { userId: actorId, isActive: true };
    // Message requests (SL-4) sit in their own folder, out of every other one.
    if (folder === "thinktank" || folder === "groups") {
      return {
        source: "thinktank",
        OR: [
          { participants: { some: isMember } },
          { thinktankGroup: { members: { some: isMember } } },
        ],
      };
    }
    if (folder === "requests") {
      return { participants: { some: { ...isMember, requestStatus: "pending" } } };
    }
    return {
      participants: { some: { ...isMember, requestStatus: { not: "pending" } } },
      source: FOLDER_SOURCES.has(folder) ? folder : { not: "thinktank" },
    };
  }

  public getConversationsByFolder(actorId: string, input: GetConversationsByFolderInput) {
    return this.withTelemetry("messages", "getConversationsByFolder", actorId, async () => {
      // The talk-page mirror is checked on a folder's first page only (and the bridge throttles per user).
      if (this.wikiBridge?.syncInbound && !input.cursor) {
        await this.wikiBridge.syncInbound(actorId, this.db).catch(() => {});
      }

      const limit = input.limit ?? DEFAULT_FOLDER_PAGE;
      const where = this.folderWhere(input.folder, actorId);
      if (input.cursor) where.AND = [afterCursor("lastActivity", input.cursor, "desc")];

      const rows = await this.db.thinkshareConversation.findMany({
        where,
        take: limit + 1,
        orderBy: cursorOrder("lastActivity", "desc"),
        include: {
          participants: { where: { isActive: true } },
          thinktankGroup: true,
          messages: {
            take: 1,
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });
      const { page: conversations, nextCursor } = this.trimPage(rows, limit);

      // Messages from accounts the viewer blocked are hidden in group conversations, so they
      // neither preview nor count as unread there.
      const groups = conversations.filter((c) => c.type !== "direct");
      const blocked = groups.length > 0 ? await blockedUserClerkIds(this.db, actorId) : [];
      if (blocked.length > 0) await this.replaceBlockedPreviews(groups, blocked);

      const accountMap = await this.resolveListAccounts(conversations, actorId);
      const [unreadMap, online] = await Promise.all([
        this.unreadCounts(
          conversations.map((c) => c.id),
          actorId,
          blocked
        ),
        this.onlineDirectParticipants(conversations, actorId),
      ]);

      return {
        conversations: conversations.map((conv) =>
          formatMessagesConversation(conv, actorId, accountMap, unreadMap.get(conv.id) ?? 0, online)
        ),
        nextCursor,
      };
    });
  }

  /**
   * Unread badges. `inbox` counts what the Inbox folder lists (every source but ThinkTank chats, which have their
   * own folder), `thinktank`, `diplomatic`, `wiki` and `forum` count that source alone (so each is also in
   * `inbox` except `thinktank`), `requests` is the number of pending message requests, and `total` is the
   * number to show on a single badge: inbox, ThinkTank and requests, with nothing counted twice.
   */
  public async getFolderCounts(actorId: string) {
    // ConversationParticipant has no archive/trash state (archive and mute are per-participant settings,
    // see preferences.ts), so those folders carry no counts.
    const counts = {
      inbox: 0,
      thinktank: 0,
      diplomatic: 0,
      wiki: 0,
      forum: 0,
      requests: 0,
      total: 0,
    };

    if (!actorId) return counts;

    const activeParticipants = await this.db.conversationParticipant.findMany({
      where: { userId: actorId, isActive: true },
      select: {
        conversationId: true,
        requestStatus: true,
        conversation: { select: { source: true } },
      },
    });

    if (activeParticipants.length === 0) return counts;
    counts.requests = activeParticipants.filter((p) => p.requestStatus === "pending").length;

    // Messages from accounts the actor blocked are hidden in group conversations, so they
    // don't count there.
    const blocked = await blockedUserClerkIds(this.db, actorId);

    // Count unread per conversation in SQL: loading every received message row hit the
    // 1000-row findMany guard and undercounted badges for busy users.
    const rows = await this.db.$queryRaw<{ conversationId: string; unread: number }[]>`
      SELECT m."conversationId" AS "conversationId", COUNT(*)::int AS unread
      FROM "ThinkshareMessage" m
      JOIN "ConversationParticipant" p
        ON p."conversationId" = m."conversationId"
       AND p."userId" = ${actorId}
       AND p."isActive" = true
       AND p."requestStatus" <> 'pending'
      JOIN "ThinkshareConversation" c ON c."id" = m."conversationId"
      WHERE m."userId" <> ${actorId}
        AND m."deletedAt" IS NULL
        AND m."ixTimeTimestamp" > p."lastReadAt"
        AND (c."type" = 'direct' OR m."userId" <> ALL(${blocked}::text[]))
      GROUP BY m."conversationId"
    `;
    const convUnreadCounts = new Map(rows.map((r) => [r.conversationId, Number(r.unread)]));

    for (const p of activeParticipants) {
      const unread = convUnreadCounts.get(p.conversationId) || 0;
      if (unread === 0) continue;
      const src = p.conversation.source;
      // ThinkTank chats are not in the Inbox folder, so their unread belongs to `thinktank` alone.
      if (src !== "thinktank") counts.inbox += unread;
      if ((COUNTED_SOURCES as readonly string[]).includes(src)) counts[src as CountedSource] += unread;
    }
    counts.total = counts.inbox + counts.thinktank + counts.requests;

    return counts;
  }

  /** The conversation `conversationId` names: by id, by its source id, or through its ThinkTank group. */
  private findConversationDetail(conversationId: string) {
    return this.db.thinkshareConversation.findFirst({
      where: {
        OR: [
          { id: conversationId },
          { sourceId: conversationId },
          { thinktankGroup: { id: conversationId } },
          { thinktankGroup: { conversationId: conversationId } },
        ],
      },
      include: CONVERSATION_DETAIL_INCLUDE,
    });
  }

  /**
   * Creates the chat of a ThinkTank whose conversation is missing, for a member of that group only (a stranger
   * learns nothing, and nothing is written for them), and links the two in one transaction.
   */
  private async healThinktankConversation(actorId: string, groupRef: string) {
    const group = await this.db.thinktankGroup.findFirst({
      where: { OR: [{ id: groupRef }, { conversationId: groupRef }] },
      include: { members: { where: { isActive: true } } },
    });
    if (!group || !group.members.some((m) => m.userId === actorId)) return null;

    const created = await this.db.$transaction(async (tx) => {
      const newConv = await tx.thinkshareConversation.create({
        data: {
          type: "group",
          name: group.name,
          avatar: group.avatar,
          source: "thinktank",
          sourceId: group.id,
          participants: {
            create: group.members.map((m) => ({
              userId: m.userId,
              role: m.role === "owner" || m.role === "admin" ? "admin" : "participant",
            })),
          },
        },
      });
      await tx.thinktankGroup.update({
        where: { id: group.id },
        data: { conversationId: newConv.id },
      });
      return newConv;
    });

    return this.db.thinkshareConversation.findUnique({
      where: { id: created.id },
      include: CONVERSATION_DETAIL_INCLUDE,
    });
  }

  /**
   * One conversation, for a participant of it. Anyone else, and any id that names nothing, gets null: a read
   * never reveals whether a conversation (or a `wiki-talk:` source id) exists, and nothing is written before the
   * caller is known to belong there.
   */
  public async getConversation(actorId: string, conversationId: string) {
    const conv =
      (await this.findConversationDetail(conversationId)) ??
      (await this.healThinktankConversation(actorId, conversationId));
    if (!conv) return null;

    // Only participants see a conversation; a ThinkTank member is joined to their group's chat.
    const member =
      conv.participants.find((p) => p.userId === actorId) ??
      (await enrollThinktankMember(this.db, actorId, conv.id));
    if (!member) return null;
    // A realm board's chat is closed to someone the board no longer counts a member, whatever row remains.
    if (await realmBoardChatRevoked(this.db, conv, actorId)) return null;

    const userIdsToResolve: string[] = [actorId];
    for (const p of conv.participants) userIdsToResolve.push(p.userId);
    if (conv.thinktankGroup?.members) {
      for (const m of conv.thinktankGroup.members) userIdsToResolve.push(m.userId);
    }
    if (conv.messages[0]) userIdsToResolve.push(conv.messages[0].userId);

    const accountMap = await batchResolveMessagingAccounts(userIdsToResolve, this.db);

    const [unreadCount, online] = await Promise.all([
      this.db.thinkshareMessage.count({
        where: {
          conversationId: conv.id,
          userId: { not: actorId },
          deletedAt: null,
          ixTimeTimestamp: { gt: member.lastReadAt },
        },
      }),
      this.onlineDirectParticipants([conv], actorId),
    ]);

    return formatMessagesConversation(conv, actorId, accountMap, unreadCount, online);
  }

  public async getConversationMessages(actorId: string, input: GetConversationMessagesInput) {
    const {
      conversationId,
      limit = DEFAULT_MESSAGE_PAGE,
      cursor,
      direction = "before",
    } = input;

    const conv = await this.db.thinkshareConversation.findFirst({
      where: {
        OR: [
          { id: conversationId },
          { sourceId: conversationId },
          { thinktankGroup: { id: conversationId } },
        ],
      },
    });

    const targetConvId = conv?.id || conversationId;

    const participant =
      (await this.db.conversationParticipant.findFirst({
        where: { conversationId: targetConvId, userId: actorId, isActive: true },
      })) ?? (conv ? await enrollThinktankMember(this.db, actorId, targetConvId) : null);

    if (!participant) {
      throw new MessagingForbiddenError();
    }
    if (conv && (await realmBoardChatRevoked(this.db, conv, actorId))) {
      throw new MessagingForbiddenError();
    }

    const where: Prisma.ThinkshareMessageWhereInput = { conversationId: targetConvId };

    // In group conversations, messages from accounts the viewer blocked are hidden from them.
    if (conv && conv.type !== "direct") {
      const blocked = await blockedUserClerkIds(this.db, actorId);
      if (blocked.length > 0) where.userId = { notIn: blocked };
    }

    const narrowing: Prisma.ThinkshareMessageWhereInput[] = [];
    // Someone added to a group reads only what was sent once they joined.
    const since = conv ? historyStart(conv, participant) : null;
    if (since) narrowing.push({ ixTimeTimestamp: { gte: since } });

    const order = direction === "after" ? "asc" : "desc";
    if (cursor) narrowing.push(afterCursor("ixTimeTimestamp", cursor, order));
    if (narrowing.length > 0) where.AND = narrowing;

    const rows = await this.db.thinkshareMessage.findMany({
      where,
      take: limit + 1,
      orderBy: cursorOrder("ixTimeTimestamp", order),
      include: {
        replyTo: true,
      },
    });

    // The look-ahead row only tells there is more: the cursor is the last row kept, so the next page starts
    // right after it and that row is neither skipped nor repeated.
    const messages = rows.slice(0, limit);
    const last = messages[messages.length - 1];
    const nextCursor =
      rows.length > limit && last ? encodeCursor(last.ixTimeTimestamp, last.id) : null;

    const orderedMessages = direction === "after" ? messages : messages.reverse();

    const userIdsToResolve: string[] = [actorId];
    for (const m of orderedMessages) {
      userIdsToResolve.push(m.userId);
      if (m.replyTo) userIdsToResolve.push(m.replyTo.userId);
    }

    const accountMap = await batchResolveMessagingAccounts(userIdsToResolve, this.db);

    return {
      messages: orderedMessages,
      accountMap,
      nextCursor,
    };
  }

  /**
   * Players matching a name: their nation's name or slug, their passport handle or their forum name, so someone
   * with no nation is found too. Never returns the full user rows.
   */
  public async searchUsers(actorId: string, input: SearchUsersInput) {
    const query = input.query.trim();
    if (query.length === 0) return [];
    const contains = { contains: query, mode: "insensitive" as const };

    const users = await this.db.user.findMany({
      where: {
        isActive: true,
        ...(input.excludeCurrent && { clerkUserId: { not: actorId } }),
        OR: [
          { country: { name: contains } },
          { country: { slug: contains } },
          { handle: contains },
          { forumUsername: contains },
        ],
      },
      // Only the fields the compose/add-participant UI renders (clerkUserId is the participant identifier).
      select: {
        id: true,
        clerkUserId: true,
        handle: true,
        forumUsername: true,
        country: { select: { name: true, slug: true, flag: true } },
      },
      take: input.limit ?? 10,
    });

    return users.map((u) => ({
      id: u.id,
      clerkUserId: u.clerkUserId,
      handle: u.handle,
      displayName: pickDisplayName(u) ?? UNKNOWN_DISPLAY_NAME,
      country: u.country,
    }));
  }
}
