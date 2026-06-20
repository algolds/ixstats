// src/server/api/routers/activities.ts
// Activities router for live activity feed system

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getRecentChanges as getWikiBridgeRecentChanges } from "~/lib/wiki-bridge";
import { getForumActivity } from "~/server/modules/forum";

// Input schemas
const activityFilterSchema = z.object({
  limit: z.number().min(1).max(80).default(20),
  cursor: z.string().optional(),
  filter: z
    .enum(["all", "achievements", "diplomatic", "economic", "social", "meta"])
    .default("all"),
  category: z.enum(["all", "game", "platform", "social"]).default("all"),
  userId: z.string().optional(),
});

const createActivitySchema = z.object({
  type: z.enum(["achievement", "diplomatic", "economic", "social", "meta"]),
  category: z.enum(["game", "platform", "social"]).default("game"),
  userId: z.string().optional(),
  countryId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  metadata: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])
    )
    .optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  visibility: z.enum(["public", "followers", "friends"]).default("public"),
  relatedCountries: z.array(z.string()).optional(),
});

const engagementActionSchema = z.object({
  activityId: z.string(),
  action: z.string(),
  userId: z.string(),
});

const commentActionSchema = z.object({
  activityId: z.string(),
  userId: z.string(),
  content: z.string().min(1).max(2000),
});

const getUserEngagementSchema = z.object({
  activityIds: z.array(z.string()),
  userId: z.string(),
});

