// src/server/api/routers/admin/users.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { isSystemOwner } from "~/lib/auth";
import { TRPCError } from "@trpc/server";
import { invalidateCache, globalCache } from "~/lib/cache";

export const adminUsersRouter = createTRPCRouter({
  // List all users and their claimed countries
  listUsersWithCountries: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      include: { country: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    return users.map((u) => ({
      id: u.id,
      clerkUserId: u.clerkUserId,
      membershipTier: u.membershipTier || "basic",
      country: u.country ? { id: u.country.id, name: u.country.name } : null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }),

  // List all countries and their assigned users
  listCountriesWithUsers: adminProcedure.query(async ({ ctx }) => {
    const countries = await ctx.db.country.findMany({
      include: { users: true },
      orderBy: { name: "asc" },
    });
    return countries.map((c) => ({
      id: c.id,
      name: c.name,
      user:
        c.users && c.users.length > 0
          ? { id: c.users[0].id, clerkUserId: c.users[0].clerkUserId }
          : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }),

  // Assign a user to a country (admin override)
  assignUserToCountry: adminProcedure
    .input(z.object({ userId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const isSystemOwnerUser = isSystemOwner(input.userId);

      if (isSystemOwnerUser) {
        // For system owners, allow multiple users to access the same country
        // Just link the user without unlinking others
        await ctx.db.user.upsert({
          where: { clerkUserId: input.userId },
          update: { countryId: input.countryId },
          create: { clerkUserId: input.userId, countryId: input.countryId },
        });
      } else {
        // For regular users, maintain the original behavior (one user per country)
        // Unlink any user currently assigned to this country
        await ctx.db.user.updateMany({
          where: { countryId: input.countryId },
          data: { countryId: null },
        });
        // Unlink this user from any country they currently claim
        await ctx.db.user.updateMany({
          where: { clerkUserId: input.userId },
          data: { countryId: null },
        });
        // Link user to country
        await ctx.db.user.upsert({
          where: { clerkUserId: input.userId },
          update: { countryId: input.countryId },
          create: { clerkUserId: input.userId, countryId: input.countryId },
        });
      }

      await globalCache.delete(`user_profile:${input.userId}`);
      await invalidateCache(["countries."]);

      return { success: true };
    }),

  // Unassign a user from a country (admin override)
  unassignUserFromCountry: adminProcedure
    .input(z.object({ userId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.updateMany({
        where: { clerkUserId: input.userId, countryId: input.countryId },
        data: { countryId: null },
      });

      await globalCache.delete(`user_profile:${input.userId}`);
      await invalidateCache(["countries."]);

      return { success: true };
    }),

  // Get navigation settings (wiki/cards/labs visibility)
  getNavigationSettings: publicProcedure.query(async ({ ctx }) => {
    try {
      const settings = await ctx.db.systemConfig.findMany({
        where: {
          key: {
            in: [
              "showWikiTab",
              "showCardsTab",
              "showLabsTab",
              "showIntelligenceTab",
              "showDefenseTab",
              "showMapsTab",
              "showForumTab",
              "showHelpTab",
            ],
          },
        },
      });

      const settingsMap = settings.reduce(
        (acc, setting) => {
          acc[setting.key] = setting.value === "true";
          return acc;
        },
        {} as Record<string, boolean>
      );

      return {
        showWikiTab: settingsMap.showWikiTab ?? true,
        showCardsTab: settingsMap.showCardsTab ?? true,
        showLabsTab: settingsMap.showLabsTab ?? true,
        showIntelligenceTab: settingsMap.showIntelligenceTab ?? false,
        showDefenseTab: settingsMap.showDefenseTab ?? false,
        showMapsTab: settingsMap.showMapsTab ?? true,
        showForumTab: settingsMap.showForumTab ?? true,
        showHelpTab: settingsMap.showHelpTab ?? true,
      };
    } catch (error) {
      console.error("Failed to get navigation settings:", error);
      return {
        showWikiTab: true,
        showCardsTab: true,
        showLabsTab: true,
        showIntelligenceTab: false,
        showDefenseTab: false,
        showMapsTab: true,
        showForumTab: true,
        showHelpTab: true,
      };
    }
  }),

  // Update navigation settings (wiki/cards/labs visibility)
  updateNavigationSettings: adminProcedure
    .input(
      z.object({
        showWikiTab: z.boolean(),
        showCardsTab: z.boolean(),
        showLabsTab: z.boolean(),
        showIntelligenceTab: z.boolean(),
        showDefenseTab: z.boolean(),
        showMapsTab: z.boolean(),
        showForumTab: z.boolean(),
        showHelpTab: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const configUpdates = [
          { key: "showWikiTab", value: input.showWikiTab.toString() },
          { key: "showCardsTab", value: input.showCardsTab.toString() },
          { key: "showLabsTab", value: input.showLabsTab.toString() },
          { key: "showIntelligenceTab", value: input.showIntelligenceTab.toString() },
          { key: "showDefenseTab", value: input.showDefenseTab.toString() },
          { key: "showMapsTab", value: input.showMapsTab.toString() },
          { key: "showForumTab", value: input.showForumTab.toString() },
          { key: "showHelpTab", value: input.showHelpTab.toString() },
        ];

        // Batch upserts using transaction for better performance (avoids N+1 pattern)
        await ctx.db.$transaction(
          configUpdates.map((config) =>
            ctx.db.systemConfig.upsert({
              where: { key: config.key },
              update: { value: config.value, updatedAt: new Date() },
              create: {
                key: config.key,
                value: config.value,
                description: `Navigation tab visibility setting for ${config.key}`,
              },
            })
          )
        );

        return { success: true, message: "Navigation settings updated successfully" };
      } catch (error) {
        console.error("Failed to update navigation settings:", error);
        throw new Error("Failed to update navigation settings");
      }
    }),

  // Invite user and pre-seed nation reservation in publicMetadata (Clerk waitlist integration)
  inviteUserToBypassWaitlist: adminProcedure
    .input(
      z.object({
        emailAddress: z.string().email(),
        reservedNationName: z.string().min(1),
        role: z.enum(["admin", "user", "owner"]).optional().default("user"),
      })
    )
    .mutation(async ({ input }) => {
      const hasClerkKeys = Boolean(
        process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      );

      if (!hasClerkKeys) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Clerk is not configured. Invitations cannot be created.",
        });
      }

      try {
        const { clerkClient } = await import("@clerk/nextjs/server");
        const client = await clerkClient();

        await client.invitations.createInvitation({
          emailAddress: input.emailAddress,
          redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/sign-up`,
          publicMetadata: {
            reservedNationName: input.reservedNationName,
            isVip: true,
            role: input.role,
          },
          ignoreExisting: true,
        });

        console.log(
          `[Admin Clerk Invite] Successfully created invitation for ${input.emailAddress} with nation ${input.reservedNationName}`
        );

        return {
          success: true,
          message: `Invitation successfully sent to ${input.emailAddress}`,
        };
      } catch (error) {
        console.error("[Admin Clerk Invite] Failed to create invitation:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to invite user via Clerk.",
        });
      }
    }),

  // --- IDENTITY & CROSS-PLATFORM LINKING PROCEDURES ---

  // Get full identity matrix across all registered platform users
  listUserIdentities: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      include: {
        country: true,
        role: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const { getWikiAltsForUser } = await import("~/lib/wiki-os/adapters/ixstates/user-sync");

    return users.map((u) => {
      const wikiAlts = u.wikiUsername ? getWikiAltsForUser(u.wikiUsername) : [];
      return {
        id: u.id,
        clerkUserId: u.clerkUserId,
        membershipTier: u.membershipTier || "basic",
        country: u.country,
        role: u.role,
        wikiUsername: u.wikiUsername,
        wikiUserId: u.wikiUserId,
        wikiAlts,
        lastWikiSync: u.lastWikiSync,
        discordUserId: u.discordUserId,
        discordUsername: u.discordUsername,
        lastDiscordSync: u.lastDiscordSync,
        forumUserId: u.forumUserId,
        forumUsername: u.forumUsername,
        lastForumSync: u.lastForumSync,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    });
  }),

  // Link a user's MediaWiki account (admin manual link / override)
  linkUserWiki: adminProcedure
    .input(z.object({ userId: z.string(), wikiUsername: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { linkWikiAccount } = await import("~/lib/wiki-os/adapters/ixstates/user-sync");
      const res = await linkWikiAccount(input.userId, input.wikiUsername, ctx.auth.userId);
      if (!res.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: res.error || "Failed to link MediaWiki account",
        });
      }
      await globalCache.delete(`user_profile:${input.userId}`);
      return res;
    }),

  // Unlink a user's MediaWiki account
  unlinkUserWiki: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: input.userId },
        data: {
          wikiUsername: null,
          wikiUserId: null,
          lastWikiSync: null,
        },
      });
      await globalCache.delete(`user_profile:${input.userId}`);
      return { success: true };
    }),

  // Link a user's Discord account (admin manual link / override)
  linkUserDiscord: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        discordUserId: z.string().min(1),
        discordUsername: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: input.userId },
        data: {
          discordUserId: input.discordUserId,
          discordUsername: input.discordUsername,
          lastDiscordSync: new Date(),
        },
      });
      await globalCache.delete(`user_profile:${input.userId}`);
      return { success: true };
    }),

  // Unlink a user's Discord account
  unlinkUserDiscord: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: input.userId },
        data: {
          discordUserId: null,
          discordUsername: null,
          lastDiscordSync: null,
        },
      });
      await globalCache.delete(`user_profile:${input.userId}`);
      return { success: true };
    }),

  // Query Discord Guild members via bot token and suggest identity linkages
  syncDiscordGuildMembers: adminProcedure.query(async ({ ctx }) => {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const defaultGuildId = process.env.DISCORD_GUILD_ID || "552179975769161729";
    const defaultChannelId = process.env.DISCORD_IXTWITTER_CHANNEL_ID || "557223534418722818";

    if (!botToken) {
      return {
        configured: false,
        members: [],
        suggestions: [],
        error: "DISCORD_BOT_TOKEN is not configured in environment.",
      };
    }

    try {
      let guildId = defaultGuildId;

      // 1. Try to resolve the bot's current guilds dynamically
      try {
        const guildRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
          headers: { Authorization: `Bot ${botToken}` },
          signal: AbortSignal.timeout(5000),
        });
        if (guildRes.ok) {
          const guilds = (await guildRes.json()) as any[];
          if (Array.isArray(guilds) && guilds.length > 0 && guilds[0].id) {
            guildId = guilds[0].id;
          }
        }
      } catch {
        // Fallback to defaultGuildId
      }

      // 2. Fetch guild members or discover via recent channel interactions
      let rawMembers: Array<{ id: string; username: string; nick?: string; globalName?: string }> = [];

      try {
        const membersRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(8000),
        });

        if (membersRes.ok) {
          const guildMembers = (await membersRes.json()) as any[];
          if (Array.isArray(guildMembers)) {
            for (const m of guildMembers) {
              if (!m.user || m.user.bot) continue;
              rawMembers.push({
                id: String(m.user.id),
                username: String(m.user.username || ""),
                nick: m.nick ? String(m.nick) : undefined,
                globalName: m.user.global_name ? String(m.user.global_name) : undefined,
              });
            }
          }
        }
      } catch {
        // Guild members list requires Server Members Intent; fallback to channel discovery below
      }

      // Fallback / Supplementary: Discover active members from recent channel messages
      if (rawMembers.length === 0) {
        try {
          const msgRes = await fetch(`https://discord.com/api/v10/channels/${defaultChannelId}/messages?limit=100`, {
            headers: { Authorization: `Bot ${botToken}` },
            signal: AbortSignal.timeout(8000),
          });
          if (msgRes.ok) {
            const msgs = (await msgRes.json()) as any[];
            const seen = new Set<string>();
            for (const msg of msgs) {
              if (!msg.author || msg.author.bot) continue;
              const uid = String(msg.author.id);
              if (seen.has(uid)) continue;
              seen.add(uid);
              rawMembers.push({
                id: uid,
                username: String(msg.author.username || ""),
                globalName: msg.author.global_name ? String(msg.author.global_name) : undefined,
              });
            }
          }
        } catch {
          // Channel fallback failed
        }
      }

      // Fetch all users and countries to match against
      const users = await ctx.db.user.findMany({
        include: { country: true },
      });

      interface Suggestion {
        discordUserId: string;
        discordUsername: string;
        discordNick?: string;
        discordAvatar?: string;
        matchedUserId: string;
        matchedUserClerkId: string;
        matchedCountryName: string;
        confidence: "HIGH" | "MEDIUM";
        reason: string;
      }

      const suggestions: Suggestion[] = [];
      const parsedMembers = [];

      for (const m of rawMembers) {
        const discordUserId = m.id;
        const discordUsername = m.username;
        const discordNick = m.nick;
        const globalName = m.globalName;

        parsedMembers.push({
          id: discordUserId,
          username: discordUsername,
          nick: discordNick,
          globalName,
        });


        // Skip if already linked
        const existingLink = users.find((u) => u.discordUserId === discordUserId);
        if (existingLink) continue;

        // Try to match by country name in nickname: "[Urcea] John" or "Urcea"
        for (const u of users) {
          if (!u.country) continue;
          const cName = u.country.name.toLowerCase();
          const nickLower = (discordNick || "").toLowerCase();
          const globalLower = (globalName || "").toLowerCase();
          const userLower = discordUsername.toLowerCase();

          // High confidence: country name in brackets [Urcea] or starts with country name
          if (nickLower.includes(`[${cName}]`) || nickLower.startsWith(`${cName} |`) || nickLower.startsWith(`${cName} -`)) {
            suggestions.push({
              discordUserId,
              discordUsername,
              discordNick,
              matchedUserId: u.id,
              matchedUserClerkId: u.clerkUserId,
              matchedCountryName: u.country.name,
              confidence: "HIGH",
              reason: `Server nickname "${discordNick}" contains nation bracket [${u.country.name}]`,
            });
            break;
          }

          // Medium confidence: exact match on username or nickname
          if (nickLower === cName || globalLower === cName || userLower === cName) {
            suggestions.push({
              discordUserId,
              discordUsername,
              discordNick,
              matchedUserId: u.id,
              matchedUserClerkId: u.clerkUserId,
              matchedCountryName: u.country.name,
              confidence: "HIGH",
              reason: `Discord identity directly matches nation "${u.country.name}"`,
            });
            break;
          }
        }
      }

      return {
        configured: true,
        totalGuildMembers: parsedMembers.length,
        members: parsedMembers.slice(0, 150),
        suggestions,
      };
    } catch (err: any) {
      return {
        configured: true,
        members: [],
        suggestions: [],
        error: `Discord sync error: ${err.message}`,
      };
    }
  }),

  // Batch apply high confidence Discord matches
  applyDiscordAutoAssignments: adminProcedure
    .input(
      z.object({
        assignments: z.array(
          z.object({
            userId: z.string(),
            discordUserId: z.string(),
            discordUsername: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let applied = 0;
      for (const a of input.assignments) {
        await ctx.db.user.update({
          where: { id: a.userId },
          data: {
            discordUserId: a.discordUserId,
            discordUsername: a.discordUsername,
            lastDiscordSync: new Date(),
          },
        });
        applied++;
      }
      return { success: true, appliedCount: applied };
    }),

  // Get MediaWiki Master Reconciliation Overview
  listMediaWikiReconciliationMatrix: adminProcedure.query(async ({ ctx }) => {
    const { MEDIAWIKI_MAPPING } = await import("~/lib/wiki-os/adapters/ixstates/wiki-mappings");
    const users = await ctx.db.user.findMany({
      include: { country: true },
    });

    const entries = Object.entries(MEDIAWIKI_MAPPING).map(([wikiName, mapInfo]) => {
      const matchedUser = users.find((u) => {
        if (!u.country) return false;
        const cName = (u.country.name || "").toLowerCase();
        const target = mapInfo.primaryCountry.toLowerCase();
        return cName === target || cName.includes(target) || target.includes(cName);
      });

      let status = "UNMATCHED_USER";
      if (mapInfo.isAltFor) {
        status = "ALT_MERGED";
      } else if (matchedUser) {
        status = matchedUser.wikiUsername === wikiName ? "ALREADY_LINKED" : "READY_TO_LINK";
      }

      return {
        wikiUsername: wikiName,
        targetCountry: mapInfo.primaryCountry,
        isAltFor: mapInfo.isAltFor,
        notes: mapInfo.notes,
        status,
        matchedUser: matchedUser
          ? {
              id: matchedUser.id,
              clerkUserId: matchedUser.clerkUserId,
              countryName: matchedUser.country?.name,
              currentWikiUsername: matchedUser.wikiUsername,
            }
          : null,
      };
    });

    return {
      totalMapped: entries.length,
      entries,
    };
  }),
});
