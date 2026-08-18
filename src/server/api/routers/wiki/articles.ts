/**
 * wikiArticlesRouter — tRPC router for wiki article access.
 *
 * Single entry point for article searches, wikitext inspection, infoboxes,
 * sections, and coordinates.
 */

import { z } from "zod/v4";
import { createTRPCRouter, cachedPublicProcedure } from "~/server/api/trpc";
import {
  getArticleIntro,
  getArticleWikitext,
  searchPages,
  getInfobox,
  getPageSections,
  getCoordinates,
  searchWithFallback,
  type WikiSource,
} from "~/lib/wiki/bridge";

const wikiSourceSchema = z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki");

export const wikiArticlesRouter = createTRPCRouter({
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
});