export const activitiesFeedHeadlinesRouter = createTRPCRouter({
  // Test mutation to debug parameter passing

  // Get global activity feed

  // Get feed from countries the user follows

  // Get user-specific activity feed

  // Create new activity

  // Handle engagement actions (like, unlike, share, view)

  // Add comment to activity

  // Get comments for an activity

  // Get user engagement state for activities

  // Get trending topics based on activity data

  // Get activity statistics

  // Get country-specific activity feed combining ActivityFeed and ThinkPages posts

  // Country Follow System
  // Follow a country

  // Unfollow a country

  // Get countries that a country is following

  // Get countries that follow a country (followers)

  // Check if a country is following another

  // Get follow statistics for a country

  /**
   * Global headlines engine — aggregates live data from multiple game systems
   * into short, news-style headlines for the ThinkPages ticker.
   * Pulls from: countries (economic stats), crisis events, diplomatic events,
   * embassy missions, ThinkPages government/media posts, and security threats.
   */
  getGlobalHeadlines: publicProcedure
    .input(
      z.object({
        limit: z.number().min(5).max(60).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      type Headline = {
        id: string;
        text: string;
        category:
          | "economic"
          | "crisis"
          | "diplomatic"
          | "military"
          | "social"
          | "political"
          | "achievement"
          | "wiki"
          | "forum";
        priority: "critical" | "high" | "medium" | "low";
        timestamp: string;
        url?: string;
      };

      const headlines: Headline[] = [];

      // ── 1. Country economic snapshots (GDP leaders, growth, decline) ──
      const [topGdp, fastGrowth, declining, highPop] = await Promise.all([
        ctx.db.country.findMany({
          orderBy: { currentTotalGdp: "desc" },
          take: 5,
          select: {
            id: true,
            name: true,
            currentTotalGdp: true,
            currentGdpPerCapita: true,
            economicTier: true,
            updatedAt: true,
          },
        }),
        ctx.db.country.findMany({
          where: { adjustedGdpGrowth: { gt: 0.025 } },
          orderBy: { adjustedGdpGrowth: "desc" },
          take: 5,
          select: {
            id: true,
            name: true,
            adjustedGdpGrowth: true,
            economicTier: true,
            updatedAt: true,
          },
        }),
        ctx.db.country.findMany({
          where: { adjustedGdpGrowth: { lt: -0.005 } },
          orderBy: { adjustedGdpGrowth: "asc" },
          take: 3,
          select: { id: true, name: true, adjustedGdpGrowth: true, updatedAt: true },
        }),
        ctx.db.country.findMany({
          where: { currentPopulation: { gt: 100_000_000 } },
          orderBy: { currentPopulation: "desc" },
          take: 3,
          select: {
            id: true,
            name: true,
            currentPopulation: true,
            populationGrowthRate: true,
            updatedAt: true,
          },
        }),
      ]);

      // Format GDP
      const fmtGdp = (v: number) => {
        if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
        if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
        if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
        return `$${v.toLocaleString()}`;
      };
      const fmtPop = (v: number) => {
        if (v >= 1e9) return `${Math.round(v / 1e9)}B`;
        if (v >= 1e6) return `${Math.round(v / 1e6)}M`;
        return Math.round(v).toLocaleString();
      };

      const wikiUrl = (name: string) => `/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`;

      topGdp.forEach((c, i) => {
        headlines.push({
          id: `gdp_rank_${c.id}`,
          text: `${c.name} holds #${i + 1} global GDP at ${fmtGdp(c.currentTotalGdp)} (${c.economicTier})`,
          category: "economic",
          priority: i === 0 ? "high" : "medium",
          timestamp: c.updatedAt.toISOString(),
          url: wikiUrl(c.name),
        });
      });

      fastGrowth.forEach((c) => {
        headlines.push({
          id: `growth_${c.id}`,
          text: `${c.name} reports ${(c.adjustedGdpGrowth * 100).toFixed(1)}% GDP growth — ${c.economicTier} economy accelerating`,
          category: "economic",
          priority: c.adjustedGdpGrowth > 0.05 ? "high" : "medium",
          timestamp: c.updatedAt.toISOString(),
          url: wikiUrl(c.name),
        });
      });

      declining.forEach((c) => {
        headlines.push({
          id: `decline_${c.id}`,
          text: `Economic contraction: ${c.name} GDP shrinks ${(Math.abs(c.adjustedGdpGrowth) * 100).toFixed(1)}%`,
          category: "economic",
          priority: c.adjustedGdpGrowth < -0.02 ? "high" : "medium",
          timestamp: c.updatedAt.toISOString(),
          url: wikiUrl(c.name),
        });
      });

      highPop.forEach((c) => {
        headlines.push({
          id: `pop_${c.id}`,
          text: `${c.name} population reaches ${fmtPop(c.currentPopulation)} — growth at ${(c.populationGrowthRate * 100).toFixed(1)}%`,
          category: "economic",
          priority: "low",
          timestamp: c.updatedAt.toISOString(),
          url: wikiUrl(c.name),
        });
      });

      // ── 2. Active crisis events ──
      const crises = await ctx.db.crisisEvent.findMany({
        where: {
          responseStatus: { in: ["pending", "in_progress", "monitoring"] },
        },
        orderBy: [{ severity: "desc" }, { timestamp: "desc" }],
        take: 8,
      });

      crises.forEach((crisis) => {
        const severityMap: Record<string, "critical" | "high" | "medium" | "low"> = {
          critical: "critical",
          high: "high",
          medium: "medium",
          low: "low",
        };
        const prefix =
          crisis.severity === "critical"
            ? "BREAKING"
            : crisis.severity === "high"
              ? "ALERT"
              : "UPDATE";
        headlines.push({
          id: `crisis_${crisis.id}`,
          text: `${prefix}: ${crisis.title}${crisis.location ? ` — ${crisis.location}` : ""}`,
          category: "crisis",
          priority: severityMap[crisis.severity ?? "medium"] ?? "medium",
          timestamp: crisis.timestamp.toISOString(),
        });
      });

      // ── 3. Recent diplomatic events ──
      const diplomaticEvents = await ctx.db.diplomaticEvent.findMany({
        where: { createdAt: { gte: last48h } },
        orderBy: { createdAt: "desc" },
        take: 8,
      });

      // Resolve country names for diplomatic events
      const diploCountryIds = new Set<string>();
      diplomaticEvents.forEach((e) => {
        diploCountryIds.add(e.country1Id);
        if (e.country2Id) diploCountryIds.add(e.country2Id);
      });
      const diploCountries =
        diploCountryIds.size > 0
          ? await ctx.db.country.findMany({
              where: { id: { in: [...diploCountryIds] } },
              select: { id: true, name: true },
            })
          : [];
      const diploMap = new Map(diploCountries.map((c) => [c.id, c.name]));

      diplomaticEvents.forEach((event) => {
        const c1 = diploMap.get(event.country1Id) ?? "Unknown";
        const c2 = event.country2Id ? diploMap.get(event.country2Id) : null;
        const eventLabel = event.eventType?.replace(/_/g, " ") ?? "diplomatic exchange";
        const text = c2
          ? `${c1} and ${c2}: ${event.title || eventLabel}`
          : `${c1}: ${event.title || eventLabel}`;
        headlines.push({
          id: `diplo_${event.id}`,
          text,
          category: "diplomatic",
          priority: event.severity === "high" || event.severity === "critical" ? "high" : "medium",
          timestamp: event.createdAt.toISOString(),
          url: wikiUrl(c1),
        });
      });

      // ── 4. Embassy missions (completed/in-progress) ──
      const missions = await ctx.db.embassyMission.findMany({
        where: {
          OR: [
            { status: "in_progress", updatedAt: { gte: last48h } },
            { status: "completed", updatedAt: { gte: last48h } },
          ],
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
        include: {
          embassy: {
            include: {
              hostCountry: { select: { name: true } },
              guestCountry: { select: { name: true } },
            },
          },
        },
      });

      missions.forEach((mission) => {
        const host = mission.embassy?.hostCountry?.name ?? "Unknown";
        const guest = mission.embassy?.guestCountry?.name ?? "Unknown";
        const statusText = mission.status === "completed" ? "completes" : "underway";
        headlines.push({
          id: `mission_${mission.id}`,
          text: `Embassy mission ${statusText}: ${mission.name} between ${host} and ${guest}`,
          category: "diplomatic",
          url: wikiUrl(host),
          priority: mission.status === "completed" ? "medium" : "low",
          timestamp: mission.updatedAt.toISOString(),
        });
      });

      // ── 5. Security threats (active) ──
      const threats = await ctx.db.securityThreat.findMany({
        where: { isActive: true },
        orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
        take: 5,
        include: {
          country: { select: { name: true } },
        },
      });

      threats.forEach((threat) => {
        const countryName = threat.country?.name ?? "Unknown region";
        const prefix =
          threat.severity === "critical" || threat.severity === "high"
            ? "Security alert"
            : "Monitoring";
        headlines.push({
          id: `threat_${threat.id}`,
          text: `${prefix}: ${threat.threatName} — ${countryName} (${threat.threatType.replace(/_/g, " ")})`,
          category: "military",
          priority:
            threat.severity === "critical"
              ? "critical"
              : threat.severity === "high"
                ? "high"
                : "medium",
          timestamp: threat.updatedAt.toISOString(),
        });
      });

      // ── 6. ThinkPages notable posts (government/media verified accounts, recent) ──
      const notablePosts = await ctx.db.thinkpagesPost.findMany({
        where: {
          visibility: "public",
          createdAt: { gte: last48h },
          account: {
            OR: [
              { accountType: "government", verified: true },
              { accountType: "media", verified: true },
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          account: {
            select: {
              displayName: true,
              username: true,
              accountType: true,
              country: { select: { name: true } },
            },
          },
        },
      });

      notablePosts.forEach((post) => {
        const source =
          post.account?.accountType === "government"
            ? `Gov. of ${post.account.country?.name ?? "Unknown"}`
            : `@${post.account?.username ?? "unknown"}`;
        const preview = post.content.length > 80 ? post.content.slice(0, 77) + "..." : post.content;
        headlines.push({
          id: `post_${post.id}`,
          text: `${source}: "${preview}"`,
          category: "social",
          priority: post.account?.accountType === "government" ? "medium" : "low",
          timestamp: post.isAutoGenerated
            ? post.ixTimeTimestamp.toISOString()
            : post.createdAt.toISOString(),
        });
      });

      // ── 7. Cabinet meetings (scheduled/completed recently) ──
      const meetings = await ctx.db.cabinetMeeting.findMany({
        where: {
          OR: [
            { status: "scheduled" },
            { status: "in_progress" },
            { status: "completed", completedAt: { gte: last48h } },
          ],
        },
        take: 4,
        orderBy: { scheduledDate: "desc" },
      });

      // Resolve country names for meetings
      const meetingCountryIds = [...new Set(meetings.map((m) => m.countryId))];
      const meetingCountries =
        meetingCountryIds.length > 0
          ? await ctx.db.country.findMany({
              where: { id: { in: meetingCountryIds } },
              select: { id: true, name: true },
            })
          : [];
      const meetingMap = new Map(meetingCountries.map((c) => [c.id, c.name]));

      meetings.forEach((meeting) => {
        const countryName = meetingMap.get(meeting.countryId) ?? "Unknown";
        const statusLabel =
          meeting.status === "completed"
            ? "concluded"
            : meeting.status === "in_progress"
              ? "in session"
              : "scheduled";
        headlines.push({
          id: `meeting_${meeting.id}`,
          text: `${countryName} cabinet meeting ${statusLabel}: ${meeting.title}`,
          category: "political",
          priority: meeting.status === "in_progress" ? "high" : "low",
          timestamp: (meeting.scheduledDate ?? meeting.createdAt).toISOString(),
        });
      });

      // ── 8. Wiki recent edits ──
      try {
        const wikiChanges = await getWikiBridgeRecentChanges(8);
        for (const rc of wikiChanges) {
          const sizeChange = rc.newLen - rc.oldLen;
          const sizeLabel = sizeChange > 0 ? `+${sizeChange}` : String(sizeChange);
          const isNewPage = rc.type === "new";
          // Clean up edit summary: drop auto-generated "Created page with ..." noise
          let summary = "";
          if (!isNewPage && rc.comment) {
            const clean = rc.comment.replace(/\/\*.*?\*\/\s*/, "").trim();
            if (clean && clean.length <= 80) summary = ` — ${clean}`;
            else if (clean) summary = ` — ${clean.slice(0, 77)}...`;
          }
          const verb = isNewPage ? "created" : "edited";
          const wikiDate = new Date(rc.timestamp);
          const wikiTimestamp = isNaN(wikiDate.getTime())
            ? new Date().toISOString()
            : wikiDate.toISOString();
          headlines.push({
            id: `wiki_${rc.title}_${rc.timestamp}`,
            text: `Wiki: ${rc.user} ${verb} "${rc.title}"${summary} (${sizeLabel} bytes)`,
            category: "wiki",
            priority: isNewPage ? "medium" : "low",
            timestamp: wikiTimestamp,
            url: `/wiki/${encodeURIComponent(rc.title.replace(/ /g, "_"))}`,
          });
        }
      } catch (error) {
        console.error("[Headlines] Wiki recent changes failed:", error);
      }

      // ── 9. Forum activity ──
      try {
        const forumItems = await getForumActivity(6);
        for (const item of forumItems) {
          const verb = item.type === "thread" ? "started thread" : "posted in";
          headlines.push({
            id: item.id,
            text: `Forum: ${item.author} ${verb} "${item.title}"${item.forumName ? ` in ${item.forumName}` : ""}`,
            category: "forum",
            priority: "low",
            timestamp: item.timestamp.toISOString(),
            url: item.url,
          });
        }
      } catch (error) {
        console.error("[Headlines] Forum activity failed:", error);
      }

      // ── Shuffle headlines (Fisher-Yates) so the ticker feels dynamic ──
      for (let i = headlines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [headlines[i]!, headlines[j]!] = [headlines[j]!, headlines[i]!];
      }

      return {
        headlines: headlines.slice(0, input.limit),
        generatedAt: now.toISOString(),
      };
    }),
});
