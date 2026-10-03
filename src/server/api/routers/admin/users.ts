// src/server/api/routers/admin/users.ts
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache, globalCache } from "~/lib/cache";
import { readConfigKeys, writeConfigKeys } from "./_config-kv";
import {
  adminAssignNation,
  NationOwnershipError,
  pointActiveNation,
  releaseNation,
} from "~/server/modules/realms";
import {
  fetchUserPageHistory,
  fetchWikiUser,
  PROOF_SOURCES,
} from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { fetchGuildMembers, suggestLinks } from "./discord-guild";
import {
  createWikiLinkService,
  WikiLinkError,
} from "~/server/modules/identity/identity.wiki-links";

/** The wiki-links service for admin link/unlink — the admin's authority stands in for the token proof. */
const adminWikiLinks = (db: PrismaClient) =>
  createWikiLinkService(db, { fetchWikiUser, fetchUserPageHistory });

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
      include: { owner: true },
      orderBy: { name: "asc" },
    });
    return countries.map((c) => ({
      id: c.id,
      name: c.name,
      user: c.owner ? { id: c.owner.id, clerkUserId: c.owner.clerkUserId } : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }),

  // Assign a user to a country (admin override)
  assignUserToCountry: adminProcedure
    .input(z.object({ userId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await adminAssignNation(ctx.db, { clerkUserId: input.userId, countryId: input.countryId });
      } catch (err) {
        if (err instanceof NationOwnershipError) {
          throw new TRPCError({ code: "CONFLICT", message: err.message });
        }
        throw err;
      }

      await globalCache.delete(`user_profile:${input.userId}`);
      await invalidateCache(["countries."]);

      return { success: true };
    }),

  // Unassign a user from a country (admin override)
  unassignUserFromCountry: adminProcedure
    .input(z.object({ userId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { clerkUserId: input.userId } });
        if (!user) return;
        const country = await tx.country.findUnique({
          where: { id: input.countryId },
          select: { ownerUserId: true },
        });
        // An owned nation is released whether or not it is the active one (a player may own several).
        if (country?.ownerUserId === user.id) await releaseNation(tx, input.countryId);
        else if (user.countryId === input.countryId) await pointActiveNation(tx, user.id, null);
      });

      await globalCache.delete(`user_profile:${input.userId}`);
      await invalidateCache(["countries."]);

      return { success: true };
    }),

  // Get navigation settings (wiki/cards/labs visibility)
  getNavigationSettings: publicProcedure.query(async ({ ctx }) => {
    try {
      const stored = await readConfigKeys(ctx.db, [
        "showWikiTab",
        "showCardsTab",
        "showLabsTab",
        "showIntelligenceTab",
        "showDefenseTab",
        "showMapsTab",
        "showForumTab",
        "showHelpTab",
      ]);
      const settingsMap: Record<string, boolean> = Object.fromEntries(
        Object.entries(stored).map(([key, value]) => [key, value === "true"] as const)
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

        await writeConfigKeys(
          ctx.db,
          configUpdates,
          (key) => `Navigation tab visibility setting for ${key}`
        );

        return { success: true, message: "Navigation settings updated successfully" };
      } catch (error) {
        console.error("Failed to update navigation settings:", error);
        throw new Error("Failed to update navigation settings", { cause: error });
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
      const { findLinkableWikiAccount } = await import("~/lib/wiki-os/adapters/ixstates/user-sync");
      const res = await findLinkableWikiAccount(input.userId, input.wikiUsername, ctx.auth.userId);
      if (!res.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: res.error || "Failed to link MediaWiki account",
        });
      }

      // The admin's authority is the proof of ownership here (no token): adminVerify writes the verified
      // WikiAccountLink row AND the legacy User columns in one transaction, so a TAKEN refusal writes nothing
      // (ruling F-2). The PostgreSQL fast path hard-codes userId 1 (pg-activity.ts), which is not a real
      // MediaWiki user id, so treat it as unknown.
      const wikiUserId = res.wikiUserId && res.wikiUserId > 1 ? res.wikiUserId : null;
      try {
        await adminWikiLinks(ctx.db).adminVerify(
          input.userId,
          "ixwiki",
          res.wikiUsername ?? input.wikiUsername,
          wikiUserId
        );
      } catch (err) {
        if (err instanceof WikiLinkError) {
          throw new TRPCError({ code: "CONFLICT", message: err.message });
        }
        throw err;
      }

      await globalCache.delete(`user_profile:${input.userId}`);
      return res;
    }),

  // Revoke a user's wiki link on any wiki (the verified row; ixwiki also clears the legacy columns — ruling F-2)
  unlinkUserWiki: adminProcedure
    .input(z.object({ userId: z.string(), source: z.enum(PROOF_SOURCES).default("ixwiki") }))
    .mutation(async ({ ctx, input }) => {
      await adminWikiLinks(ctx.db).unlink(input.userId, input.source);
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
      const members = await fetchGuildMembers(botToken, defaultGuildId, defaultChannelId);
      const users = await ctx.db.user.findMany({ include: { country: true } });

      return {
        configured: true,
        totalGuildMembers: members.length,
        members: members.slice(0, 150),
        suggestions: suggestLinks(members, users),
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
