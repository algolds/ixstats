// src/server/api/routers/ixnayid.ts
// IxnayID — Unified account linking across Forum, Wiki, and Discord.
// Consolidates all external identity connections in one namespace.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { lookupWikiUser, linkWikiAccount } from "~/lib/wiki-os/adapters/ixstates/user-sync";
import { linkDiscordAccount } from "~/lib/discord/user-sync";
import { linkForumAccount } from "~/server/modules/forum";

export const ixnayidRouter = createTRPCRouter({
  // =========================================================================
  // STATUS — all linked accounts at once
  // =========================================================================

  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        clerkUserId: true,
        forumUserId: true,
        forumUsername: true,
        lastForumSync: true,
        wikiUserId: true,
        wikiUsername: true,
        lastWikiSync: true,
        discordUserId: true,
        discordUsername: true,
        lastDiscordSync: true,
        country: { select: { name: true, slug: true } },
      },
    });

    const activeWikiName = user?.wikiUsername || user?.country?.name || null;
    const passportHandle = user?.forumUsername || user?.wikiUsername || user?.clerkUserId || user?.id || null;

    return {
      passportHandle,
      countrySlug: user?.country?.slug ?? (user?.country?.name ? user.country.name.toLowerCase().replace(/ /g, "_") : null),
      forum: {
        linked: !!user?.forumUserId || !!user?.forumUsername,
        username: user?.forumUsername ?? null,
        lastSync: user?.lastForumSync ?? null,
      },
      wiki: {
        linked: !!activeWikiName,
        username: activeWikiName,
        isCustomClaimed: !!user?.wikiUsername,
        lastSync: user?.lastWikiSync ?? null,
      },
      discord: {
        linked: !!user?.discordUserId,
        userId: user?.discordUserId ?? null,
        username: user?.discordUsername ?? null,
        lastSync: user?.lastDiscordSync ?? null,
      },
    };
  }),

  // =========================================================================
  // WIKI LINKING
  // =========================================================================

  linkWiki: protectedProcedure
    .input(z.object({ wikiUsername: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const result = await linkWikiAccount(ctx.user.id, input.wikiUsername, ctx.auth.userId);

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error ?? "Failed to link wiki account",
        });
      }

      return { success: true, wikiUsername: result.wikiUsername };
    }),

  unlinkWiki: protectedProcedure.mutation(async ({ ctx }) => {
    await db.user.update({
      where: { id: ctx.user.id },
      data: {
        wikiUserId: null,
        wikiUsername: null,
        lastWikiSync: null,
      },
    });
    return { success: true };
  }),

  // =========================================================================
  // DISCORD LINKING
  // =========================================================================

  linkDiscord: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await linkDiscordAccount(ctx.user.id, ctx.auth.userId);

    if (!result.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: result.error ?? "Failed to link Discord account",
      });
    }

    return {
      success: true,
      discordUserId: result.discordUserId,
      discordUsername: result.discordUsername,
    };
  }),

  unlinkDiscord: protectedProcedure.mutation(async ({ ctx }) => {
    await db.user.update({
      where: { id: ctx.user.id },
      data: {
        discordUserId: null,
        discordUsername: null,
        lastDiscordSync: null,
      },
    });
    return { success: true };
  }),

  // =========================================================================
  // FORUM LINKING (delegates to existing service)
  // =========================================================================

  linkForum: protectedProcedure
    .input(z.object({ forumUsername: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const result = await linkForumAccount(ctx.user.id, input.forumUsername, ctx.auth.userId);

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error ?? "Failed to link forum account",
        });
      }

      return { success: true, forumUserId: result.forumUserId };
    }),

  unlinkForum: protectedProcedure.mutation(async ({ ctx }) => {
    await db.user.update({
      where: { id: ctx.user.id },
      data: {
        forumUserId: null,
        forumUsername: null,
        lastForumSync: null,
      },
    });
    return { success: true };
  }),

  // =========================================================================
  // LOOKUP — preview before linking
  // =========================================================================

  lookupWikiUser: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const result = await lookupWikiUser(input.username);
      return result;
    }),

  lookupForumUser: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const { lookupForumUser } = await import("~/server/modules/forum");
      return lookupForumUser(input.username);
    }),

  // =========================================================================
  // UNIFIED PROFILE RESOLVER — Country + WikiOS + Forum + Vault + ThinkPages
  // =========================================================================

  getUnifiedProfile: publicProcedure
    .input(
      z.object({
        identifier: z.string().min(1).max(200),
      })
    )
    .query(async ({ ctx, input }) => {
      const cleanId = input.identifier.replace(/^@/, "").trim();
      const viewerClerkId = ctx.auth?.userId ?? null;

      // 1. Try resolving as Country first (by slug, name, or id)
      let countryRecord = await db.country.findFirst({
        where: {
          OR: [
            { slug: cleanId.toLowerCase() },
            { name: cleanId },
            { id: cleanId },
            { wikiPageTitle: cleanId },
          ],
        },
        include: {
          users: {
            where: { isActive: true },
            take: 1,
            include: {
              role: true,
            },
          },
          nationalIdentity: true,
          geoProfile: true,
        },
      });

      let userRecord = countryRecord?.users?.[0] ?? null;

      // 2. If no country matched (or country has no users), check User by clerkUserId, wikiUsername, forumUsername, id
      if (!userRecord) {
        const foundUser = await db.user.findFirst({
          where: {
            OR: [
              { clerkUserId: cleanId },
              { wikiUsername: cleanId },
              { forumUsername: cleanId },
              { id: cleanId },
            ],
          },
          include: {
            role: true,
            country: {
              include: {
                nationalIdentity: true,
                geoProfile: true,
              },
            },
          },
        });

        if (foundUser) {
          userRecord = foundUser as any;
          if (foundUser.country && !countryRecord) {
            countryRecord = foundUser.country as any;
          }
        }
      }

      // 3. Fallback: if still no user/country found, check if identifier is a wiki or forum username
      let resolvedWikiName = userRecord?.wikiUsername || (countryRecord?.name ?? null);
      let resolvedForumUserId = userRecord?.forumUserId ?? null;
      let resolvedForumUsername = userRecord?.forumUsername ?? null;

      if (!userRecord && !countryRecord) {
        // Try looking up forum or wiki user to allow citizen preview
        const { lookupForumUser } = await import("~/server/modules/forum");
        const forumLookup = await lookupForumUser(cleanId).catch(() => null);
        if (forumLookup) {
          resolvedForumUserId = forumLookup.userId;
          resolvedForumUsername = forumLookup.username;
        }

        const wikiLookup = await lookupWikiUser(cleanId).catch(() => null);
        if (wikiLookup && wikiLookup.username) {
          resolvedWikiName = wikiLookup.username;
        }
      }

      // If absolutely nothing exists for this identifier, return not-found
      if (!countryRecord && !userRecord && !resolvedWikiName && !resolvedForumUserId) {
        return null;
      }

      // 4. Parallel data fetches for Wiki, Forum, Lorewards, ThinkPages, and Vault
      const { getUserInfo, getUserContribs } = await import(
        "~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers"
      );
      const { xfFetch, transformBBCode, cacheKey, cachedFetch } = await import(
        "~/server/modules/forum"
      );

      const [wikiInfoRes, wikiContribsRes, loreStatsRes, loreAwardsRes, forumMemberRes, thinkpagesRes] =
        await Promise.allSettled([
          // Wiki Info
          resolvedWikiName
            ? getUserInfo(resolvedWikiName).catch(() => null)
            : Promise.resolve(null),
          // Wiki Contribs
          resolvedWikiName
            ? getUserContribs(resolvedWikiName, 15).catch(() => ({ contribs: [] }))
            : Promise.resolve({ contribs: [] }),
          // Loreward stats
          resolvedWikiName
            ? db.lorewardUserStats
                .findUnique({
                  where: { username: resolvedWikiName },
                })
                .catch(() => null)
            : Promise.resolve(null),
          // Loreward award history
          resolvedWikiName
            ? db.lorewardEntry
                .findMany({
                  where: {
                    OR: [{ winnerUser: resolvedWikiName }, { runnerUpUser: resolvedWikiName }],
                    status: "approved",
                  },
                  orderBy: { date: "desc" },
                  take: 10,
                })
                .catch(() => [])
            : Promise.resolve([]),
          // Forum Member
          resolvedForumUserId
            ? cachedFetch(
                cacheKey("member", resolvedForumUserId),
                "member",
                () => xfFetch<{ user: any }>(`/users/${resolvedForumUserId}/`)
              ).catch(() => null)
            : Promise.resolve(null),
          // ThinkPages Account
          userRecord?.clerkUserId
            ? db.thinkpagesAccount
                .findFirst({
                  where: { clerkUserId: userRecord.clerkUserId, isActive: true },
                })
                .catch(() => null)
            : Promise.resolve(null),
        ]);

      const wikiInfo = wikiInfoRes.status === "fulfilled" ? wikiInfoRes.value : null;
      const wikiContribs =
        wikiContribsRes.status === "fulfilled" ? wikiContribsRes.value?.contribs ?? [] : [];
      const loreStats = loreStatsRes.status === "fulfilled" ? loreStatsRes.value : null;
      const loreAwards = loreAwardsRes.status === "fulfilled" ? loreAwardsRes.value ?? [] : [];
      const forumData = forumMemberRes.status === "fulfilled" ? forumMemberRes.value?.user ?? null : null;
      const thinkpagesAccount = thinkpagesRes.status === "fulfilled" ? thinkpagesRes.value : null;

      // Loreward rank calculation
      let loreRank: number | null = null;
      if (loreStats && loreStats.totalScore > 0) {
        try {
          loreRank =
            (await db.lorewardUserStats.count({
              where: { totalScore: { gt: loreStats.totalScore } },
            })) + 1;
        } catch {}
      }

      // Find all nations owned by this user across all realms (Multi-Realm Sovereign Portfolio)
      let userNations: any[] = [];
      if (userRecord) {
        userNations = await db.country.findMany({
          where: {
            OR: [
              { users: { some: { id: userRecord.id } } },
              ...(userRecord.clerkUserId
                ? [{ users: { some: { clerkUserId: userRecord.clerkUserId } } }]
                : []),
            ],
          },
          include: {
            realm: { select: { id: true, name: true } },
          },
          orderBy: { currentTotalGdp: "desc" },
        });
      } else if (countryRecord) {
        userNations = [countryRecord];
      }

      const isOwner = Boolean(viewerClerkId && userRecord?.clerkUserId === viewerClerkId);

      return {
        country: countryRecord
          ? {
              id: countryRecord.id,
              name: countryRecord.name,
              slug: countryRecord.slug ?? countryRecord.name.toLowerCase().replace(/ /g, "_"),
              flagUrl: countryRecord.flag ?? null,
              coatOfArmsUrl: countryRecord.coatOfArms ?? null,
              leader: countryRecord.leader ?? null,
              governmentType: countryRecord.governmentType ?? null,
              continent: countryRecord.continent ?? null,
              region: countryRecord.region ?? null,
              macroeconomics: {
                population: countryRecord.currentPopulation ?? 0,
                gdpPerCapita: countryRecord.currentGdpPerCapita ?? 0,
                totalGdp: countryRecord.currentTotalGdp ?? 0,
                adjustedGrowth: countryRecord.adjustedGdpGrowth ?? 0,
                economicTier: countryRecord.economicTier ?? "Unknown",
                populationTier: countryRecord.populationTier ?? "Unknown",
                landArea: countryRecord.landArea ?? null,
              },
              nationalIdentity: countryRecord.nationalIdentity ?? null,
              isMapped: Boolean(countryRecord.centroid || countryRecord.geoProfile),
            }
          : null,
        nations: userNations.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug ?? c.name.toLowerCase().replace(/ /g, "_"),
          realmId: c.realmId ?? "default",
          realmName: c.realm?.name ?? (c.realmId === "default" ? "IxWorld" : "Custom Realm"),
          flagUrl: c.flag ?? null,
          coatOfArmsUrl: c.coatOfArms ?? null,
          currentPopulation: c.currentPopulation ?? 0,
          currentTotalGdp: c.currentTotalGdp ?? 0,
          currentGdpPerCapita: c.currentGdpPerCapita ?? 0,
          continent: c.continent ?? null,
          region: c.region ?? null,
          governmentType: c.governmentType ?? null,
          isFlagship: Boolean(
            (countryRecord && countryRecord.id === c.id) ||
              (userRecord && userRecord.countryId === c.id)
          ),
        })),
        account: {
          userId: userRecord?.id ?? null,
          clerkUserId: userRecord?.clerkUserId ?? null,
          membershipTier: userRecord?.membershipTier ?? "basic",
          roleName: userRecord?.role?.displayName ?? userRecord?.role?.name ?? null,
          isOwner,
          canManage: isOwner,
          createdAt: userRecord?.createdAt ? new Date(userRecord.createdAt).toISOString() : null,
        },
        wiki: {
          linked: Boolean(wikiInfo?.exists || resolvedWikiName),
          username: resolvedWikiName,
          registration: wikiInfo?.registration ?? null,
          editCount: wikiInfo?.editCount ?? 0,
          groups: wikiInfo?.groups ?? [],
          lorewards: loreStats
            ? {
                totalScore: loreStats.totalScore,
                totalBytes: loreStats.totalBytes,
                rank: loreRank,
                dailyWins: loreStats.dailyWins,
                dailyRunnerUps: loreStats.dailyRunnerUps,
                weeklyWins: loreStats.weeklyWins,
                monthlyWins: loreStats.monthlyWins,
                currentStreak: loreStats.currentStreak,
                longestStreak: loreStats.longestStreak,
              }
            : null,
          recentEdits: wikiContribs.map((c: any) => ({
            revid: c.revid,
            title: c.title,
            timestamp: c.timestamp,
            size: c.size,
            minor: Boolean(c.minor),
            isNew: Boolean(c.isNew),
          })),
          awardHistory: loreAwards.map((e: any) => ({
            date: e.date,
            type: e.type,
            role: (e.winnerUser === resolvedWikiName ? "winner" : "runner-up") as "winner" | "runner-up",
            page: e.pageTitle ?? null,
            score: e.score ?? null,
          })),
        },
        forum: {
          linked: Boolean(forumData || resolvedForumUserId),
          userId: forumData?.user_id ?? resolvedForumUserId,
          username: forumData?.username ?? resolvedForumUsername,
          userTitle: forumData?.user_title ?? null,
          avatarUrl: forumData?.avatar_urls?.l ?? forumData?.avatar_urls?.m ?? null,
          isStaff: Boolean(forumData?.is_staff),
          messageCount: forumData?.message_count ?? 0,
          reactionScore: forumData?.reaction_score ?? 0,
          trophyPoints: forumData?.trophy_points ?? 0,
          joinedDate: forumData?.register_date ?? null,
          location: forumData?.location ?? null,
          aboutHtml: forumData?.about ? transformBBCode(forumData.about).contentHtml : null,
          customFields: forumData?.custom_fields ?? null,
        },
        vault: {
          totalCards: userRecord?.totalCards ?? 0,
          deckValue: userRecord?.deckValue ?? 0,
          collectorLevel: userRecord?.collectorLevel ?? 1,
          collectorXp: userRecord?.collectorXp ?? 0,
        },
        thinkpages: {
          linked: Boolean(thinkpagesAccount),
          username: thinkpagesAccount?.username ?? null,
          displayName: thinkpagesAccount?.displayName ?? null,
          bio: thinkpagesAccount?.bio ?? null,
          avatarUrl: thinkpagesAccount?.profileImageUrl ?? null,
          postCount: thinkpagesAccount?.postCount ?? 0,
          followerCount: thinkpagesAccount?.followerCount ?? 0,
        },
        discord: {
          linked: Boolean(userRecord?.discordUserId),
          username: userRecord?.discordUsername ?? null,
        },
      };
    }),
});
