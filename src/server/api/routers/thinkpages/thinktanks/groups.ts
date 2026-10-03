/**
 * Thinkpages ThinkTanks — Groups Router
 *
 * Handles ThinkTank group lifecycle (create, list, update, delete, view),
 * group settings, group feed posts, and invites.
 */

import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { notificationHooks } from "~/lib/notifications/hooks";
import {
  pickDisplayName,
  resolveDisplayName,
  UNKNOWN_DISPLAY_NAME,
} from "~/server/shared/display-names";
import {
  canReadGroupType,
  requireGroupManager,
  requireGroupMember,
  requireGroupReader,
  requirePersonaAccount,
} from "./access";
import {
  getRealmBoardAccess,
  groupPostTag,
  isRealmBoard,
  REALM_BOARD_TYPE,
  realmBoardPersona,
  requireRealmPersona,
} from "./realm-board";

/** Realm boards belong to their realm: their type, lifetime and membership are not group-managed. */
function rejectRealmBoard(group: { type: string }, action: string): void {
  if (isRealmBoard(group)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `A realm board's ${action} follows its realm and cannot be changed here`,
    });
  }
}
import { filterInvitableUserIds } from "./invite-privacy";
import { ensurePersonalAccount } from "../personal-account";

type GroupDb = Pick<
  PrismaClient,
  "thinkshareConversation" | "thinktankGroup" | "user" | "thinkpagesAccount"
>;
type GroupMemberRow = { userId: string; role: string };

