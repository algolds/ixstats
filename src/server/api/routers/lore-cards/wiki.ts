import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure, publicProcedure } from "~/server/api/trpc";
import { requireWikiUserIds } from "~/lib/wiki-os/auth";
import { canSeeTitle } from "~/lib/wiki-os/permissions";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import { CardRarity } from "@prisma/client";
import { LoreCategory, ArtworkSource } from "~/lib/cards/category-enums";
import { autoMatchSubcategory } from "~/lib/cards/subcategory-registry";
import { analyzeWikiSignals } from "~/lib/cards/rarity-algorithm";
import { searchPages, getRecentChanges } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { getMediaWikiApiUrl, DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { cleanWikitextExcerpt } from "~/lib/wiki-os/transformers/wikitext-parser";
import type { WikiSource } from "~/lib/wiki-os/config";

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

/** Runs a read-only lookup; any failure is logged and answered with the empty result instead. */
async function orFallback<T, F>(label: string, fallback: F, run: () => Promise<T>): Promise<T | F> {
  try {
    return await run();
  } catch (error) {
    console.error(`[Lore Cards] ${label}:`, error);
    return fallback;
  }
}

const containsAny = (query: string, fields: string[]) => ({
  OR: fields.map((field) => ({ [field]: { contains: query, mode: "insensitive" as const } })),
});

async function searchStash(
  db: PrismaClient,
  input: { query: string; stashId?: string },
  ownerIds: string[] | null
) {
  const items = await db.stashItem.findMany({
    where: {
      ...(ownerIds ? { stash: { userId: { in: ownerIds } } } : {}),
      ...(input.stashId ? { stashId: input.stashId } : {}),
      ...(input.query.trim() ? containsAny(input.query, ["pageTitle", "note"]) : {}),
    },
    include: {
      stash: { select: { id: true, name: true, color: true } },
      annotations: { take: 3 },
    },
    take: 30,
    orderBy: { updatedAt: "desc" },
  });
  const stashes = await db.stash.findMany({
    where: ownerIds ? { userId: { in: ownerIds } } : {},
    select: { id: true, name: true, color: true, _count: { select: { items: true } } },
    orderBy: { order: "asc" },
  });

  return {
    items: items.map((item) => ({
      id: item.id,
      title: item.pageTitle,
      pageSlug: item.pageSlug,
      snippet: item.note || item.annotations[0]?.selectedText || `Saved in ${item.stash.name}`,
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

/** Cards and articles stored in the local database; null when nothing matches (or the lookup fails). */
async function searchLocalLore(db: PrismaClient, query: string) {
  try {
    const search = query.trim();
    const dbCards = await db.card.findMany({
      where: search ? containsAny(query, ["title", "subcategory", "wikiArticleTitle"]) : {},
      take: 20,
      orderBy: { createdAt: "desc" },
    });
    const dbArticles = await db.wikiArticle.findMany({
      where: search
        ? { status: "PUBLISHED", title: { contains: query, mode: "insensitive" } }
        : { status: "PUBLISHED" },
      select: { id: true, title: true, wikitext: true },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });
    if (dbCards.length === 0 && dbArticles.length === 0) return null;

    return [
      ...dbCards.map((c) => ({
        id: `card-${c.id}`,
        title: c.title,
        pageSlug: c.slug || encodeURIComponent(c.title),
        snippet:
          c.description || c.wikiExcerpt || `Canonical ${c.category || "Lore"} card: ${c.title}`,
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
  } catch (dbErr) {
    console.warn("[Lore Cards] Error querying DB cards/articles:", dbErr);
    return null;
  }
}

type SearchHit = { title: string; pageId?: number | string; length?: number };

/** Runs `load` and logs a warning instead of failing; `fallback` stands in for the result. */
type LegacyPreview = Awaited<
  ReturnType<typeof wikiLoreCardGenerator.fetchArticleMetadataBatch>
>[number] & { excerpt?: string; description?: string; rarity?: string; marketValue?: number };

async function warnOnError<T>(label: string, fallback: T, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (e) {
    console.warn(`[Lore Cards] ${label}:`, e);
    return fallback;
  }
}

/**
 * Search hits for a query: the bridge search. IxWiki's search is native (`searchPages`); only a sister
 * wiki that returned nothing falls back to its own opensearch, with the correct User-Agent.
 */
async function searchWiki(query: string, wikiSrc: WikiSource): Promise<SearchHit[]> {
  const found = await warnOnError("searchPages error", [] as SearchHit[], () =>
    searchPages(query, 25, wikiSrc)
  );
  if (found.length > 0 || wikiSrc !== "iiwiki") return found;

  return warnOnError("HTTP search fallback error", [] as SearchHit[], async () => {
    const res = await fetch(
      `${getMediaWikiApiUrl(wikiSrc)}?action=opensearch&search=${encodeURIComponent(query)}&limit=25&format=json`,
      { headers: { "User-Agent": DEFAULT_USER_AGENT }, signal: AbortSignal.timeout(6000) }
    );
    const data = res.ok ? await res.json() : null;
    return Array.isArray(data) && Array.isArray(data[1])
      ? (data[1] as string[]).map((title, idx) => ({ title, pageId: idx, length: 1200 }))
      : [];
  });
}

/** Recently changed article titles, used as the default list when there is no query. */
async function recentArticleTitles(wikiSrc: WikiSource): Promise<string[]> {
  if (wikiSrc === "iiwiki") {
    return warnOnError("IIWiki recentchanges fetch error", [] as string[], async () => {
      const res = await fetch(
        `${getMediaWikiApiUrl("iiwiki")}?action=query&list=recentchanges&rclimit=30&rcnamespace=0&format=json`,
        { headers: { "User-Agent": DEFAULT_USER_AGENT } }
      );
      const changes: Array<{ title?: string }> = res.ok
        ? ((await res.json()).query?.recentchanges ?? [])
        : [];
      return [...new Set(changes.flatMap((r) => r.title || []))].filter(isArticleTitle);
    });
  }
  return warnOnError("getRecentChanges error", [] as string[], async () => {
    const recents = await getRecentChanges(30);
    return [...new Set((recents ?? []).map((r) => r.title).filter((t) => t && isArticleTitle(t)))];
  });
}

async function stashItemExcerpt(db: PrismaClient, stashItemId: string) {
  const item = await db.stashItem.findUnique({
    where: { id: stashItemId },
    include: { stash: true, annotations: true },
  });
  if (!item) return null;
  return {
    stashName: item.stash.name,
    excerpt:
      item.note ||
      item.annotations.map((a) => a.selectedText).join(" ") ||
      `Excerpt from lore bookmark in ${item.stash.name}`,
  };
}

/** Excerpt, image and length of a wiki article; keeps whatever was resolved before a failure. */
async function wikiArticleExcerpt(pageTitle: string, wikiSrc: WikiSource) {
  const found = { excerpt: "", imageUrl: null as string | null, hasImage: false, length: 1000 };
  try {
    const [preview] = await wikiLoreCardGenerator.fetchArticleMetadataBatch([pageTitle], wikiSrc);
    if (preview) {
      found.excerpt = preview.extract || "";
      found.imageUrl = preview.imageUrl || null;
      found.hasImage = preview.hasImage;
      found.length = preview.length;
    }
    // No extract from the preview: fall back to the article's own wikitext
    const text = found.excerpt || (await getArticleWikitextShadow(pageTitle, wikiSrc))?.wikitext;
    found.excerpt = text ? cleanWikitextExcerpt(text, 400) : "";
  } catch (wikiErr) {
    console.warn("[Lore Cards] Wiki fetch error in fetchLoreMetadata:", wikiErr);
  }
  return found;
}

async function buildLoreMetadata(
  db: PrismaClient,
  input: {
    source: "ixwiki" | "iiwiki" | "wikios" | "stash";
    pageTitle: string;
    stashItemId?: string;
  },
  /** False when the reader may not see the page (a deleted one): no wiki metadata, the live wiki's copy included. */
  canSeeWikiPage: boolean
) {
  const stash =
    input.source === "stash" && input.stashItemId
      ? await stashItemExcerpt(db, input.stashItemId)
      : null;
  const wiki =
    (input.source === "ixwiki" || input.source === "iiwiki") && canSeeWikiPage
      ? await wikiArticleExcerpt(input.pageTitle, input.source)
      : null;
  const rawExcerpt =
    stash?.excerpt ||
    wiki?.excerpt ||
    `Historical chronicles and archival entries of ${input.pageTitle}.`;
  const hasImage = wiki?.hasImage ?? false;
  const resolvedImageUrl = wiki?.imageUrl ?? null;

  const signals = {
    wordCount: Math.round((wiki?.length ?? 1000) / 5),
    inboundLinks: 12,
    outboundLinks: 8,
    editCount: 6,
    categoryNames: [],
    hasImages: hasImage,
  };

  const analysis = analyzeWikiSignals(input.pageTitle, signals);
  const resolvedCategory = analysis.suggestedCategory || LoreCategory.SPECIAL;
  const matchedSubcategory =
    stash?.stashName || autoMatchSubcategory(resolvedCategory, rawExcerpt || input.pageTitle);

  return {
    title: input.pageTitle,
    wikiSource: input.source,
    subcategory: matchedSubcategory || "Lore Archive",
    excerpt: rawExcerpt,
    description: rawExcerpt.slice(0, 140),
    category: resolvedCategory,
    rarity: analysis.suggestedRarity || CardRarity.RARE,
    marketValue: 600,
    hasImage,
    imageUrl: resolvedImageUrl,
    artworkSource: hasImage ? ArtworkSource.WIKI_FETCHED : ArtworkSource.PROCEDURAL,
  };
}

async function searchRemoteLore(query: string, wikiSrc: WikiSource) {
  const hits = query.trim()
    ? await searchWiki(query, wikiSrc)
    : (await recentArticleTitles(wikiSrc)).map((title, i) => ({
        title,
        pageId: `feat-${i}`,
        length: 2500,
      }));
  // Filter out non-article pages (File:, Category:, Media:, .png, .jpg)
  const results = hits.filter((r) => isArticleTitle(r.title));

  // Fast batch-resolve metadata & extracts for top search results
  const titlesToFetch = results.map((r) => r.title).filter(Boolean);
  const previews =
    titlesToFetch.length > 0
      ? await warnOnError("Error batch fetching metadata previews", [], () =>
          wikiLoreCardGenerator.fetchArticleMetadataBatch(titlesToFetch.slice(0, 25), wikiSrc)
        )
      : [];
  // `excerpt`, `description`, `rarity` and `marketValue` are not part of the preview, so they stay undefined.
  const previewMap = new Map<string, LegacyPreview>(
    previews.filter((p) => p.title).map((p) => [p.title.toLowerCase(), p])
  );

  return results.map((r) => {
    const meta = previewMap.get(r.title.toLowerCase());
    const cleanSnippet = cleanWikitextExcerpt(meta?.excerpt || meta?.description || "", 180);
    return {
      id: `wiki-${r.title}`,
      title: r.title,
      pageSlug: encodeURIComponent(r.title),
      snippet:
        cleanSnippet || `Canonical lore documentation and historical archive entry for ${r.title}.`,
      source: wikiSrc,
      length: r.length,
      imageUrl: meta?.imageUrl || null,
      category: meta?.category || undefined,
      rarity: meta?.rarity || undefined,
      marketValue: meta?.marketValue || undefined,
    };
  });
}

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
      const slugBase = input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const uniqueSuffix = crypto.randomUUID().slice(0, 5);
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
          return await searchStash(
            ctx.db,
            input,
            ctx.auth?.userId ? requireWikiUserIds(ctx) : null
          );
        }

        if (input.source === "wikios" || input.source === "ixwiki") {
          const items = await searchLocalLore(ctx.db, input.query);
          if (items) return { items, stashes: [] };
        }

        const wikiSrc = input.source === "iiwiki" ? "iiwiki" : "ixwiki";
        return { items: await searchRemoteLore(input.query, wikiSrc), stashes: [] };
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
        const canSeeWikiPage =
          (input.source === "ixwiki" || input.source === "iiwiki") &&
          (await canSeeTitle(ctx, input.pageTitle, input.source));
        return await buildLoreMetadata(ctx.db, input, canSeeWikiPage);
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
    .query(({ input }) =>
      orFallback(
        "Error searching wiki categories",
        { categories: [], source: input.source },
        async () => {
          const categories = await wikiLoreCardGenerator.searchCategories(
            input.prefix,
            input.source,
            input.limit
          );
          return { categories, source: input.source };
        }
      )
    ),

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
    .query(({ input }) => {
      const noStats: Awaited<ReturnType<typeof wikiLoreCardGenerator.getCategoriesInfo>> = {};
      return orFallback(
        "Error getting category stats",
        { stats: noStats, source: input.source },
        async () => {
          const stats = await wikiLoreCardGenerator.getCategoriesInfo(
            input.categories,
            input.source
          );
          return { stats, source: input.source };
        }
      );
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
    .query(({ input }) =>
      orFallback(
        "Error fetching category members",
        { titles: [], category: input.category, source: input.source, count: 0 },
        async () => {
          const cleanCat = input.category.replace(/^category:\s*/i, "").trim();
          const titles = await wikiLoreCardGenerator.fetchCategoryMembers(
            cleanCat,
            input.source,
            input.limit,
            input.type
          );
          return { titles, category: cleanCat, source: input.source, count: titles.length };
        }
      )
    ),

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
    .query(({ input }) =>
      orFallback(
        "Error fetching all main namespace pages",
        { titles: [], source: input.source, count: 0 },
        async () => {
          const titles = await wikiLoreCardGenerator.fetchAllMainNamespacePages(
            input.source,
            input.limit
          );
          return { titles, source: input.source, count: titles.length };
        }
      )
    ),

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
    .query(({ input }) =>
      orFallback("Error fetching article previews batch", { previews: [] }, async () => {
        const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(
          input.titles,
          input.source
        );
        return { previews };
      })
    ),

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
