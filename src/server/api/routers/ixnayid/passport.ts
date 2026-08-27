import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { lookupWikiUser } from "~/lib/wiki-os/adapters/ixstates/user-sync";
import { buildAuthoredArticles, buildWikiActivityFeed } from "./passport-feed";
import { resolvePassportVault } from "./passport-vault";

export const ixnayidPassportRouter = createTRPCRouter({
  // =========================================================================
  // UNIFIED IDENTITY PASSPORT (Digital Passport Query)
  // Consolidates Forum, WikiOS, Multi-Tenant Realms, and MyCountry metadata
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
      const isSelf = cleanId === "me" || (Boolean(viewerClerkId) && cleanId === viewerClerkId);
      const strippedId = cleanId.replace(/_$/, "");

      // 1. Fast Path: Try resolving as Canonical User Identity first
      let viewerPriorityRecord: any = null;
      if (viewerClerkId) {
        const viewerRecord = await db.user.findUnique({
          where: { clerkUserId: viewerClerkId },
          include: {
            role: true,
            country: {
              include: {
                nationalIdentity: true,
                geoProfile: true,
                realm: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        });
        if (viewerRecord) {
          const vWiki = viewerRecord.wikiUsername?.toLowerCase() ?? null;
          const vForum = viewerRecord.forumUsername?.toLowerCase() ?? null;
          const cLower = cleanId.toLowerCase();
          const sLower = strippedId.toLowerCase();
          if (vWiki === cLower || vForum === cLower || vWiki === sLower || vForum === sLower) {
            viewerPriorityRecord = viewerRecord;
          }
        }
      }

      let userRecord: any =
        viewerPriorityRecord ??
        (await db.user.findFirst({
          where: {
            OR: [
              ...(isSelf && viewerClerkId ? [{ clerkUserId: viewerClerkId }] : []),
              { clerkUserId: cleanId },
              { forumUsername: { equals: cleanId, mode: "insensitive" as const } },
              { wikiUsername: { equals: cleanId, mode: "insensitive" as const } },
              { id: cleanId },
              ...(strippedId !== cleanId
                ? [
                    { forumUsername: { equals: strippedId, mode: "insensitive" as const } },
                    { wikiUsername: { equals: strippedId, mode: "insensitive" as const } },
                    { clerkUserId: strippedId },
                  ]
                : []),
            ],
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          include: {
            role: true,
            country: {
              include: {
                nationalIdentity: true,
                geoProfile: true,
                realm: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        }));

      let countryRecord: any = userRecord?.country ?? null;

      if (userRecord?.countryId && !countryRecord) {
        countryRecord = await db.country.findUnique({
          where: { id: userRecord.countryId },
          include: {
            nationalIdentity: true,
            geoProfile: true,
            realm: { select: { id: true, name: true, slug: true } },
          },
        });
      }

      if (userRecord?.clerkUserId && !countryRecord) {
        const tpAccount = await db.thinkpagesAccount.findFirst({
          where: { clerkUserId: userRecord.clerkUserId, isActive: true },
          select: { countryId: true },
        });
        if (tpAccount?.countryId) {
          countryRecord = await db.country.findUnique({
            where: { id: tpAccount.countryId },
            include: {
              nationalIdentity: true,
              geoProfile: true,
              realm: { select: { id: true, name: true, slug: true } },
            },
          });
        }
      }

      // 2. Fallback: If no User directly matched, check if identifier is a Country slug/name
      if (!userRecord) {
        countryRecord = await db.country.findFirst({
          where: {
            OR: [
              { slug: cleanId.toLowerCase() },
              { slug: strippedId.toLowerCase() },
              { name: cleanId },
              { name: strippedId },
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
            realm: { select: { id: true, name: true, slug: true } },
          },
        });

        if (countryRecord?.users?.[0]) {
          userRecord = countryRecord.users[0] as any;
        }
      }

      // 3. Fallback: if still no user/country found, check if identifier is a wiki or forum username
      let resolvedWikiName =
        userRecord?.wikiUsername || countryRecord?.wikiPageTitle || (countryRecord?.name ?? null);
      let resolvedForumUserId = userRecord?.forumUserId ?? null;
      let resolvedForumUsername = userRecord?.forumUsername ?? null;

      if (!userRecord && !countryRecord) {
        const { lookupForumUser } = await import("~/server/modules/forum");
        const forumLookup =
          (await lookupForumUser(cleanId).catch(() => null)) ||
          (strippedId !== cleanId ? await lookupForumUser(strippedId).catch(() => null) : null);
        if (forumLookup) {
          resolvedForumUserId = forumLookup.userId;
          resolvedForumUsername = forumLookup.username;
        }

        const wikiLookup =
          (await lookupWikiUser(cleanId).catch(() => null)) ||
          (strippedId !== cleanId ? await lookupWikiUser(strippedId).catch(() => null) : null);
        if (wikiLookup && wikiLookup.username) {
          resolvedWikiName = wikiLookup.username;
        }

        if (!resolvedWikiName) {
          const stats = await db.lorewardUserStats.findFirst({
            where: {
              OR: [
                { username: { equals: cleanId, mode: "insensitive" } },
                { username: { equals: strippedId, mode: "insensitive" } },
              ],
            },
            select: { username: true },
          });
          if (stats?.username) {
            resolvedWikiName = stats.username;
          } else {
            const rev = await (db as any).wikiRevision.findFirst({
              where: {
                OR: [
                  { author: { equals: cleanId, mode: "insensitive" } },
                  { author: { equals: strippedId, mode: "insensitive" } },
                ],
              },
              select: { author: true },
            });
            if (rev?.author) {
              resolvedWikiName = rev.author;
            }
          }
        }
      }

      if (!countryRecord && !userRecord && !resolvedWikiName && !resolvedForumUserId) {
        return null;
      }

      // 4. Parallel data fetches
      const { getUserInfo, getUserContribs, getUserCreatedPages } =
        await import("~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers");
      const { xfFetch, transformBBCode, cacheKey, cachedFetch } =
        await import("~/server/modules/forum");

      const fetchClerkUser = async () => {
        const targetClerkId =
          userRecord?.clerkUserId || (cleanId.startsWith("user_") ? cleanId : null);
        if (!targetClerkId && !cleanId) return null;
        try {
          const { clerkClient } = await import("@clerk/nextjs/server");
          const client = await clerkClient();
          if (targetClerkId) {
            return await client.users.getUser(targetClerkId).catch(() => null);
          }
          const list = await client.users
            .getUserList({ username: [cleanId, strippedId] })
            .catch(() => null);
          return list?.data?.[0] ?? null;
        } catch {
          return null;
        }
      };

      const [
        wikiInfoRes,
        wikiContribsRes,
        mwCreatedPagesRes,
        loreStatsRes,
        loreAwardsRes,
        forumMemberRes,
        thinkpagesRes,
        clerkUserRes,
      ] = await Promise.allSettled([
        resolvedWikiName ? getUserInfo(resolvedWikiName).catch(() => null) : Promise.resolve(null),
        resolvedWikiName
          ? getUserContribs(resolvedWikiName, 100).catch(() => [])
          : Promise.resolve([]),
        resolvedWikiName
          ? getUserCreatedPages(resolvedWikiName, 100).catch(() => [])
          : Promise.resolve([]),
        resolvedWikiName
          ? db.lorewardUserStats
              .findFirst({ where: { username: { equals: resolvedWikiName, mode: "insensitive" } } })
              .catch(() => null)
          : Promise.resolve(null),
        resolvedWikiName
          ? db.lorewardEntry
              .findMany({
                where: {
                  OR: [
                    { winnerUser: { equals: resolvedWikiName, mode: "insensitive" } },
                    { runnerUpUser: { equals: resolvedWikiName, mode: "insensitive" } },
                  ],
                  status: "approved",
                },
                orderBy: { date: "desc" },
                take: 30,
              })
              .catch(() => [])
          : Promise.resolve([]),
        resolvedForumUserId
          ? cachedFetch(cacheKey("member", resolvedForumUserId), "member", () =>
              xfFetch<{ user: any }>(`/users/${resolvedForumUserId}/`)
            ).catch(() => null)
          : Promise.resolve(null),
        userRecord?.clerkUserId
          ? db.thinkpagesAccount
              .findFirst({ where: { clerkUserId: userRecord.clerkUserId, isActive: true } })
              .catch(() => null)
          : Promise.resolve(null),
        fetchClerkUser(),
      ]);

      const wikiInfo = wikiInfoRes.status === "fulfilled" ? wikiInfoRes.value : null;
      const wikiContribs =
        wikiContribsRes.status === "fulfilled"
          ? Array.isArray(wikiContribsRes.value)
            ? wikiContribsRes.value
            : ((wikiContribsRes.value as any)?.contribs ?? [])
          : [];
      const mwCreatedPages =
        mwCreatedPagesRes.status === "fulfilled" ? (mwCreatedPagesRes.value ?? []) : [];
      const loreStats = loreStatsRes.status === "fulfilled" ? loreStatsRes.value : null;
      const loreAwards = loreAwardsRes.status === "fulfilled" ? (loreAwardsRes.value ?? []) : [];
      const forumData =
        forumMemberRes.status === "fulfilled" ? (forumMemberRes.value?.user ?? null) : null;
      const thinkpagesAccount = thinkpagesRes.status === "fulfilled" ? thinkpagesRes.value : null;
      const clerkUser = clerkUserRes.status === "fulfilled" ? clerkUserRes.value : null;

      let loreRank: number | null = null;
      if (loreStats && loreStats.totalScore > 0) {
        try {
          loreRank =
            (await db.lorewardUserStats.count({
              where: { totalScore: { gt: loreStats.totalScore } },
            })) + 1;
        } catch {}
      }

      if (userRecord && (forumData || wikiInfo)) {
        const syncUpdates: Record<string, any> = {};
        if (
          forumData &&
          (!userRecord.forumUserId || userRecord.forumUserId !== forumData.user_id)
        ) {
          syncUpdates.forumUserId = forumData.user_id;
          syncUpdates.forumUsername = forumData.username;
          syncUpdates.lastForumSync = new Date();
        }
        if (
          wikiInfo &&
          resolvedWikiName &&
          (!userRecord.wikiUsername || userRecord.wikiUsername !== resolvedWikiName)
        ) {
          syncUpdates.wikiUsername = resolvedWikiName;
          syncUpdates.wikiUserId = wikiInfo.user_id ?? null;
          syncUpdates.lastWikiSync = new Date();
        }
        if (Object.keys(syncUpdates).length > 0) {
          db.user
            .update({
              where: { id: userRecord.id },
              data: syncUpdates,
            })
            .catch(() => null);
        }
      }

      let userNations: any[] = [];
      if (userRecord) {
        userNations = await db.country.findMany({
          where: {
            OR: [
              { users: { some: { id: userRecord.id } } },
              ...(userRecord.clerkUserId
                ? [{ users: { some: { clerkUserId: userRecord.clerkUserId } } }]
                : []),
              ...(userRecord.countryId ? [{ id: userRecord.countryId }] : []),
              ...(countryRecord?.id ? [{ id: countryRecord.id }] : []),
              ...(userRecord.forumUsername
                ? [{ leader: { equals: userRecord.forumUsername, mode: "insensitive" as const } }]
                : []),
              ...(userRecord.wikiUsername
                ? [{ leader: { equals: userRecord.wikiUsername, mode: "insensitive" as const } }]
                : []),
              ...(cleanId && cleanId !== "me"
                ? [{ leader: { equals: cleanId, mode: "insensitive" as const } }]
                : []),
            ],
          },
          include: {
            realm: { select: { id: true, name: true, slug: true } },
            nationalIdentity: true,
            geoProfile: true,
          },
          orderBy: { currentTotalGdp: "desc" },
        });

        if (userNations.length === 0 && (countryRecord || userRecord.country)) {
          const fallbackNation = countryRecord || userRecord.country;
          if (fallbackNation) {
            userNations = [fallbackNation];
          }
        }
      } else if (countryRecord) {
        userNations = [countryRecord];
      }

      if (!countryRecord && userNations.length > 0) {
        countryRecord = userNations[0];
      }

      const [
        authoredArticlesRes,
        nativeRevisionsRes,
        wikiCommentsRes,
        conlangsRes,
        sportTeamsRes,
        directivesRes,
      ] = await Promise.allSettled([
        db.wikiArticle
          .findMany({
            where: {
              OR: [
                ...(userRecord?.id
                  ? [{ authorId: userRecord.id }, { lastEditorId: userRecord.id }]
                  : []),
                ...(resolvedWikiName
                  ? [
                      { title: { contains: resolvedWikiName, mode: "insensitive" as const } },
                      { slug: { contains: resolvedWikiName.toLowerCase() } },
                    ]
                  : []),
                ...(cleanId && cleanId !== "me"
                  ? [
                      { title: { contains: cleanId, mode: "insensitive" as const } },
                      { slug: { contains: cleanId.toLowerCase() } },
                    ]
                  : []),
              ],
            },
            take: 100,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              slug: true,
              title: true,
              summary: true,
              updatedAt: true,
              createdAt: true,
            },
          })
          .catch(() => []),
        db.wikiRevision
          .findMany({
            where: {
              OR: [
                ...(userRecord?.id ? [{ authorId: userRecord.id }] : []),
                ...(resolvedWikiName
                  ? [{ author: { equals: resolvedWikiName, mode: "insensitive" as const } }]
                  : []),
                ...(cleanId && cleanId !== "me"
                  ? [{ author: { equals: cleanId, mode: "insensitive" as const } }]
                  : []),
              ],
            },
            take: 100,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              articleId: true,
              summary: true,
              minor: true,
              author: true,
              createdAt: true,
              article: {
                select: { id: true, title: true, slug: true, summary: true },
              },
            },
          })
          .catch(() => []),
        db.wikiDiscussionComment
          .findMany({
            where: {
              OR: [
                ...(userRecord?.id ? [{ userId: userRecord.id }] : []),
                ...(userRecord?.clerkUserId ? [{ userId: userRecord.clerkUserId }] : []),
              ],
            },
            take: 30,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              content: true,
              userId: true,
              createdAt: true,
              thread: {
                select: { id: true, articleTitle: true, title: true },
              },
            },
          })
          .catch(() => []),
        userRecord?.id
          ? db.languagePack
              .findMany({
                where: { userId: userRecord.id },
                take: 20,
                select: {
                  id: true,
                  name: true,
                  description: true,
                  culturalFamily: true,
                  slug: true,
                },
              })
              .catch(() => [])
          : Promise.resolve([]),
        userNations.length > 0
          ? db.sportTeam
              .findMany({
                where: { nationId: { in: userNations.map((n) => n.id) } },
                take: 20,
                select: { id: true, name: true, shortName: true, city: true, logo: true },
              })
              .catch(() => [])
          : Promise.resolve([]),
        userNations.length > 0
          ? db.intent
              .findMany({
                where: { countryId: { in: userNations.map((n) => n.id) } },
                take: 20,
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  goal: true,
                  tier: true,
                  category: true,
                  status: true,
                  summary: true,
                  createdAt: true,
                },
              })
              .catch(() => [])
          : Promise.resolve([]),
      ]);

      const rawAuthored =
        authoredArticlesRes.status === "fulfilled" ? (authoredArticlesRes.value ?? []) : [];
      const nativeRevisions =
        nativeRevisionsRes.status === "fulfilled" ? (nativeRevisionsRes.value ?? []) : [];
      const wikiComments =
        wikiCommentsRes.status === "fulfilled" ? (wikiCommentsRes.value ?? []) : [];

      const authoredArticles = buildAuthoredArticles(rawAuthored, mwCreatedPages);
      const wikiActivityFeed = buildWikiActivityFeed(
        nativeRevisions,
        wikiContribs,
        wikiComments,
        loreAwards,
        resolvedWikiName
      );

      const conlangs = conlangsRes.status === "fulfilled" ? (conlangsRes.value ?? []) : [];
      const sportTeams = sportTeamsRes.status === "fulfilled" ? (sportTeamsRes.value ?? []) : [];
      const directives = directivesRes.status === "fulfilled" ? (directivesRes.value ?? []) : [];

      const historyEvents: Array<any> = [];
      for (const item of wikiActivityFeed) {
        historyEvents.push({
          id: `hist-${item.id}`,
          system: "wikios",
          type: item.type === "publish" ? "wikios.article_published" : "wikios.article_revised",
          title: `${item.type === "publish" ? "Published" : item.type === "laurel" ? "Earned Laurel on" : item.type === "discussion" ? "Participated in" : "Edited"} "${item.title}"`,
          description:
            item.summary ||
            (item.byteDiff
              ? `${item.byteDiff > 0 ? `+${item.byteDiff}` : item.byteDiff} bytes`
              : "WikiOS Contribution"),
          timestamp: item.timestamp,
          objectUrl: item.url,
        });
      }

      for (const dir of directives) {
        historyEvents.push({
          id: `dir-${dir.id}`,
          system: "mycountry",
          type: "mycountry.directive_enacted",
          title: `Enacted Directive: ${dir.goal}`,
          description: `Category: ${dir.category || "Governance"} · Tier: ${dir.tier} · Status: ${dir.status}`,
          timestamp: new Date(dir.createdAt).toISOString(),
          objectUrl: "/mycountry",
        });
      }

      if (userRecord?.createdAt) {
        historyEvents.push({
          id: `account-joined`,
          system: "realm",
          type: "realm.joined",
          title: "Established IxStates Identity",
          description: "Registered canonical digital passport on IxStates",
          timestamp: new Date(userRecord.createdAt).toISOString(),
          objectUrl: `/id/@${cleanId}`,
        });
      }

      historyEvents.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const isOwner = Boolean(viewerClerkId && userRecord?.clerkUserId === viewerClerkId);
      const realmsList = userNations.map((c: any) => ({
        id: c.realmId ?? "default",
        name: c.realm?.name ?? (c.realmId === "default" || !c.realmId ? "IxEarth" : "Custom Realm"),
        slug: c.realm?.slug ?? (c.realmId === "default" || !c.realmId ? "ixearth" : "custom-realm"),
        role: userRecord?.role?.displayName ?? "Leader",
        isFeatured: Boolean(
          (countryRecord && countryRecord.id === c.id) ||
          (userRecord && userRecord.countryId === c.id)
        ),
        country: {
          id: c.id,
          name: c.name,
          slug: c.slug ?? c.name.toLowerCase().replace(/ /g, "_"),
          flagUrl: c.flag ?? null,
          coatOfArmsUrl: c.coatOfArms ?? null,
          currentPopulation: c.currentPopulation ?? 0,
          currentTotalGdp: c.currentTotalGdp ?? 0,
          currentGdpPerCapita: c.currentGdpPerCapita ?? 0,
          continent: c.continent ?? null,
          region: c.region ?? null,
          governmentType: c.governmentType ?? null,
          currentPublicApproval: c.currentPublicApproval ?? c.publicApproval ?? 72,
          currentStability: c.currentStability ?? c.stability ?? 0.82,
        },
      }));

      const vaultData = await resolvePassportVault(userRecord?.id);

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
        realms: realmsList,
        nations: userNations.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug ?? c.name.toLowerCase().replace(/ /g, "_"),
          realmId: c.realmId ?? "default",
          realmName:
            c.realm?.name ?? (c.realmId === "default" || !c.realmId ? "IxEarth" : "Custom Realm"),
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
        work: {
          authoredArticles,
          conlangs,
          sportTeams,
          directives,
          wikiActivityFeed,
          totalCreations:
            authoredArticles.length +
            conlangs.length +
            sportTeams.length +
            directives.length +
            wikiActivityFeed.length,
        },
        history: historyEvents,
        account: {
          userId: userRecord?.id ?? null,
          clerkUserId: userRecord?.clerkUserId ?? clerkUser?.id ?? null,
          membershipTier: userRecord?.membershipTier ?? "basic",
          roleName: userRecord?.role?.displayName ?? userRecord?.role?.name ?? null,
          isOwner,
          canManage: isOwner,
          createdAt: userRecord?.createdAt
            ? new Date(userRecord.createdAt).toISOString()
            : clerkUser?.createdAt
              ? new Date(clerkUser.createdAt).toISOString()
              : null,
          clerkUsername: clerkUser?.username ?? null,
          clerkDisplayName: clerkUser
            ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
              clerkUser.username ||
              null
            : null,
          clerkImageUrl: clerkUser?.imageUrl ?? null,
        },
        wiki: {
          linked: Boolean(wikiInfo?.exists || resolvedWikiName),
          username: resolvedWikiName,
          registration: wikiInfo?.registration ?? wikiInfo?.user_registration ?? null,
          editCount: wikiInfo?.editCount ?? wikiInfo?.user_editcount ?? wikiContribs?.length ?? 0,
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
            revid: c.rev_id || c.revid || 0,
            title: c.page_title || c.title || "",
            timestamp: c.rev_timestamp || c.timestamp || new Date().toISOString(),
            size: c.rev_len || c.size || 0,
            minor: Boolean(c.rev_minor_edit ?? c.minor),
            isNew: Boolean(c.is_new ?? c.isNew),
            comment: c.rev_comment ?? c.comment ?? null,
          })),
          awardHistory: loreAwards.map((e: any) => {
            const isWinner =
              resolvedWikiName && e.winnerUser?.toLowerCase() === resolvedWikiName.toLowerCase();
            return {
              id: e.id,
              date: e.date,
              type: e.type,
              role: (isWinner ? "winner" : "runner-up") as "winner" | "runner-up",
              page:
                (isWinner ? e.winnerPage : e.runnerUpPage) ||
                e.winnerPage ||
                e.runnerUpPage ||
                null,
              score:
                (isWinner ? e.winnerScore : e.runnerUpScore) ||
                e.winnerScore ||
                e.runnerUpScore ||
                null,
            };
          }),
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
        vault: vaultData,
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
