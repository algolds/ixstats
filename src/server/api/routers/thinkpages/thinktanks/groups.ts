/**
 * Thinkpages ThinkTanks — Groups Router
 *
 * Handles ThinkTank group lifecycle (create, list, update, delete, view),
 * group settings, group feed posts, and invites.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationHooks } from "~/lib/notifications/hooks";

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
        createdBy: z.string(), // userId (clerkUserId)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify the creator user exists
      if (!input.createdBy || input.createdBy.trim() === "") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User ID is required",
        });
      }

      // Automatically create the linked ThinkShare group conversation
      const conversation = await db.thinkshareConversation.create({
        data: {
          type: "group",
          name: input.name,
          avatar: input.avatar,
          source: "thinktank",
          participants: {
            create: {
              userId: input.createdBy,
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
          createdBy: input.createdBy,
          memberCount: 1,
          conversationId: conversation.id,
          members: {
            create: {
              userId: input.createdBy,
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
          const creatorUser = await db.user.findUnique({
            where: { clerkUserId: input.createdBy },
            include: { country: true },
          });
          const creatorName =
            creatorUser?.country?.name ||
            creatorUser?.forumUsername ||
            `User ${input.createdBy.slice(0, 8)}`;
          await notificationHooks.onThinktankActivity({
            activityType: "settings_changed",
            groupId: group.id,

            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: input.createdBy,
            actorUserName: creatorName,
          });
        } catch (e) {
          console.warn("[ThinkTanks] Failed to send group creation notification:", e);
        }
      }

      return group;
    }),

  // Get ThinkTanks globally (no country restriction)
  getThinktanks: publicProcedure
    .input(
      z
        .object({
          userId: z.string().optional().default(""),
          type: z.enum(["all", "joined", "created"]).optional().default("all"),
        })
        .optional()
        .default(() => ({ userId: "", type: "all" as const }))
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      try {
        const targetUserId = input?.userId || ctx.auth?.userId || ctx.user?.id || "";

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
              console.warn(`[ThinkTanks] Failed to auto-heal conversation for group ${group.id}:`, e);
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
        type: z.enum(["public", "private", "invite_only"]).optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { groupId, ...updateData } = input;

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
            userId: { not: ctx.user?.clerkUserId },
          },
          select: { userId: true },
        });

        const actor = await db.user.findUnique({
          where: { clerkUserId: ctx.user?.clerkUserId },
        });

        if (members.length > 0 && actor) {
          const actorDisplayName = ctx.user?.clerkUserId
            ? `User ${ctx.user.clerkUserId.slice(0, 8)}`
            : "System";
          await notificationHooks.onThinktankActivity({
            activityType: "settings_changed",
            groupId: groupId,
            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: ctx.user?.clerkUserId || "system",
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
      const group = await db.thinktankGroup.findUnique({
        where: { id: input.groupId },
        select: { conversationId: true },
      });
      await db.thinktankGroup.delete({
        where: { id: input.groupId },
      });
      if (group?.conversationId) {
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
    .input(z.object({ groupId: z.string(), userId: z.string().optional() }))
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

      // Auto-heal missing ThinkShare conversation for this group
      if (!group.conversationId || !group.conversation) {
        try {
          const newConv = await db.thinkshareConversation.create({
            data: {
              type: "group",
              name: group.name,
              avatar: group.avatar,
              source: "thinktank",
              sourceId: group.id,
              participants: {
                create: group.members.map((m: any) => ({
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

      const memberUserIds = group.members.map((m: any) => m.userId);
      const users = await db.user.findMany({
        where: { clerkUserId: { in: memberUserIds } },
        select: {
          id: true,
          clerkUserId: true,
          forumUsername: true,
          wikiUsername: true,
          country: { select: { id: true, name: true, flag: true } },
        },
      });

      const userAccounts = await db.thinkpagesAccount.findMany({
        where: { clerkUserId: { in: memberUserIds }, isActive: true },
        select: {
          clerkUserId: true,
          profileImageUrl: true,
          displayName: true,
          username: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const userMap = new Map<string, any>(users.map((u: any) => [u.clerkUserId, u]));
      const accountMap = new Map<string, any>();
      for (const acc of userAccounts) {
        if (!accountMap.has(acc.clerkUserId)) {
          accountMap.set(acc.clerkUserId, acc);
        }
      }

      const enrichedMembers = group.members.map((m: any) => {
        const u = userMap.get(m.userId);
        const acc = accountMap.get(m.userId);
        return {
          ...m,
          user: u
            ? {
                ...u,
                avatarUrl: acc?.profileImageUrl || null,
                displayName:
                  u.country?.name ||
                  u.forumUsername ||
                  u.wikiUsername ||
                  acc?.displayName ||
                  `User ${m.userId.slice(-6)}`,
              }
            : acc
            ? {
                clerkUserId: m.userId,
                avatarUrl: acc.profileImageUrl || null,
                displayName: acc.displayName || acc.username,
                country: null,
              }
            : null,
        };
      });

      let parsedSettings: {
        allowPersonaPosting?: boolean;
        rules?: string;
        bannerUrl?: string;
        themeAccent?: string;
        pinnedDocIds?: string[];
      } = {
        allowPersonaPosting: false,
      };

      if (group.settings) {
        try {
          parsedSettings = { ...parsedSettings, ...JSON.parse(group.settings) };
        } catch {}
      }

      let parsedTags: string[] = [];
      if (group.tags) {
        try {
          parsedTags = JSON.parse(group.tags);
        } catch {
          parsedTags = [group.tags];
        }
      }

      const targetUserId = input.userId || ctx.auth?.userId || ctx.user?.id || "";

      const isMember = targetUserId
        ? group.createdBy === targetUserId ||
          group.members.some((m: any) => m.userId === targetUserId)
        : false;

      const userRole = targetUserId
        ? group.createdBy === targetUserId
          ? "owner"
          : group.members.find((m: any) => m.userId === targetUserId)?.role ||
            (isMember ? "member" : null)
        : null;

      return {
        ...group,
        members: enrichedMembers,
        settings: parsedSettings,
        tags: parsedTags,
        isMember,
        userRole,
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

      const group = await db.thinktankGroup.findUnique({
        where: { id: groupId },
        select: { settings: true, createdBy: true },
      });

      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ThinkTank group not found" });
      }

      let existingSettings = {};
      if (group.settings) {
        try {
          existingSettings = JSON.parse(group.settings);
        } catch {}
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

      let targetAccountId = input.accountId;

      // If no persona account specified or Multi-Persona is disabled, resolve real user account
      if (!targetAccountId) {
        let primaryAcc = await db.thinkpagesAccount.findFirst({
          where: { clerkUserId: currentUserId, isActive: true },
          orderBy: { createdAt: "asc" },
        });

        if (!primaryAcc) {
          const user = await db.user.findUnique({
            where: { clerkUserId: currentUserId },
            include: { country: true },
          });

          const countryId = user?.countryId || (await db.country.findFirst())?.id || "";
          const username =
            user?.forumUsername ||
            user?.wikiUsername ||
            `user_${currentUserId.slice(-6)}`;
          const displayName = user?.country?.name || username;

          primaryAcc = await db.thinkpagesAccount.create({
            data: {
              clerkUserId: currentUserId,
              countryId,
              accountType: "citizen",
              username: `${username.toLowerCase().replace(/[^a-z0-9_]/g, "")}_${Date.now().toString().slice(-4)}`,
              displayName,
              firstName: displayName,
              lastName: "",
              bio: "User Account",
            },
          });
        }
        targetAccountId = primaryAcc.id;
      }

      const groupTag = `group:${input.groupId}`;
      const allTags = input.hashtags
        ? [...new Set([...input.hashtags, groupTag])]
        : [groupTag];

      const post = await db.thinkpagesPost.create({
        data: {
          accountId: targetAccountId,
          content: input.content,
          hashtags: JSON.stringify(allTags),
          visibility: "thinktank",
          ixTimeTimestamp: new Date(IxTime.getCurrentIxTime()),
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

  // Invite users to a ThinkTank group
  inviteToThinktank: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        userIds: z.array(z.string()),
        invitedBy: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get group details for notifications
      const group = await db.thinktankGroup.findUnique({
        where: { id: input.groupId },
        select: { name: true, type: true },
      });

      const inviter = await db.user.findUnique({
        where: { clerkUserId: input.invitedBy },
      });

      const invites = await db.thinktankInvite.createMany({
        data: input.userIds.map((userId) => ({
          groupId: input.groupId,
          invitedUser: userId,
          invitedBy: input.invitedBy,
        })),
      });

      // Send notifications to all invited users
      if (group && inviter) {
        const inviterName = `User ${input.invitedBy.slice(0, 8)}`;
        await notificationHooks
          .onThinktankActivity({
            activityType: "group_invite",
            groupId: input.groupId,
            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: input.invitedBy,
            actorUserName: inviterName,
            targetUserIds: input.userIds,
          })
          .catch((e) => console.warn("[ThinkTanks] Failed to send invite notifications:", e));
      }

      return invites;
    }),
});