/** Auto-heal a missing ThinkShare conversation for the group (mutates `group` to match). */
async function healGroupConversation(
  db: GroupDb,
  group: {
    id: string;
    name: string;
    avatar: string | null;
    conversationId: string | null;
    conversation: { id: string; lastActivity: Date } | null;
    members: GroupMemberRow[];
  }
) {
  if (group.conversationId && group.conversation) return;
  try {
    const newConv = await db.thinkshareConversation.create({
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

    await db.thinktankGroup.update({
      where: { id: group.id },
      data: { conversationId: newConv.id },
    });

    group.conversationId = newConv.id;
    group.conversation = { id: newConv.id, lastActivity: newConv.createdAt };
  } catch (e) {
    console.warn("[ThinkTanks] Failed to auto-heal group conversation:", e);
  }
}

/** Members joined to their user record (or first active persona) for display. */
async function enrichGroupMembers<M extends GroupMemberRow>(
  db: GroupDb,
  members: M[]
): Promise<Array<M & { user: any }>> {
  const memberUserIds = members.map((m) => m.userId);
  const [users, userAccounts] = await Promise.all([
    db.user.findMany({
      where: { clerkUserId: { in: memberUserIds } },
      select: {
        id: true,
        clerkUserId: true,
        forumUsername: true,
        wikiUsername: true,
        country: { select: { id: true, name: true, flag: true } },
      },
    }),
    db.thinkpagesAccount.findMany({
      where: { clerkUserId: { in: memberUserIds }, isActive: true },
      select: { clerkUserId: true, profileImageUrl: true, displayName: true, username: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.clerkUserId, u]));
  const accountMap = new Map<string, (typeof userAccounts)[number]>();
  for (const acc of userAccounts) {
    if (!accountMap.has(acc.clerkUserId)) accountMap.set(acc.clerkUserId, acc);
  }

  return members.map((m) => {
    const u = userMap.get(m.userId);
    const acc = accountMap.get(m.userId);
    if (u) {
      return {
        ...m,
        user: {
          ...u,
          avatarUrl: acc?.profileImageUrl || null,
          displayName:
            pickDisplayName({ ...u, thinkpagesDisplayName: acc?.displayName }) ??
            UNKNOWN_DISPLAY_NAME,
        },
      };
    }
    return {
      ...m,
      user: acc
        ? {
            clerkUserId: m.userId,
            avatarUrl: acc.profileImageUrl || null,
            displayName: acc.displayName || acc.username,
            country: null,
          }
        : null,
    };
  });
}

type GroupSettings = {
  allowPersonaPosting?: boolean;
  rules?: string;
  bannerUrl?: string;
  themeAccent?: string;
  pinnedDocIds?: string[];
};

function parseGroupSettings(raw: string | null, groupId: string): GroupSettings {
  const settings: GroupSettings = { allowPersonaPosting: false };
  if (!raw) return settings;
  try {
    return { ...settings, ...JSON.parse(raw) };
  } catch (err) {
    console.warn("[ThinkTanks] Malformed settings on group", groupId, err);
    return settings;
  }
}

function parseGroupTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [raw];
  }
}

function viewerMembership(
  group: { createdBy: string; members: GroupMemberRow[] },
  viewerId: string
) {
  if (!viewerId) return { isMember: false, userRole: null };
  const isOwner = group.createdBy === viewerId;
  const isMember = isOwner || group.members.some((m) => m.userId === viewerId);
  const userRole = isOwner
    ? "owner"
    : group.members.find((m) => m.userId === viewerId)?.role || (isMember ? "member" : null);
  return { isMember, userRole };
}

export const thinkpagesThinktanksGroupsRouter = createTRPCRouter({
  // Create a new ThinkTank group
  createThinktank: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        avatar: z.string().url().optional(),
        type: z.enum(["public", "private", "invite_only"]).default("public"),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const createdBy = ctx.auth.userId;

      // Automatically create the linked ThinkShare group conversation
      const conversation = await db.thinkshareConversation.create({
        data: {
          type: "group",
          name: input.name,
          avatar: input.avatar,
          source: "thinktank",
          participants: {
            create: {
              userId: createdBy,
              role: "admin",
            },
          },
        },
      });

      // Create the group linked to the conversation
      const group = await db.thinktankGroup.create({
        data: {
          name: input.name,
          description: input.description,
          avatar: input.avatar,
          type: input.type,
          category: input.category,
          tags: input.tags ? JSON.stringify(input.tags) : null,
          createdBy,
          memberCount: 1,
          conversationId: conversation.id,
          members: {
            create: {
              userId: createdBy,
              role: "owner",
            },
          },
        },
        include: {
          members: true,
          conversation: true,
        },
      });

      // Send activity notification for public groups
      if (input.type === "public") {
        try {
          const creatorName = await resolveDisplayName(db, createdBy);
          await notificationHooks.onThinktankActivity({
            activityType: "settings_changed",
            groupId: group.id,

            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: createdBy,
            actorUserName: creatorName,
          });
        } catch (e) {
          console.warn("[ThinkTanks] Failed to send group creation notification:", e);
        }
      }

      return group;
    }),

  // Get ThinkTanks globally (no country restriction). Membership is the caller's own.
  getThinktanks: publicProcedure
    .input(
      z
        .object({
          type: z.enum(["all", "joined", "created"]).optional().default("all"),
        })
        .optional()
        .default(() => ({ type: "all" as const }))
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      try {
        const targetUserId = ctx.auth?.userId || "";

        const whereClause: any = {
          isActive: true,
        };

        if (input?.type === "joined" && targetUserId) {
          whereClause.OR = [
            { members: { some: { userId: targetUserId, isActive: true } } },
            { createdBy: targetUserId },
          ];
        } else if (input?.type === "created" && targetUserId) {
          whereClause.createdBy = targetUserId;
        } else {
          // Realm boards are listed in the realm directory (/realms), not among ThinkTanks.
          whereClause.type = { not: REALM_BOARD_TYPE };
        }

        const groups = await db.thinktankGroup.findMany({
          where: whereClause,
          take: 100,
          include: {
            members: {
              where: { isActive: true },
            },
            conversation: {
              select: { id: true, lastActivity: true },
            },
            _count: {
              select: {
                members: true,
                messages: true,
                collaborativeDocs: true,
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        });

        // Auto-heal any legacy groups that lack a conversation channel
        for (const group of groups) {
          if (!group.conversationId) {
            try {
              const conv = await db.thinkshareConversation.create({
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
              await db.thinktankGroup.update({
                where: { id: group.id },
                data: { conversationId: conv.id },
              });
              group.conversationId = conv.id;
            } catch (e) {
              console.warn(
                `[ThinkTanks] Failed to auto-heal conversation for group ${group.id}:`,
                e
              );
            }
          }
        }

        return groups.map((group) => {
          const isMember = targetUserId
            ? group.createdBy === targetUserId ||
              group.members.some((m) => m.userId === targetUserId)
            : false;

          const userRole = targetUserId
            ? group.createdBy === targetUserId
              ? "owner"
              : group.members.find((m) => m.userId === targetUserId)?.role ||
                (isMember ? "member" : null)
            : null;

          const lastActivityDate =
            group.conversation?.lastActivity || group.updatedAt || group.createdAt;
          const diffHours = (Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60);
          const hasRecentActivity = diffHours < 48;

          return {
            ...group,
            // Member lists of non-public groups are visible to their members only.
            members: canReadGroupType(group.type) || isMember ? group.members : [],
            tags: group.tags ? JSON.parse(group.tags) : [],
            isMember,
            isJoined: isMember,
            userRole,
            lastActivity: lastActivityDate,
            hasRecentActivity,
            docsCount: group._count?.collaborativeDocs ?? 0,
          };
        });
      } catch (error) {
        console.error("Error in getThinktanks:", error);
        return [];
      }
    }),

  // Update a ThinkTank group
  updateThinktank: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        avatar: z.string().optional().nullable(),
        // "realm_board" is accepted only as the unchanged type of a realm board (its settings form resends it).
        type: z.enum(["public", "private", "invite_only", REALM_BOARD_TYPE]).optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const actorId = ctx.auth.userId;
      const { groupId, ...updateData } = input;

      const { group: current } = await requireGroupManager(db, groupId, actorId);
      if (updateData.type && updateData.type !== current.type) {
        rejectRealmBoard(current, "type");
        rejectRealmBoard({ type: updateData.type }, "type");
      }

      const group = await db.thinktankGroup.update({
        where: { id: groupId },
        data: {
          ...updateData,
          tags: updateData.tags ? JSON.stringify(updateData.tags) : undefined,
        },
      });

      // Notify all members about settings change
      try {
        const members = await db.thinktankMember.findMany({
          where: {
            groupId: groupId,
            isActive: true,
            userId: { not: actorId },
          },
          select: { userId: true },
        });

        if (members.length > 0) {
          const actorDisplayName = await resolveDisplayName(db, actorId);
          await notificationHooks.onThinktankActivity({
            activityType: "settings_changed",
            groupId: groupId,
            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: actorId,
            actorUserName: actorDisplayName,
            targetUserIds: members.map((m) => m.userId),
          });
        }
      } catch (e) {
        console.warn("[ThinkTanks] Failed to send settings change notifications:", e);
      }

      return group;
    }),

  deleteThinktank: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { group } = await requireGroupManager(db, input.groupId, ctx.auth.userId);
      rejectRealmBoard(group, "lifetime");
      await db.thinktankGroup.delete({
        where: { id: input.groupId },
      });
      if (group.conversationId) {
        await db.thinkshareConversation
          .delete({
            where: { id: group.conversationId },
          })
          .catch(() => {});
      }
      return { success: true };
    }),

  /**
   * Get single ThinkTank by ID with rich metadata, members, and settings
   */
  getThinktankById: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const group = await db.thinktankGroup.findUnique({
        where: { id: input.groupId },
        include: {
          members: {
            where: { isActive: true },
          },
          collaborativeDocs: {
            orderBy: { updatedAt: "desc" },
            take: 10,
          },
          conversation: {
            select: { id: true, lastActivity: true },
          },
          _count: {
            select: {
              members: { where: { isActive: true } },
              collaborativeDocs: true,
            },
          },
        },
      });

      if (!group) return null;

      await healGroupConversation(db, group);
      const enrichedMembers = await enrichGroupMembers(db, group.members);

      const targetUserId = ctx.auth?.userId || "";

      // Realm boards: membership is nation ownership in the realm, not a member row.
      const boardAccess = isRealmBoard(group)
        ? await getRealmBoardAccess(db, group.id, targetUserId)
        : null;
      const { isMember, userRole } = boardAccess
        ? { isMember: boardAccess.isMember, userRole: boardAccess.role }
        : viewerMembership(group, targetUserId);

      // Members and documents of non-public groups are for members only (SL-2).
      const canRead = canReadGroupType(group.type) || isMember;

      return {
        ...group,
        collaborativeDocs: canRead ? group.collaborativeDocs : [],
        // The group chat is for members only: don't hand its conversation id to outsiders.
        conversationId: isMember ? group.conversationId : null,
        conversation: isMember ? group.conversation : null,
        members: canRead ? enrichedMembers : [],
        settings: parseGroupSettings(group.settings, input.groupId),
        tags: parseGroupTags(group.tags),
        isMember,
        userRole,
        realmId: boardAccess?.realmId ?? null,
      };
    }),

  /**
   * Update ThinkTank group settings (including multi-persona posting toggle)
   */
  updateGroupSettings: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        allowPersonaPosting: z.boolean().optional(),
        rules: z.string().optional(),
        bannerUrl: z.string().optional(),
        themeAccent: z.string().optional(),
        pinnedDocIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { groupId, ...settingsUpdate } = input;

      const { group } = await requireGroupManager(db, groupId, ctx.auth.userId);

      let existingSettings = {};
      if (group.settings) {
        try {
          existingSettings = JSON.parse(group.settings);
        } catch (err) {
          console.warn(
            "[ThinkTanks] Malformed settings on group (overwritten by update)",
            groupId,
            err
          );
        }
      }

      const newSettings = {
        ...existingSettings,
        ...settingsUpdate,
      };

      const updated = await db.thinktankGroup.update({
        where: { id: groupId },
        data: {
          settings: JSON.stringify(newSettings),
        },
      });

      return { success: true, group: updated, settings: newSettings };
    }),

  /**
   * Get ThinkTank group feed posts ("Group Thinks")
   */
  getGroupFeed: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const limit = input.limit ?? 20;

      // Signed-out callers and non-members see public groups only (SL-2).
      await requireGroupReader(db, input.groupId, ctx.auth?.userId);

      const posts = await db.thinkpagesPost.findMany({
        where: {
          hashtags: { contains: `group:${input.groupId}` },
        },
        take: limit + 1,
        orderBy: { ixTimeTimestamp: "desc" },
        include: {
          account: {
            include: {
              country: { select: { id: true, name: true, flag: true } },
            },
          },
          reactions: true,
          mediaAttachments: true,
          _count: {
            select: { replies: true, reposts: true, reactions: true },
          },
        },
      });

      const clerkUserIds = posts.map((p) => p.account?.clerkUserId).filter(Boolean);
      const users = await db.user.findMany({
        where: { clerkUserId: { in: clerkUserIds } },
        select: {
          id: true,
          clerkUserId: true,
          forumUsername: true,
          wikiUsername: true,
          country: { select: { id: true, name: true, flag: true } },
        },
      });
      const userMap = new Map(users.map((u) => [u.clerkUserId, u]));

      let nextCursor: string | undefined = undefined;
      if (posts.length > limit) {
        const nextItem = posts.pop()!;
        nextCursor = nextItem.id;
      }

      return {
        posts: posts.map((p) => ({
          ...p,
          realUser: p.account?.clerkUserId ? userMap.get(p.account.clerkUserId) || null : null,
          likeCount: p._count.reactions,
          replyCount: p._count.replies,
          repostCount: p._count.reposts,
        })),
        nextCursor,
      };
    }),

  /**
   * Create a group post / Think in a ThinkTank
   */
  createGroupPost: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        accountId: z.string().optional(),
        content: z.string().min(1).max(5000),
        hashtags: z.array(z.string()).optional(),
        mediaUrls: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, auth } = ctx;
      const currentUserId = auth.userId;

      const { group } = await requireGroupMember(db, input.groupId, currentUserId);
      const board = isRealmBoard(group)
        ? await getRealmBoardAccess(db, group.id, currentUserId)
        : null;

      let targetAccountId = input.accountId;

      // A persona account must belong to the caller, and the group must allow persona posting.
      if (targetAccountId) {
        await requirePersonaAccount(db, group, targetAccountId, currentUserId);
        // On a realm board the persona speaks for one of the realm's nations.
        if (board?.realmId) await requireRealmPersona(db, targetAccountId, board.realmId);
      }

      // On a realm board, "post as yourself" uses the caller's persona of a nation in the realm,
      // creating a citizen persona in their first nation there when they have none.
      if (!targetAccountId && board?.realmId && board.ownedCountryIds.length > 0) {
        targetAccountId = await realmBoardPersona(db, currentUserId, board.ownedCountryIds);
      }

      // No persona given: post as yourself, through the caller's personal persona (one per user,
      // tied to no country), never a government/media persona or an arbitrary nation.
      if (!targetAccountId) {
        const personal = await ensurePersonalAccount(db, currentUserId);
        targetAccountId = personal.id;
      }

      const groupTag = groupPostTag(input.groupId);
      const allTags = input.hashtags ? [...new Set([...input.hashtags, groupTag])] : [groupTag];

      const post = await db.thinkpagesPost.create({
        data: {
          accountId: targetAccountId,
          content: input.content,
          hashtags: JSON.stringify(allTags),
          visibility: "thinktank",
          // Realm-board posts also show in the realm feed, which orders by real time (as main-feed posts are).
          ixTimeTimestamp: board ? new Date() : new Date(IxTime.getCurrentIxTime()),
          mediaAttachments: input.mediaUrls
            ? {
                create: input.mediaUrls.map((url) => ({
                  type: "image",
                  url,
                })),
              }
            : undefined,
        },
        include: {
          account: {
            include: {
              country: { select: { id: true, name: true, flag: true } },
            },
          },
          reactions: true,
          mediaAttachments: true,
        },
      });

      return post;
    }),

  /**
   * Remove a post from a group's feed (moderation). Group owners and admins may do this; on a realm board
   * that is the realm's moderators. The post leaves the group feed and is hidden everywhere else.
   */
  removeGroupPost: protectedProcedure
    .input(z.object({ groupId: z.string(), postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await requireGroupManager(db, input.groupId, ctx.auth.userId);

      const tag = groupPostTag(input.groupId);
      const post = await db.thinkpagesPost.findFirst({
        where: { id: input.postId, hashtags: { contains: `"${tag}"` } },
        select: { id: true, hashtags: true },
      });
      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found in this group" });
      }

      let tags: string[] = [];
      try {
        tags = JSON.parse(post.hashtags ?? "[]") as string[];
      } catch {
        tags = [];
      }
      await db.thinkpagesPost.update({
        where: { id: post.id },
        data: { visibility: "removed", hashtags: JSON.stringify(tags.filter((t) => t !== tag)) },
      });
      return { success: true, postId: post.id };
    }),

  // Invite users to a ThinkTank group
  inviteToThinktank: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        userIds: z.array(z.string().min(1)).min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const invitedBy = ctx.auth.userId;

      // Only the owner or a group admin can invite (the invite form is in group settings).
      const { group } = await requireGroupManager(db, input.groupId, invitedBy);
      rejectRealmBoard(group, "membership");
      const requestedIds = [...new Set(input.userIds.map((id) => id.trim()))].filter(
        (id) => id && id !== invitedBy
      );
      // Honor each invitee's privacy settings (thinktankInvites, blocks) and skip unknown users.
      const userIds = await filterInvitableUserIds(
        db,
        { clerkUserId: invitedBy, dbUserId: ctx.user?.id },
        requestedIds
      );

      const invites =
        userIds.length > 0
          ? await db.thinktankInvite.createMany({
              data: userIds.map((userId) => ({
                groupId: input.groupId,
                invitedUser: userId,
                invitedBy,
              })),
            })
          : { count: 0 };

      // Send notifications to all invited users
      if (userIds.length > 0) {
        const inviterName = await resolveDisplayName(db, invitedBy);
        await notificationHooks
          .onThinktankActivity({
            activityType: "group_invite",
            groupId: input.groupId,
            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: invitedBy,
            actorUserName: inviterName,
            targetUserIds: userIds,
          })
          .catch((e) => console.warn("[ThinkTanks] Failed to send invite notifications:", e));
      }

      return { ...invites, skipped: requestedIds.length - userIds.length };
    }),

  // Look up users to invite by ThinkPages username / display name (group managers only).
  // Returns only what the invite picker needs; never email or other account fields.
  searchInvitableUsers: protectedProcedure
    .input(z.object({ groupId: z.string(), query: z.string().trim().min(2).max(50) }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const callerId = ctx.auth.userId;
      await requireGroupManager(db, input.groupId, callerId);

      const term = input.query.replace(/^@/, "");
      if (term.length < 2) return [];

      const accounts = await db.thinkpagesAccount.findMany({
        where: {
          isActive: true,
          clerkUserId: { not: callerId },
          OR: [
            { username: { contains: term, mode: "insensitive" } },
            { displayName: { contains: term, mode: "insensitive" } },
          ],
        },
        select: {
          clerkUserId: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          country: { select: { name: true } },
        },
        orderBy: { username: "asc" },
        take: 25,
      });

      const seen = new Set<string>();
      const unique = accounts.filter((a) => {
        if (seen.has(a.clerkUserId)) return false;
        seen.add(a.clerkUserId);
        return true;
      });

      const members = await db.thinktankMember.findMany({
        where: {
          groupId: input.groupId,
          isActive: true,
          userId: { in: unique.map((a) => a.clerkUserId) },
        },
        select: { userId: true },
      });
      const memberIds = new Set(members.map((m) => m.userId));

      const allowed = new Set(
        await filterInvitableUserIds(
          db,
          { clerkUserId: callerId, dbUserId: ctx.user?.id },
          unique.map((a) => a.clerkUserId).filter((id) => !memberIds.has(id)),
          { forSearch: true }
        )
      );

      return unique
        .filter((a) => allowed.has(a.clerkUserId))
        .slice(0, 10)
        .map((a) => ({
          userId: a.clerkUserId,
          username: a.username,
          displayName: a.displayName,
          profileImageUrl: a.profileImageUrl,
          countryName: a.country?.name ?? null,
        }));
    }),
});
