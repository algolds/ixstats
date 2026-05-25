/**
 * wiki.ts — Unified tRPC router for all wiki data access.
 *
 * Single entry point for all wiki operations across IxStats + IxWorld.
 * Uses WikiBridge internally: direct MySQL for ixwiki, HTTP for iiwiki.
 *
 * Replaces scattered wiki endpoints in geo.ts, countries.ts, wikiImporter.ts.
 */

import { z } from "zod/v4";
import { createTRPCRouter, cachedPublicProcedure, publicProcedure } from "~/server/api/trpc";
import {
  getArticleIntro,
  getArticleWikitext,
  searchPages,
  getInfobox,
  getPageSections,
  getRecentChanges,
  getCoordinates,
  searchWithFallback,
  getImageUrl,
  getPageImages,
  type WikiSource,
} from "~/lib/wiki-bridge";

const wikiSourceSchema = z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki");

export const wikiRouter = createTRPCRouter({
  /**
   * Search wiki pages by title prefix.
   * Uses direct MySQL for ixwiki (~30ms), HTTP API for iiwiki (~400ms).
   */
  searchPages: cachedPublicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(10),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      return searchPages(input.query, input.limit, input.wiki as WikiSource);
    }),

  /**
   * Search with automatic fallback: ixwiki first, then iiwiki.
   */
  searchWithFallback: cachedPublicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      return searchWithFallback(input.query, input.limit);
    }),

  /**
   * Get article intro (first paragraph, plaintext).
   * Parsed from wikitext — no PHP template processing.
   */
  getIntro: cachedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      return getArticleIntro(input.title, input.wiki as WikiSource);
    }),

  /**
   * Get raw article wikitext.
   */
  getWikitext: cachedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      const article = await getArticleWikitext(input.title, input.wiki as WikiSource);
      if (!article) return null;
      // Don't return full wikitext to client — just metadata
      return {
        title: article.title,
        pageId: article.pageId,
        length: article.length,
        hasInfobox: article.wikitext.includes("{{Infobox"),
      };
    }),

  /**
   * Parse and return infobox fields from an article.
   */
  getInfobox: cachedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      const result = await getInfobox(input.title, input.wiki as WikiSource);
      if (!result) return null;
      return {
        templateName: result.templateName,
        fields: result.fields.map((f) => ({
          key: f.key,
          value: f.value,
        })),
      };
    }),

  /**
   * Get article section headings (TOC).
   */
  getSections: cachedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      return getPageSections(input.title, input.wiki as WikiSource);
    }),

  /**
   * Get coordinates from article wikitext ({{coord}} template).
   */
  getCoordinates: cachedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      return getCoordinates(input.title, input.wiki as WikiSource);
    }),

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
   * Get image URL for an IxWiki file.
   */
  getImageUrl: publicProcedure
    .input(z.object({ filename: z.string().min(1) }))
    .query(({ input }) => {
      return { url: getImageUrl(input.filename) };
    }),

  /**
   * Get a forum thread preview by thread ID.
   * Uses XenForo API (same server at forum.ixwiki.com).
   */
  getForumThreadPreview: cachedPublicProcedure
    .input(z.object({ threadId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const { getXfApiKey, getXfApiUrl } = await import("~/modules/forum");
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
   * Search wiki files/images by name prefix.
   * Direct MySQL for ixwiki, HTTP API for iiwiki.
   */
  searchFiles: cachedPublicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(20),
        fileTypes: z.array(z.string()).optional(), // e.g., ["svg", "png"]
      })
    )
    .query(async ({ input }) => {
      // MediaWiki uses MySQL (separate from our PostgreSQL), so use HTTP API
      const url = `https://ixwiki.com/api.php?action=query&list=allimages&aiprefix=${encodeURIComponent(input.query.replace(/ /g, "_"))}&ailimit=${input.limit}&aiprop=url|size|mime&format=json`;
      const res = await fetch(url, {
        headers: { "User-Agent": "IxStats/2.0 (https://ixwiki.com)" },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as any;
      const images = data?.query?.allimages ?? [];
      return images
        .filter((img: any) => {
          if (!input.fileTypes || input.fileTypes.length === 0) return true;
          const ext = img.name?.split(".")?.pop()?.toLowerCase() ?? "";
          return input.fileTypes.includes(ext);
        })
        .map((img: any) => ({
          name: img.name ?? "",
          size: img.size ?? 0,
          width: img.width ?? 0,
          height: img.height ?? 0,
          mediaType: "",
          mime: img.mime ?? "",
          url: img.url ?? "",
          pageUrl: `https://ixwiki.com/wiki/File:${encodeURIComponent(img.name ?? "")}`,
        }));
    }),

  /**
   * Download a wiki file's content as base64 — server-side proxy to avoid CORS.
   * Reads directly from /ixwiki/shared/images/ when possible (same server, instant).
   */
  downloadFile: publicProcedure
    .input(z.object({ filename: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const fs = await import("fs/promises");
      const crypto = await import("crypto");
      const name = input.filename.replace(/ /g, "_");

      // MediaWiki hash-based path: md5(filename), take first 1 and 2 chars
      const md5 = crypto.createHash("md5").update(name).digest("hex");
      const hashDir1 = md5.substring(0, 1);
      const hashDir2 = md5.substring(0, 2);
      const localPath = `/ixwiki/shared/images/${hashDir1}/${hashDir2}/${name}`;

      try {
        // Try local filesystem first (instant, no HTTP)
        const buffer = await fs.readFile(localPath);
        const ext = name.split(".").pop()?.toLowerCase() ?? "";
        const mime =
          ext === "svg"
            ? "image/svg+xml"
            : ext === "png"
              ? "image/png"
              : "application/octet-stream";

        return {
          filename: name,
          content: buffer.toString("base64"),
          mime,
          size: buffer.length,
          source: "local" as const,
        };
      } catch {
        // Fallback: fetch via HTTP (handles edge cases like redirects)
        try {
          const url = `https://ixwiki.com/wiki/Special:FilePath/${encodeURIComponent(name)}`;
          const res = await fetch(url, {
            headers: { "User-Agent": "IxStats/2.0 (internal)" },
            redirect: "follow",
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buffer = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get("content-type") ?? "application/octet-stream";

          return {
            filename: name,
            content: buffer.toString("base64"),
            mime: contentType,
            size: buffer.length,
            source: "http" as const,
          };
        } catch (e) {
          throw new Error(
            `Failed to download ${name}: ${e instanceof Error ? e.message : "Unknown"}`
          );
        }
      }
    }),

  /**
   * Get content of a specific section from a wiki article.
   * Returns the raw wikitext between section headings.
   */
  getSectionContent: cachedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        section: z.string().min(1), // Section heading to extract (case-insensitive partial match)
        source: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      const article = await getArticleWikitext(input.title, input.source);
      if (!article) return null;

      // Find the section by heading
      const lines = article.wikitext.split("\n");
      let capturing = false;
      let sectionLevel = 0;
      const content: string[] = [];
      const sectionLower = input.section.toLowerCase();

      for (const line of lines) {
        const headingMatch = line.match(/^(={2,})\s*(.+?)\s*={2,}$/);
        if (headingMatch) {
          const level = headingMatch[1]!.length;
          const title = headingMatch[2]!.trim().toLowerCase();

          if (capturing) {
            // Stop if we hit a heading at same or higher level
            if (level <= sectionLevel) break;
          }

          if (title.includes(sectionLower)) {
            capturing = true;
            sectionLevel = level;
            continue;
          }
        }

        if (capturing) {
          content.push(line);
        }
      }

      if (content.length === 0) return null;

      // Extract any file references from the section content
      const fileRefs: string[] = [];
      const filePattern = /\[\[(?:File|Image):([^\]|]+)/gi;
      const fullContent = content.join("\n");
      let match;
      while ((match = filePattern.exec(fullContent)) !== null) {
        fileRefs.push(match[1]!.trim());
      }

      return {
        content: fullContent.trim(),
        fileReferences: fileRefs,
        lineCount: content.length,
      };
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
      const wikitext = await getArticleWikitext(input.countryName, "ixwiki");
      if (!wikitext) {
        return { sections: [], files: [], infoboxData: null };
      }

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

  /** Get images from a wiki page with thumbnail URLs. */
  getPageImages: cachedPublicProcedure
    .input(
      z.object({
        title: z.string(),
        limit: z.number().int().min(1).max(50).default(12),
        excludeIcons: z.boolean().default(true),
      })
    )
    .query(async ({ input }) => {
      const excludePatterns = input.excludeIcons
        ? [/Flag_of/i, /Coat_of_arms/i, /Icon/i, /Logo/i, /Pictogram/i]
        : [];
      const images = await getPageImages(input.title, {
        limit: input.limit,
        excludePatterns,
        thumbWidth: 400,
      });
      return images ?? [];
    }),
});
