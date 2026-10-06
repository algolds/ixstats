// src/server/api/routers/users/preferences.ts
// Users preferences, privacy, blocking, and safety router

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedPublicProcedure,
  rateLimitedMutationProcedure,
  createRateLimitMiddleware,
} from "~/server/api/trpc";
import type { PrismaClient } from "@prisma/client";
import { viewerRealmId } from "~/server/api/trpc/realm-scope";
import { switchIsOn } from "~/server/shared/privacy-permissions";
import { recordHeartbeat } from "~/server/shared/presence";
import { clearOwnHistory } from "~/server/shared/clear-history";

/**
 * The nation a player typed: its name within the viewer's realm first, else a (globally unique) slug.
 * IxWorld holds the plain slugs, so slug-first would send an Eurth player's "Gallambria" to IxWorld's
 * owner (ruling E-s).
 */
async function findTypedCountry(
  ctx: Parameters<typeof viewerRealmId>[0] & { db: Pick<PrismaClient, "country"> },
  clean: string
) {
  return (
    (await ctx.db.country.findFirst({
      where: { realmId: await viewerRealmId(ctx), name: { equals: clean, mode: "insensitive" } },
      select: { id: true },
    })) ??
    (await ctx.db.country.findFirst({
      where: { slug: { equals: clean, mode: "insensitive" } },
      select: { id: true },
    }))
  );
}

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
  showDiscordTag: boolean;
  showWikiAttribution: boolean;
}

/**
 * Every key is enforced (SL-4; see server/shared/privacy-permissions.ts). "Anonymous diagnostics"
 * and "Personalized recommendations" were removed: no telemetry is sent anywhere and nothing is
 * recommended, so they had nothing to switch. Stored values for them are ignored.
 */
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
  showDiscordTag: true,
  showWikiAttribution: true,
};

/** The stored config merged over the defaults, keeping only known keys. */
function parsePrivacyConfig(status: string | null | undefined): PrivacyConfig {
  if (!status) return DEFAULT_PRIVACY_CONFIG;
  try {
    const parsed = JSON.parse(status) as Record<string, unknown>;
    const known = Object.keys(DEFAULT_PRIVACY_CONFIG).filter((key) => key in parsed);
    return {
      ...DEFAULT_PRIVACY_CONFIG,
      ...Object.fromEntries(known.map((key) => [key, parsed[key]])),
    };
  } catch {
    return DEFAULT_PRIVACY_CONFIG;
  }
}

/** Clear history may run three times an hour. */
const clearHistoryRateLimit = createRateLimitMiddleware({
  max: 3,
  windowMs: 60 * 60_000,
  namespace: "clear_history",
});

/** Deletes the caller's own connection record; anything else reads as not found. */
async function deleteOwnConnection(
  db: PrismaClient,
  userId: string,
  connectionId: string,
  label: string
) {
  const record = await db.userConnection.findUnique({ where: { id: connectionId } });
  if (!record || record.userId !== userId) {
    throw new Error(`${label} record not found`);
  }
  return db.userConnection.delete({ where: { id: connectionId } });
}

/** The existing connection for (user, target, type), else a newly created one. */
async function findOrCreateConnection(
  db: PrismaClient,
  data: { userId: string; targetUserId: string; connectionType: string; status: string }
) {
  const { status: _status, ...key } = data;
  return (await db.userConnection.findFirst({ where: key })) ?? db.userConnection.create({ data });
}

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

  updateWikiPreferences: rateLimitedMutationProcedure
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

    const config = parsePrivacyConfig(configRecord?.status);

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

  updatePrivacyConfig: rateLimitedMutationProcedure
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

      const mergedConfig = { ...parsePrivacyConfig(existingRecord?.status), ...input };

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

  blockAccount: rateLimitedMutationProcedure
    .input(z.object({ identifier: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      const clean = input.identifier.replace(/^@/, "").trim().toLowerCase();

      // Find target user by username or country (names repeat across realms — ruling E-s).
      const targetCountry = await findTypedCountry(ctx, clean);

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

  unblockAccount: rateLimitedMutationProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(({ ctx, input }) =>
      deleteOwnConnection(ctx.db, ctx.auth.userId, input.connectionId, "Blocked connection")
    ),

  muteAccount: rateLimitedMutationProcedure
    .input(z.object({ identifier: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      const clean = input.identifier.replace(/^@/, "").trim().toLowerCase();
      const targetCountry = await findTypedCountry(ctx, clean);

      const targetUser = await ctx.db.user.findFirst({
        where: {
          OR: [
            { wikiUsername: { equals: clean, mode: "insensitive" } },
            { discordUsername: { equals: clean, mode: "insensitive" } },
            ...(targetCountry ? [{ countryId: targetCountry.id }] : []),
          ],
        },
      });

      if (!targetUser) {
        throw new Error(`Could not find an account matching "${input.identifier}"`);
      }

      if (targetUser.clerkUserId === userId) {
        throw new Error("You cannot mute your own account");
      }

      return findOrCreateConnection(ctx.db, {
        userId,
        targetUserId: targetUser.id,
        connectionType: "muted",
        status: "active",
      });
    }),

  unmuteAccount: rateLimitedMutationProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(({ ctx, input }) =>
      deleteOwnConnection(ctx.db, ctx.auth.userId, input.connectionId, "Muted connection")
    ),

  addMutedKeyword: rateLimitedMutationProcedure
    .input(z.object({ keyword: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      const clean = input.keyword.trim().toLowerCase();

      return findOrCreateConnection(ctx.db, {
        userId,
        targetUserId: clean,
        connectionType: "keyword",
        status: input.keyword.trim(),
      });
    }),

  removeMutedKeyword: rateLimitedMutationProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(({ ctx, input }) =>
      deleteOwnConnection(ctx.db, ctx.auth.userId, input.connectionId, "Keyword filter")
    ),

  /** Clear history (SL-4); exactly what it deletes is listed on `clearOwnHistory`. */
  clearHistory: rateLimitedMutationProcedure
    .use(clearHistoryRateLimit)
    .input(z.object({ confirm: z.literal(true) }))
    .mutation(({ ctx }) => clearOwnHistory(ctx.db, ctx.auth.userId, ctx.user?.id)),

  /** Online status heartbeat (SL-4): signed-in clients call it about once a minute. */
  heartbeat: rateLimitedMutationProcedure.mutation(async ({ ctx }) => {
    await recordHeartbeat(ctx.auth.userId);
    return { ok: true };
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
          clerkUserId: true,
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
      // Wiki attribution off (SL-4): the wiki name is not linked to the user's role or country.
      if (!(await switchIsOn(ctx.db, user.clerkUserId, "showWikiAttribution").catch(() => false))) {
        return { wikiUsername: user.wikiUsername, role: null, country: null };
      }

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
