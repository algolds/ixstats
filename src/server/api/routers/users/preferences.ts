// src/server/api/routers/users/preferences.ts
// Users preferences, privacy, blocking, and safety router

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";

export interface PrivacyConfig {
  directMessages: "everyone" | "followers" | "verified" | "nobody";
  messageRequestFiltering: boolean;
  mentions: "everyone" | "followers" | "nobody";
  tradeOffers: "everyone" | "followers" | "nobody";
  thinktankInvites: "everyone" | "followers" | "nobody";
  showOnlineStatus: boolean;
  searchDiscoverable: boolean;
  searchEngineIndexing: boolean;
  dmReadReceipts: boolean;
  diagnosticTelemetry: boolean;
  personalizedRecommendations: boolean;
  showDiscordTag: boolean;
  showWikiAttribution: boolean;
}

const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  directMessages: "everyone",
  messageRequestFiltering: true,
  mentions: "everyone",
  tradeOffers: "everyone",
  thinktankInvites: "everyone",
  showOnlineStatus: true,
  searchDiscoverable: true,
  searchEngineIndexing: true,
  dmReadReceipts: true,
  diagnosticTelemetry: true,
  personalizedRecommendations: true,
  showDiscordTag: true,
  showWikiAttribution: true,
};

export const usersPreferencesRouter = createTRPCRouter({
  // ─── Wiki Preferences ────────────────────────────────────────────────

  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    const prefs = await ctx.db.userPreferences.findUnique({ where: { userId } });
    return (
      prefs ?? {
        wikiAutoScan: true,
        wikiSourcePriority: "ixwiki",
        wikiDisplayMode: "inline",
      }
    );
  }),

  updateWikiPreferences: protectedProcedure
    .input(
      z.object({
        wikiAutoScan: z.boolean().optional(),
        wikiSourcePriority: z.enum(["ixwiki", "iiwiki", "both"]).optional(),
        wikiDisplayMode: z.enum(["inline", "sidebar", "hidden"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      return ctx.db.userPreferences.upsert({
        where: { userId },
        create: { userId, ...input },
        update: input,
      });
    }),

  // ─── Privacy & Safety Configuration ──────────────────────────────────

  getPrivacySettings: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;

    // 1. Fetch privacy config record
    const configRecord = await ctx.db.userConnection.findFirst({
      where: {
        userId,
        targetUserId: "global_privacy",
        connectionType: "privacy_config",
      },
    });

    let config: PrivacyConfig = DEFAULT_PRIVACY_CONFIG;
    if (configRecord?.status) {
      try {
        const parsed = JSON.parse(configRecord.status);
        config = { ...DEFAULT_PRIVACY_CONFIG, ...parsed };
      } catch {
        config = DEFAULT_PRIVACY_CONFIG;
      }
    }

    // 2. Fetch blocked connections
    const blockedConnections = await ctx.db.userConnection.findMany({
      where: {
        userId,
        connectionType: "blocked",
      },
      orderBy: { createdAt: "desc" },
    });

    const blockedItems = await Promise.all(
      blockedConnections.map(async (c) => {
        let label = "Unknown Account";
        let subtitle = "Blocked User";
        let avatarUrl: string | null = null;

        if (c.targetUserId) {
          const u = await ctx.db.user.findFirst({
            where: {
              OR: [{ id: c.targetUserId }, { clerkUserId: c.targetUserId }],
            },
            include: { country: true },
          });
          if (u) {
            label = u.country?.name || u.wikiUsername || u.discordUsername || "User";
            subtitle = u.country?.slug ? `@${u.country.slug}` : "IxnayID User";
            avatarUrl = u.country?.flag || null;
          }
        } else if (c.targetCountryId) {
          const country = await ctx.db.country.findUnique({
            where: { id: c.targetCountryId },
          });
          if (country) {
            label = country.name;
            subtitle = `@${country.slug || country.name.toLowerCase().replace(/\s+/g, "-")}`;
            avatarUrl = country.flag || null;
          }
        }

        return {
          id: c.id,
          targetUserId: c.targetUserId,
          targetCountryId: c.targetCountryId,
          label,
          subtitle,
          avatarUrl,
          createdAt: c.createdAt,
        };
      })
    );

    // 3. Fetch muted connections
    const mutedConnections = await ctx.db.userConnection.findMany({
      where: {
        userId,
        connectionType: "muted",
      },
      orderBy: { createdAt: "desc" },
    });

    const mutedItems = await Promise.all(
      mutedConnections.map(async (c) => {
        let label = "Unknown Account";
        let subtitle = "Muted Account";

        if (c.targetUserId) {
          const u = await ctx.db.user.findFirst({
            where: {
              OR: [{ id: c.targetUserId }, { clerkUserId: c.targetUserId }],
            },
            include: { country: true },
          });
          if (u) {
            label = u.country?.name || u.wikiUsername || "User";
            subtitle = u.country?.slug ? `@${u.country.slug}` : "Muted User";
          }
        }

        return {
          id: c.id,
          targetUserId: c.targetUserId,
          label,
          subtitle,
          createdAt: c.createdAt,
        };
      })
    );

    // 4. Fetch muted keywords
    const keywordConnections = await ctx.db.userConnection.findMany({
      where: {
        userId,
        connectionType: "keyword",
      },
      orderBy: { createdAt: "desc" },
    });

    const mutedKeywords = keywordConnections.map((c) => ({
      id: c.id,
      keyword: c.status || c.targetUserId || "",
      createdAt: c.createdAt,
    }));

    return {
      config,
      blockedAccounts: blockedItems,
      mutedAccounts: mutedItems,
      mutedKeywords,
    };
  }),

  updatePrivacyConfig: protectedProcedure
    .input(
      z.object({
        directMessages: z.enum(["everyone", "followers", "verified", "nobody"]).optional(),
        messageRequestFiltering: z.boolean().optional(),
        mentions: z.enum(["everyone", "followers", "nobody"]).optional(),
        tradeOffers: z.enum(["everyone", "followers", "nobody"]).optional(),
        thinktankInvites: z.enum(["everyone", "followers", "nobody"]).optional(),
        showOnlineStatus: z.boolean().optional(),
        searchDiscoverable: z.boolean().optional(),
        searchEngineIndexing: z.boolean().optional(),
        dmReadReceipts: z.boolean().optional(),
        diagnosticTelemetry: z.boolean().optional(),
        personalizedRecommendations: z.boolean().optional(),
        showDiscordTag: z.boolean().optional(),
        showWikiAttribution: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      const existingRecord = await ctx.db.userConnection.findFirst({
        where: {
          userId,
          targetUserId: "global_privacy",
          connectionType: "privacy_config",
        },
      });

      let currentConfig: PrivacyConfig = DEFAULT_PRIVACY_CONFIG;
      if (existingRecord?.status) {
        try {
          currentConfig = { ...DEFAULT_PRIVACY_CONFIG, ...JSON.parse(existingRecord.status) };
        } catch {
          currentConfig = DEFAULT_PRIVACY_CONFIG;
        }
      }

      const mergedConfig = { ...currentConfig, ...input };

      if (existingRecord) {
        return ctx.db.userConnection.update({
          where: { id: existingRecord.id },
          data: { status: JSON.stringify(mergedConfig) },
        });
      }

      return ctx.db.userConnection.create({
        data: {
          userId,
          targetUserId: "global_privacy",
          connectionType: "privacy_config",
          status: JSON.stringify(mergedConfig),
        },
      });
    }),

  // ─── Blocking & Muting Management ────────────────────────────────────

  blockAccount: protectedProcedure
    .input(z.object({ identifier: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      const clean = input.identifier.replace(/^@/, "").trim().toLowerCase();

      // Find target user by username or country
      const targetCountry = await ctx.db.country.findFirst({
        where: {
          OR: [
            { name: { equals: clean, mode: "insensitive" } },
            { slug: { equals: clean, mode: "insensitive" } },
          ],
        },
      });

      const targetUser = await ctx.db.user.findFirst({
        where: {
          OR: [
            { wikiUsername: { equals: clean, mode: "insensitive" } },
            { discordUsername: { equals: clean, mode: "insensitive" } },
            { forumUsername: { equals: clean, mode: "insensitive" } },
            ...(targetCountry ? [{ countryId: targetCountry.id }] : []),
          ],
        },
      });

      if (!targetCountry && !targetUser) {
        throw new Error(`Could not find an account matching "${input.identifier}"`);
      }

      const targetUserId = targetUser?.id || targetUser?.clerkUserId || null;
      const targetCountryId = targetCountry?.id || null;

      // Prevent blocking yourself
      if (targetUser?.clerkUserId === userId) {
        throw new Error("You cannot block your own account");
      }

      // Check if already blocked
      const existing = await ctx.db.userConnection.findFirst({
        where: {
          userId,
          connectionType: "blocked",
          OR: [
            ...(targetUserId ? [{ targetUserId }] : []),
            ...(targetCountryId ? [{ targetCountryId }] : []),
          ],
        },
      });

      if (existing) {
        return existing;
      }

      return ctx.db.userConnection.create({
        data: {
          userId,
          targetUserId,
          targetCountryId,
          connectionType: "blocked",
          status: "active",
        },
      });
    }),

  unblockAccount: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      const record = await ctx.db.userConnection.findUnique({
        where: { id: input.connectionId },
      });

      if (!record || record.userId !== userId) {
        throw new Error("Blocked connection record not found");
      }

      return ctx.db.userConnection.delete({
        where: { id: input.connectionId },
      });
    }),

  muteAccount: protectedProcedure
    .input(z.object({ identifier: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      const clean = input.identifier.replace(/^@/, "").trim().toLowerCase();

      const targetUser = await ctx.db.user.findFirst({
        where: {
          OR: [
            { wikiUsername: { equals: clean, mode: "insensitive" } },
            { discordUsername: { equals: clean, mode: "insensitive" } },
            { country: { name: { equals: clean, mode: "insensitive" } } },
            { country: { slug: { equals: clean, mode: "insensitive" } } },
          ],
        },
      });

      if (!targetUser) {
        throw new Error(`Could not find an account matching "${input.identifier}"`);
      }

      if (targetUser.clerkUserId === userId) {
        throw new Error("You cannot mute your own account");
      }

      const existing = await ctx.db.userConnection.findFirst({
        where: {
          userId,
          targetUserId: targetUser.id,
          connectionType: "muted",
        },
      });

      if (existing) return existing;

      return ctx.db.userConnection.create({
        data: {
          userId,
          targetUserId: targetUser.id,
          connectionType: "muted",
          status: "active",
        },
      });
    }),

  unmuteAccount: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      const record = await ctx.db.userConnection.findUnique({
        where: { id: input.connectionId },
      });

      if (!record || record.userId !== userId) {
        throw new Error("Muted connection record not found");
      }

      return ctx.db.userConnection.delete({
        where: { id: input.connectionId },
      });
    }),

  addMutedKeyword: protectedProcedure
    .input(z.object({ keyword: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      const clean = input.keyword.trim().toLowerCase();

      const existing = await ctx.db.userConnection.findFirst({
        where: {
          userId,
          targetUserId: clean,
          connectionType: "keyword",
        },
      });

      if (existing) return existing;

      return ctx.db.userConnection.create({
        data: {
          userId,
          targetUserId: clean,
          connectionType: "keyword",
          status: input.keyword.trim(),
        },
      });
    }),

  removeMutedKeyword: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      const record = await ctx.db.userConnection.findUnique({
        where: { id: input.connectionId },
      });

      if (!record || record.userId !== userId) {
        throw new Error("Keyword filter record not found");
      }

      return ctx.db.userConnection.delete({
        where: { id: input.connectionId },
      });
    }),

  clearSearchHistory: protectedProcedure.mutation(async () => {
    return { success: true, timestamp: new Date().toISOString() };
  }),

  // ─── Data Export (Account & Country Data) ─────────────────────────────

  exportUserData: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { clerkUserId: ctx.auth.userId },
    });

    const country = user?.countryId
      ? await ctx.db.country.findUnique({
          where: { id: user.countryId },
        })
      : null;

    const vault = user?.id
      ? await ctx.db.myVault.findUnique({
          where: { userId: user.id },
        })
      : null;

    const cardCount = user?.id
      ? await ctx.db.cardOwnership.count({
          where: { userId: user.id },
        })
      : 0;

    const preferences = await ctx.db.userPreferences.findUnique({
      where: { userId: ctx.auth.userId },
    });

    const thinkpagesAccount = await ctx.db.thinkpagesAccount.findFirst({
      where: { clerkUserId: ctx.auth.userId },
      include: {
        posts: {
          take: 50,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return {
      exportedAt: new Date().toISOString(),
      user: {
        clerkUserId: user?.clerkUserId,
        membershipTier: user?.membershipTier,
        createdAt: user?.createdAt,
        discordUsername: user?.discordUsername,
        wikiUsername: user?.wikiUsername,
        forumUsername: user?.forumUsername,
      },
      country: country
        ? {
            id: country.id,
            name: country.name,
            slug: country.slug,
            economicTier: country.economicTier,
            populationTier: country.populationTier,
            currentPopulation: country.currentPopulation,
            currentGdpPerCapita: country.currentGdpPerCapita,
            governmentType: country.governmentType,
            leader: country.leader,
            hideDiplomaticOps: country.hideDiplomaticOps,
            hideStratcommIntel: country.hideStratcommIntel,
          }
        : null,
      vault: vault
        ? {
            credits: vault.credits,
            vaultLevel: vault.vaultLevel,
            vaultXp: vault.vaultXp,
            equippedCosmetics: vault.equippedCosmetics,
          }
        : null,
      cardsCount: cardCount,
      preferences: preferences ?? null,
      thinkpages: thinkpagesAccount
        ? {
            username: thinkpagesAccount.username,
            displayName: thinkpagesAccount.displayName,
            postsCount: thinkpagesAccount.posts.length,
            recentPosts: thinkpagesAccount.posts.map((p) => ({
              id: p.id,
              content: p.content,
              createdAt: p.createdAt,
              visibility: p.visibility,
            })),
          }
        : null,
    };
  }),

  // ─── Wiki Author Resolution ──────────────────────────────────────────

  resolveWikiAuthor: rateLimitedPublicProcedure
    .input(z.object({ wikiUsername: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findFirst({
        where: { wikiUsername: input.wikiUsername },
        select: {
          wikiUsername: true,
          role: {
            select: {
              name: true,
              displayName: true,
            },
          },
          country: {
            select: {
              id: true,
              name: true,
              slug: true,
              flag: true,
              economicTier: true,
              leader: true,
              continent: true,
            },
          },
        },
      });

      if (!user) return null;

      return {
        wikiUsername: user.wikiUsername,
        role: user.role
          ? {
              name: user.role.name,
              displayName: user.role.displayName,
            }
          : null,
        country: user.country
          ? {
              id: user.country.id,
              name: user.country.name,
              slug: user.country.slug,
              flag: user.country.flag,
              economicTier: user.country.economicTier,
              leader: user.country.leader,
              continent: user.country.continent,
            }
          : null,
      };
    }),
});
