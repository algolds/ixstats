/**
 * wikiDiscoveryRouter — tRPC router for wiki discovery, recent changes, forum integration, and map markers.
 */

import { z } from "zod/v4";
import { createTRPCRouter, cachedPublicProcedure, publicProcedure } from "~/server/api/trpc";
import { getArticleWikitext, getRecentChanges } from "~/lib/wiki/bridge";

export const wikiDiscoveryRouter = createTRPCRouter({
  /**
   * Get recent changes from IxWiki (direct MySQL).
   */
  getRecentChanges: cachedPublicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getRecentChanges(input?.limit ?? 20);
    }),

  /**
   * Get a forum thread preview by thread ID.
   * Uses XenForo API (same server at forum.ixwiki.com).
   */
  getForumThreadPreview: cachedPublicProcedure
    .input(z.object({ threadId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const { getXfApiKey, getXfApiUrl } = await import("~/server/modules/forum");
      const apiKey = getXfApiKey();
      if (!apiKey) return null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${getXfApiUrl()}/threads/${input.threadId}/`, {
          headers: { "XF-Api-Key": apiKey },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) return null;
        const data = (await res.json()) as {
          thread: {
            thread_id: number;
            title: string;
            username: string;
            post_date: number;
            reply_count: number;
            view_count: number;
            Forum?: { title: string };
            first_post?: { message: string };
          };
        };

        const t = data.thread;
        // Strip BBCode from first post for excerpt
        const rawExcerpt = t.first_post?.message ?? "";
        const excerpt = rawExcerpt
          .replace(/\[\/?\w+(?:=[^\]]*)?]/g, "")
          .replace(/<[^>]+>/g, "")
          .trim()
          .substring(0, 300);

        return {
          threadId: t.thread_id,
          title: t.title,
          author: t.username,
          timestamp: new Date(t.post_date * 1000).toISOString(),
          replyCount: t.reply_count,
          viewCount: t.view_count,
          forumName: t.Forum?.title,
          excerpt,
        };
      } catch {
        return null;
      }
    }),

  /**
   * Intelligent province map finder — scans a country's wiki page for
   * administrative division info and related SVG/PNG map files.
   */
  findProvinceMaps: cachedPublicProcedure
    .input(
      z.object({
        countryName: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const article = await getArticleWikitext(input.countryName, "ixwiki");
      if (!article) {
        return { sections: [], files: [], infoboxData: null };
      }
      const wikitext = article.wikitext;

      // 1. Find administrative division-related sections
      const sectionKeywords = [
        "administrative division",
        "provinces",
        "subdivisions",
        "regions",
        "states",
        "departments",
        "counties",
        "governorates",
        "oblasts",
        "prefectures",
        "cantons",
        "territories",
        "districts",
        "municipalities",
      ];

      const lines = wikitext.split("\n");
      const matchedSections: Array<{ title: string; level: number; lineIndex: number }> = [];

      for (let i = 0; i < lines.length; i++) {
        const headingMatch = lines[i]!.match(/^(={2,})\s*(.+?)\s*={2,}$/);
        if (headingMatch) {
          const title = headingMatch[2]!.trim();
          const titleLower = title.toLowerCase();
          if (sectionKeywords.some((kw) => titleLower.includes(kw))) {
            matchedSections.push({
              title,
              level: headingMatch[1]!.length,
              lineIndex: i,
            });
          }
        }
      }

      // 2. Extract ALL file references from the article
      const filePattern = /\[\[(?:File|Image):([^\]|]+)/gi;
      const allFiles: string[] = [];
      let fileMatch;
      while ((fileMatch = filePattern.exec(wikitext)) !== null) {
        allFiles.push(fileMatch[1]!.trim());
      }

      // 3. Score and rank map files by likelihood of being a province map
      const provinceKeywords = [
        "province",
        "region",
        "admin",
        "division",
        "subdivision",
        "territory",
        "state",
        "department",
        "district",
        "vector",
        "political",
        "label",
      ];
      const negativeKeywords = [
        "topo",
        "climate",
        "elevation",
        "terrain",
        "relief",
        "satellite",
        "photo",
        "flag",
        "coat",
        "emblem",
        "seal",
        "logo",
        "icon",
        "banner",
        "locator",
        "inset",
        "overview",
        "highway",
        "hiway",
        "road",
        "rail",
        "city",
        "cities",
      ];

      type ScoredFile = { name: string; score: number };
      const scoredFiles: ScoredFile[] = allFiles
        .filter((f) => {
          const lower = f.toLowerCase();
          return lower.endsWith(".svg") || lower.endsWith(".png");
        })
        .map((f) => {
          const lower = f.toLowerCase();
          let score = 0;
          // SVG preferred over PNG (vector = province boundaries)
          if (lower.endsWith(".svg")) score += 5;
          // Province keywords boost
          for (const kw of provinceKeywords) {
            if (lower.includes(kw)) score += 10;
          }
          // Generic "map" is weaker signal
          if (lower.includes("map")) score += 3;
          // Negative keywords penalize
          for (const kw of negativeKeywords) {
            if (lower.includes(kw)) score -= 15;
          }
          return { name: f, score };
        })
        .sort((a, b) => b.score - a.score);

      const mapFiles = scoredFiles.filter((f) => f.score > 0).map((f) => f.name);
      const svgFiles = scoredFiles
        .filter((f) => f.score <= 0 && f.name.toLowerCase().endsWith(".svg"))
        .map((f) => f.name);

      // 4. Extract infobox data about divisions
      const infoboxData: Record<string, string> = {};
      const infoboxFields = [
        "subdivisions",
        "admin_divisions",
        "provinces",
        "regions",
        "states",
        "number_of_provinces",
      ];
      for (const field of infoboxFields) {
        const fieldMatch = wikitext.match(
          new RegExp(`\\|\\s*${field}\\s*=\\s*(.+?)(?=\\n\\||\\n\\}\\})`, "i")
        );
        if (fieldMatch) {
          infoboxData[field] = fieldMatch[1]!.trim();
        }
      }

      return {
        sections: matchedSections.map((s) => s.title),
        files: [...mapFiles, ...svgFiles].slice(0, 20),
        allImageFiles: allFiles.filter(
          (f) => f.toLowerCase().endsWith(".svg") || f.toLowerCase().endsWith(".png")
        ),
        infoboxData: Object.keys(infoboxData).length > 0 ? infoboxData : null,
      };
    }),

  /** Get all approved cities and POIs in a country for coordinates picking */
  getCountryMapMarkers: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cities = await ctx.db.city.findMany({
        where: {
          countryId: input.countryId,
          status: "approved",
        },
        select: {
          id: true,
          name: true,
          coordinates: true,
          isNationalCapital: true,
          population: true,
        },
        orderBy: {
          population: "desc",
        },
      });

      const pois = await ctx.db.pointOfInterest.findMany({
        where: {
          countryId: input.countryId,
          status: "approved",
        },
        select: {
          id: true,
          name: true,
          coordinates: true,
          category: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      return {
        cities: cities.map((c) => ({
          id: c.id,
          name: c.name,
          coordinates: c.coordinates as [number, number],
          type: c.isNationalCapital ? "capital" : "city",
        })),
        pois: pois.map((p) => ({
          id: p.id,
          name: p.name,
          coordinates: p.coordinates as [number, number],
          type: p.category,
        })),
      };
    }),
});
