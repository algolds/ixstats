/**
 * Lore Cards Wiki & Batch Generation Router (IIWiki Dev Proxy Enabled)
 *
 * Handles:
 * - Direct wiki lore card generation & metadata analysis
 * - Custom card creation from Card Designer Studio
 * - Multi-source lore archive search (IxWiki, IIWiki, WikiOS, Stash)
 * - Wiki category search & autocomplete
 * - Category member batch resolution
 * - Main namespace (0) complete wiki crawler
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure, publicProcedure } from "~/server/api/trpc";
import { wikiLoreCardGenerator } from "~/lib/wiki/lore-card-generator";
import { CardRarity } from "@prisma/client";
import { LoreCategory, ArtworkSource } from "~/lib/cards/category-enums";
import { autoMatchSubcategory } from "~/lib/cards/subcategory-registry";
import { analyzeWikiSignals } from "~/lib/cards/rarity-algorithm";
import { searchPages, getRecentChanges } from "~/lib/wiki/bridge";
import { getArticleWikitextShadow } from "~/lib/wiki-os/article-store";
import { getWikiUserAgent, getMediaWikiApiUrl } from "~/lib/wiki/config";
import { cleanWikitextExcerpt } from "~/lib/wiki/wikitext-parser";

const isArticleTitle = (title: string): boolean => {
  if (!title || !title.trim()) return false;
  if (
    /^(File|Image|Media|Category|User|Talk|Template|Help|Draft|Module|Special|MediaWiki):/i.test(
      title
    )
  ) {
    return false;
  }
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(title)) return false;
  return true;
};

export const loreCardsWikiRouter = createTRPCRouter({
  /**
   * Direct admin generation of a lore card from article title & parameters
   */
  generateLoreCard: adminProcedure
    .input(
      z.object({
        articleTitle: z.string().min(1),
        wikiSource: z.enum(["ixwiki", "iiwiki"]).default("ixwiki"),
        category: z.nativeEnum(LoreCategory).optional(),
        targetRarity: z.nativeEnum(CardRarity).optional(),
        artworkUrl: z.string().url().optional(),
        artworkSource: z.nativeEnum(ArtworkSource).optional(),
        customPrompt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const candidate = await wikiLoreCardGenerator.generateCard(
          input.articleTitle,
          input.wikiSource as any
        );

        if (!candidate) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Could not generate lore card for "${input.articleTitle}". Article not found or incomplete.`,
          });
        }

        if (input.targetRarity) {
          candidate.rarity = input.targetRarity;
        }

        if (input.category) {
          candidate.category = input.category;
        }

        if (input.artworkUrl) {
          candidate.artwork = input.artworkUrl;
        }

        const cardId = await wikiLoreCardGenerator.createCard(candidate);

        // Record Audit Log
        await Promise.allSettled([
          ctx.db.auditLog.create({
            data: {
              userId: ctx.auth?.userId || "admin",
              action: "LORE_CARD_MINT",
              entityType: "CARD",
              target: cardId,
              details: `Minted lore card "${candidate.title}" (Rarity: ${candidate.rarity}, Category: ${candidate.category}) from ${input.wikiSource}`,
              success: true,
            },
          }),
        ]);

        return {
          success: true,
          cardId,
          title: candidate.title,
          rarity: candidate.rarity,
          category: candidate.category,
        };
      } catch (error) {
        console.error("[Lore Cards] Error in generateLoreCard:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate lore card",
        });
      }
    }),

  /**
   * Create a custom designed card from the Card Designer studio
   */
  createCustomDesignedCard: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().optional(),
        category: z.nativeEnum(LoreCategory).default(LoreCategory.SPECIAL),
        subcategory: z.string().optional(),
        rarity: z.string().default("COMMON"),
        season: z.number().int().min(1).default(1),
        cardType: z.string().default("WIKI_LORE"),
        marketValue: z.number().min(0).default(100),
        totalSupply: z.number().int().positive().nullable().optional(),
        wikiSource: z.string().optional(),
        wikiArticleTitle: z.string().optional(),
        wikiExcerpt: z.string().optional(),
        artworkUrl: z.string().optional(),
        artworkCredit: z.string().optional(),
        attributes: z.record(z.string(), z.any()).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const slugBase = input.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const uniqueSuffix = Math.random().toString(36).substring(2, 7);
        const slug = `${slugBase}-${uniqueSuffix}`;

        const card = await ctx.db.card.create({
          data: {
            title: input.title,
            name: input.title,
            slug,
            description: input.description ?? input.wikiExcerpt ?? null,
            category: input.category,
            subcategory: input.subcategory ?? null,
            rarity: input.rarity,
            season: input.season,
            cardType: input.cardType,
            marketValue: input.marketValue,
            totalSupply: input.totalSupply ?? null,
            artworkUrl: input.artworkUrl ?? null,
            artwork: input.artworkUrl ?? null,
            artworkSource: ArtworkSource.PROCEDURAL,
            artworkCredit: input.artworkCredit ?? "Game-Icons.net",
            wikiSource: input.wikiSource ?? null,
            wikiArticleTitle: input.wikiArticleTitle ?? null,
            wikiExcerpt: input.wikiExcerpt ?? null,
            attributes: input.attributes ?? {},
            metadata: input.metadata ?? {},
          },
        });

        // Record Audit Log & SyncLog
        await Promise.allSettled([
          ctx.db.auditLog.create({
            data: {
              userId: ctx.auth?.userId || "admin",
              action: "CARD_DESIGNER_MINT",
              entityType: "CARD",
              target: card.id,
              details: `Minted custom card "${card.title}" (Rarity: ${input.rarity}, Season: ${input.season}, Value: ${input.marketValue} IxCredits)`,
              success: true,
            },
          }),
          ctx.db.syncLog.create({
            data: {
              syncType: "custom-card-creation",
              status: "SUCCESS",
              cardsProcessed: 1,
              cardsCreated: 1,
              cardsUpdated: 0,
              startedAt: new Date(),
              completedAt: new Date(),
              metadata: {
                cardId: card.id,
                title: card.title,
                rarity: input.rarity,
                category: input.category,
              },
            },
          }),
        ]);

        return {
          success: true,
          cardId: card.id,
          slug: card.slug,
          title: card.title,
          message: "Custom card successfully created and published to database.",
        };
      } catch (error) {
        console.error("[Lore Cards] Error in createCustomDesignedCard:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to create custom card",
        });
      }
    }),

  /**
   * Multi-source Lore Archive Search (IxWiki, IIWiki, WikiOS, Stash)
   */
  searchLoreArchive: publicProcedure
    .input(
      z.object({
        source: z.enum(["ixwiki", "iiwiki", "wikios", "stash"]),
        query: z.string().default(""),
        stashId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        if (input.source === "stash") {
          const userId = ctx.auth?.userId;
          const whereClause: any = {};
          if (userId) {
            whereClause.stash = { userId };
          }
          if (input.stashId) {
            whereClause.stashId = input.stashId;
          }
          if (input.query.trim()) {
            whereClause.OR = [
              { pageTitle: { contains: input.query, mode: "insensitive" } },
              { note: { contains: input.query, mode: "insensitive" } },
            ];
          }

          const items = await ctx.db.stashItem.findMany({
            where: whereClause,
            include: {
              stash: { select: { id: true, name: true, color: true } },
              annotations: { take: 3 },
            },
            take: 30,
            orderBy: { updatedAt: "desc" },
          });

          const stashes = await ctx.db.stash.findMany({
            where: userId ? { userId } : {},
            select: { id: true, name: true, color: true, _count: { select: { items: true } } },
            orderBy: { order: "asc" },
          });

          return {
            items: items.map((item) => ({
              id: item.id,
              title: item.pageTitle,
              pageSlug: item.pageSlug,
              snippet:
                item.note || item.annotations[0]?.selectedText || `Saved in ${item.stash.name}`,
              stashName: item.stash.name,
              stashColor: item.stash.color,
              source: "stash" as const,
              annotationCount: item.annotations.length,
              savedAt: item.savedAt,
            })),
            stashes: stashes.map((s) => ({
              id: s.id,
              name: s.name,
              color: s.color,
              count: s._count.items,
            })),
          };
        }

        if (input.source === "wikios" || input.source === "ixwiki") {
          try {
            const dbCards = await ctx.db.card.findMany({
              where: input.query.trim()
                ? {
                    OR: [
                      { title: { contains: input.query, mode: "insensitive" } },
                      { subcategory: { contains: input.query, mode: "insensitive" } },
                      { wikiArticleTitle: { contains: input.query, mode: "insensitive" } },
                    ],
                  }
                : {},
              take: 20,
              orderBy: { createdAt: "desc" },
            });

            const dbArticles = await ctx.db.wikiArticle.findMany({
              where: input.query.trim()
                ? {
                    title: { contains: input.query, mode: "insensitive" },
                  }
                : {},
              take: 20,
              orderBy: { updatedAt: "desc" },
            });

            if (dbCards.length > 0 || dbArticles.length > 0) {
              const items = [
                ...dbCards.map((c) => ({
                  id: `card-${c.id}`,
                  title: c.title,
                  pageSlug: c.slug || encodeURIComponent(c.title),
                  snippet:
                    c.description ||
                    c.wikiExcerpt ||
                    `Canonical ${c.category || "Lore"} card: ${c.title}`,
                  source: "wikios" as const,
                  imageUrl: c.artworkUrl || c.artwork || null,
                  category: c.category || "SPECIAL",
                  rarity: c.rarity,
                  marketValue: c.marketValue,
                })),
                ...dbArticles.map((a) => ({
                  id: `art-${a.id}`,
                  title: a.title,
                  pageSlug: encodeURIComponent(a.title),
                  snippet:
                    a.wikitext.slice(0, 180).replace(/^\[\[[^\]]+\]\]\s*/, "") ||
                    `WikiOS article: ${a.title}`,
                  source: "wikios" as const,
                  imageUrl: null,
                  category: "SPECIAL",
                  rarity: "RARE",
                  marketValue: 1000,
                })),
              ];

              return { items, stashes: [] };
            }
          } catch (dbErr) {
            console.warn("[Lore Cards] Error querying DB cards/articles:", dbErr);
          }
        }

        const wikiSrc = input.source === "iiwiki" ? "iiwiki" : "ixwiki";
        let results: Array<{ title: string; pageId?: number | string; length?: number }> = [];

        if (input.query.trim()) {
          try {
            results = await searchPages(input.query, 25, wikiSrc as any);
          } catch (e) {
            console.warn("[Lore Cards] searchPages error:", e);
          }

          // If searchPages returned empty, fall back to HTTP API with correct User-Agent
          if (results.length === 0) {
            try {
              const httpUrl =
                wikiSrc === "iiwiki"
                  ? `${getMediaWikiApiUrl("iiwiki")}?action=opensearch&search=${encodeURIComponent(input.query)}&limit=25&format=json`
                  : `https://ixwiki.com/api.php?action=opensearch&search=${encodeURIComponent(input.query)}&limit=25&format=json`;
              const res = await fetch(httpUrl, {
                headers: { "User-Agent": getWikiUserAgent(wikiSrc as any) },
              });
              if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && Array.isArray(data[1])) {
                  results = (data[1] as string[]).map((title: string, idx: number) => ({
                    title,
                    pageId: idx,
                    length: 1200,
                  }));
                }
              }
            } catch (httpErr) {
              console.warn("[Lore Cards] HTTP search fallback error:", httpErr);
            }
          }
        } else {
          // No query: Fetch recent changes or default featured lore topics from target wiki
          let recentTitles: string[] = [];

          if (wikiSrc === "iiwiki") {
            try {
              const iiUrl = `${getMediaWikiApiUrl("iiwiki")}?action=query&list=recentchanges&rclimit=30&rcnamespace=0&format=json`;
              const res = await fetch(iiUrl, {
                headers: { "User-Agent": getWikiUserAgent("iiwiki") },
              });
              if (res.ok) {
                const data = await res.json();
                const rc = data.query?.recentchanges || [];
                if (Array.isArray(rc) && rc.length > 0) {
                  recentTitles = Array.from(
                    new Set(rc.map((r: any) => r.title).filter(Boolean))
                  ).filter(isArticleTitle);
                }
              }
            } catch (iiErr) {
              console.warn("[Lore Cards] IIWiki recentchanges fetch error:", iiErr);
            }
          } else {
            try {
              const recents = await getRecentChanges(30);
              if (recents && recents.length > 0) {
                const titles = recents
                  .map((r: { title: string }) => r.title)
                  .filter((t: string): t is string => Boolean(t) && isArticleTitle(t));
                recentTitles = Array.from(new Set(titles));
              }
            } catch (recentErr) {
              console.warn("[Lore Cards] getRecentChanges error:", recentErr);
            }
          }

          results = recentTitles.map((title, i) => ({
            title,
            pageId: `feat-${i}`,
            length: 2500,
          }));
        }

        // Filter out non-article pages (File:, Category:, Media:, .png, .jpg)
        results = results.filter((r) => isArticleTitle(r.title));

        // Fast batch-resolve metadata & extracts for top search results
        const titlesToFetch = results.map((r) => r.title).filter(Boolean);
        const previewMap: Record<string, any> = {};
        if (titlesToFetch.length > 0) {
          try {
            const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(
              titlesToFetch.slice(0, 25),
              wikiSrc as any
            );
            for (const p of previews) {
              if (p.title) {
                previewMap[p.title.toLowerCase()] = p;
              }
            }
          } catch (batchErr) {
            console.warn("[Lore Cards] Error batch fetching metadata previews:", batchErr);
          }
        }

        return {
          items: results.map((r) => {
            const meta = previewMap[r.title.toLowerCase()];
            const rawText = meta?.excerpt || meta?.description || "";
            const cleanSnippet = cleanWikitextExcerpt(rawText, 180);

            return {
              id: `wiki-${r.title}`,
              title: r.title,
              pageSlug: encodeURIComponent(r.title),
              snippet:
                cleanSnippet ||
                `Canonical lore documentation and historical archive entry for ${r.title}.`,
              source: wikiSrc,
              length: r.length,
              imageUrl: meta?.imageUrl || null,
              category: meta?.category || undefined,
              rarity: meta?.rarity || undefined,
              marketValue: meta?.marketValue || undefined,
            };
          }),
          stashes: [],
        };
      } catch (error) {
        console.error("[Lore Cards] Error in searchLoreArchive:", error);
        return { items: [], stashes: [] };
      }
    }),

  /**
   * Fetch rich metadata, signals, and excerpt for a specific article
   */
  fetchLoreMetadata: publicProcedure
    .input(
      z.object({
        source: z.enum(["ixwiki", "iiwiki", "wikios", "stash"]),
        pageTitle: z.string().min(1),
        stashItemId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        let rawExcerpt = "";
        let resolvedImageUrl: string | null = null;
        let hasImage = false;
        let estimatedRarity: CardRarity | undefined;
        let estimatedValue: number | undefined;
        let stashName: string | undefined;
        let articleLength = 1000;

        if (input.source === "stash" && input.stashItemId) {
          const item = await ctx.db.stashItem.findUnique({
            where: { id: input.stashItemId },
            include: {
              stash: true,
              annotations: true,
            },
          });

          if (item) {
            stashName = item.stash.name;
            rawExcerpt =
              item.note ||
              item.annotations.map((a) => a.selectedText).join(" ") ||
              `Excerpt from lore bookmark in ${item.stash.name}`;
          }
        }

        if (input.source === "ixwiki" || input.source === "iiwiki") {
          try {
            const wikiSrc = input.source === "iiwiki" ? "iiwiki" : "ixwiki";
            const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(
              [input.pageTitle],
              wikiSrc as any
            );
            const p = previews[0];
            if (p) {
              rawExcerpt = p.extract || "";
              resolvedImageUrl = p.imageUrl || null;
              hasImage = p.hasImage;
              articleLength = p.length;
            }

            if (!rawExcerpt) {
              const articleRes = await getArticleWikitextShadow(input.pageTitle, wikiSrc as any);
              const textContent = articleRes?.wikitext || "";
              if (textContent) {
                rawExcerpt = cleanWikitextExcerpt(textContent, 400);
              }
            } else {
              rawExcerpt = cleanWikitextExcerpt(rawExcerpt, 400);
            }
          } catch (wikiErr) {
            console.warn("[Lore Cards] Wiki fetch error in fetchLoreMetadata:", wikiErr);
          }
        }

        if (!rawExcerpt) {
          rawExcerpt = `Historical chronicles and archival entries of ${input.pageTitle}.`;
        }

        const signals = {
          wordCount: Math.round(articleLength / 5),
          inboundLinks: 12,
          outboundLinks: 8,
          editCount: 6,
          categoryNames: [],
          hasImages: hasImage,
        };

        const analysis = analyzeWikiSignals(input.pageTitle, signals);
        const resolvedCategory = analysis.suggestedCategory || LoreCategory.SPECIAL;
        const matchedSubcategory =
          stashName || autoMatchSubcategory(resolvedCategory, rawExcerpt || input.pageTitle);

        return {
          title: input.pageTitle,
          wikiSource: input.source,
          subcategory: matchedSubcategory || "Lore Archive",
          excerpt: rawExcerpt,
          description: rawExcerpt.slice(0, 140),
          category: resolvedCategory,
          rarity: estimatedRarity || analysis.suggestedRarity || CardRarity.RARE,
          marketValue: estimatedValue || 600,
          hasImage,
          imageUrl: resolvedImageUrl,
          artworkSource: hasImage ? ArtworkSource.WIKI_FETCHED : ArtworkSource.PROCEDURAL,
        };
      } catch (error) {
        console.error("[Lore Cards] Error in fetchLoreMetadata:", error);
        return {
          title: input.pageTitle,
          wikiSource: input.source,
          subcategory: "Lore Archive",
          excerpt: `Chronicles of ${input.pageTitle}.`,
          description: `Chronicles of ${input.pageTitle}.`,
          category: LoreCategory.SPECIAL,
          rarity: CardRarity.RARE,
          marketValue: 600,
          hasImage: false,
          imageUrl: null,
          artworkSource: ArtworkSource.PROCEDURAL,
        };
      }
    }),

  /**
   * Search live wiki categories by prefix
   */
  searchWikiCategories: publicProcedure
    .input(
      z.object({
        source: z.enum(["ixwiki", "iiwiki"]),
        prefix: z.string().default(""),
        limit: z.number().min(1).max(100).default(30),
      })
    )
    .query(async ({ input }) => {
      try {
        const categories = await wikiLoreCardGenerator.searchCategories(
          input.prefix,
          input.source,
          input.limit
        );
        return { categories, source: input.source };
      } catch (error) {
        console.error("[Lore Cards] Error searching wiki categories:", error);
        return { categories: [], source: input.source };
      }
    }),

  /**
   * Fetch category statistics (size, pages, files, subcats) for a list of categories
   */
  getCategoryStats: publicProcedure
    .input(
      z.object({
        source: z.enum(["ixwiki", "iiwiki"]),
        categories: z.array(z.string()),
      })
    )
    .query(async ({ input }) => {
      try {
        const stats = await wikiLoreCardGenerator.getCategoriesInfo(input.categories, input.source);
        return { stats, source: input.source };
      } catch (error) {
        console.error("[Lore Cards] Error getting category stats:", error);
        return { stats: {}, source: input.source };
      }
    }),

  /**
   * Fetch member page titles from a live wiki category (all pages & files up to 10,000)
   */
  fetchWikiCategoryMembers: publicProcedure
    .input(
      z.object({
        source: z.enum(["ixwiki", "iiwiki"]),
        category: z.string(),
        limit: z.number().min(1).max(20000).default(10000),
        type: z.enum(["page", "file", "page|file"]).default("page|file"),
      })
    )
    .query(async ({ input }) => {
      try {
        const cleanCat = input.category.replace(/^category:\s*/i, "").trim();
        const titles = await wikiLoreCardGenerator.fetchCategoryMembers(
          cleanCat,
          input.source,
          input.limit,
          input.type
        );
        return { titles, category: cleanCat, source: input.source, count: titles.length };
      } catch (error) {
        console.error("[Lore Cards] Error fetching category members:", error);
        return { titles: [], category: input.category, source: input.source, count: 0 };
      }
    }),

  /**
   * Fetch all page titles in the main namespace (namespace 0) for a wiki (up to 10,000)
   */
  fetchAllMainNamespacePages: publicProcedure
    .input(
      z.object({
        source: z.enum(["ixwiki", "iiwiki"]),
        limit: z.number().min(1).max(20000).default(10000),
      })
    )
    .query(async ({ input }) => {
      try {
        const titles = await wikiLoreCardGenerator.fetchAllMainNamespacePages(
          input.source,
          input.limit
        );
        return { titles, source: input.source, count: titles.length };
      } catch (error) {
        console.error("[Lore Cards] Error fetching all main namespace pages:", error);
        return { titles: [], source: input.source, count: 0 };
      }
    }),

  /**
   * Batch fetch article metadata (images, excerpts, categories, estimated values)
   */
  fetchArticlePreviewsBatch: publicProcedure
    .input(
      z.object({
        titles: z.array(z.string()).min(1).max(200),
        source: z.enum(["ixwiki", "iiwiki"]).default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      try {
        const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(
          input.titles,
          input.source
        );
        return { previews };
      } catch (error) {
        console.error("[Lore Cards] Error fetching article previews batch:", error);
        return { previews: [] };
      }
    }),

  /**
   * Resolve author info for a wiki article (Page Creator + Top Contributor)
   * If cardId is provided, asynchronously persists authorInfo to card.metadata
   */
  getCardAuthorInfo: publicProcedure
    .input(
      z.object({
        cardId: z.string().optional(),
        articleTitle: z.string().min(1),
        source: z.enum(["ixwiki", "iiwiki"]).default("ixwiki"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const titleKey = input.articleTitle.replace(/_/g, " ").trim().toLowerCase();
        const authorMap = await wikiLoreCardGenerator.fetchArticleAuthorInfoBatch(
          [input.articleTitle],
          input.source
        );
        const authorInfo = authorMap.get(titleKey) ||
          authorMap.get(input.articleTitle.toLowerCase()) ||
          authorMap.get(input.articleTitle) || {
            creator: "Unknown",
            displayAuthor: "Unknown",
          };

        if (input.cardId) {
          const targetCardId = input.cardId;
          void (async () => {
            try {
              const existing = await ctx.db.card.findUnique({
                where: { id: targetCardId },
                select: { metadata: true },
              });
              if (existing) {
                const currentMeta = (existing.metadata as Record<string, unknown>) || {};
                await ctx.db.card.update({
                  where: { id: targetCardId },
                  data: {
                    metadata: {
                      ...currentMeta,
                      authorInfo: authorInfo as any,
                      author: authorInfo.displayAuthor,
                    },
                  },
                });
              }
            } catch (err) {
              console.warn(`[Lore Cards] Failed to cache authorInfo for ${targetCardId}:`, err);
            }
          })();
        }

        return { authorInfo };
      } catch (error) {
        console.error("[Lore Cards] Error resolving card author info:", error);
        return {
          authorInfo: {
            creator: "Unknown",
            displayAuthor: "Unknown",
          },
        };
      }
    }),
});
