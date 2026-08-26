// src/components/wiki-os/reader/WikiOSMainPage.tsx
// Custom WikiOS main page — Apple Design & Emil Design Engineering architecture.
// Supports dual design archetypes: Editorial Masthead vs. Sculpted Emblem.

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { OpenBook as BookOpen, OpenNewWindow as ExternalLink } from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { WikiHeroMaster, type WikiHeroVariant } from "./hero";
import { EditorialMainPageContent, SculptedMainPageContent } from "./main";
import { extractLeadImageFromHtml, normalizeWikiImageUrl } from "~/lib/wiki-os/transformers/image-url";

const STORAGE_KEY = "wikios:heroVariant";

const FALLBACK_ALMANAC_PAGES = [
  "List of countries by GDP",
  "List of countries by population",
  "List of countries by Human Development Index",
  "List of sovereign states by system of government",
  "List of countries by life expectancy",
  "List of countries by literacy rate",
  "List of countries by intentional homicide rate",
  "List of countries by median age",
  "List of countries by military expenditures",
  "List of countries by rail transport network size",
  "List of countries by electricity consumption",
  "List of sovereign states by date of formation",
  "List of countries by carbon dioxide emissions",
  "List of countries by arable land area",
];

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: "Countries", color: "#3b82f6" },
  { name: "Companies", color: "#f97316" },
  { name: "Culture", color: "#a855f7" },
  { name: "Economy", color: "#22c55e" },
  { name: "Geography", color: "#14b8a6" },
  { name: "Government", color: "#6366f1" },
  { name: "History", color: "#eab308" },
  { name: "Military", color: "#ef4444" },
  { name: "Nature", color: "#10b981" },
  { name: "People", color: "#ec4899" },
  { name: "Politics", color: "#8b5cf6" },
  { name: "Technology", color: "#06b6d4" },
] as const;

// ---------------------------------------------------------------------------
// Blurb Modal
// ---------------------------------------------------------------------------

function BlurbPromptModal({
  open,
  onClose,
  prompt,
}: {
  open: boolean;
  onClose: () => void;
  prompt: {
    id: string;
    title: string;
    question: string;
    slug: string;
    _count: { responses: number };
  };
}) {
  const {
    data: responsesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.blurbs.getResponsesForPrompt.useInfiniteQuery(
    { promptId: prompt.id, limit: 8, featuredFirst: true },
    {
      enabled: open,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const responses = responsesData?.pages.flatMap((p) => p.responses) ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col gap-0 overflow-hidden p-0 rounded-3xl border border-white/20 dark:border-white/10 bg-white/80 dark:bg-zinc-950/90 backdrop-blur-2xl shadow-2xl">
        {/* Header */}
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0 text-purple-400" />
                <DialogTitle className="text-base font-semibold">{prompt.title}</DialogTitle>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{prompt.question}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {prompt._count.responses}{" "}
                  {prompt._count.responses === 1 ? "response" : "responses"}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Responses */}
        <div className="flex-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-2.5 overflow-y-auto px-5 py-3">
          {responses.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No responses yet. Be the first!
            </p>
          )}

          {responses.map((r) => (
            <div
              key={r.id}
              className={`rounded-2xl border p-3.5 ${
                r.featured ? "border-amber-500/30 bg-amber-500/5" : "border-white/10 bg-foreground/[0.02]"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                {r.country?.flag && (
                  <img src={r.country.flag} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
                )}
                <span className="text-xs font-medium text-foreground">
                  {r.country?.name ?? "Unknown"}
                </span>
                {r.featured && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 px-1 py-0 text-[9px] text-amber-400"
                  >
                    Featured
                  </Badge>
                )}
              </div>
              <p className="line-clamp-4 text-sm whitespace-pre-wrap text-muted-foreground">
                {r.content}
              </p>
            </div>
          ))}

          {hasNextPage && (
            <div className="py-1 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
          <Link
            href={withBasePath(`/blurbs/${prompt.slug}`)}
            className="inline-flex items-center gap-1.5 text-xs text-purple-400 transition-colors hover:text-purple-300"
          >
            <ExternalLink className="h-3 w-3" />
            Open full prompt
          </Link>
          <Link
            href={withBasePath("/blurbs")}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            All prompts →
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function WikiOSMainPage() {
  const [variant, setVariant] = useState<WikiHeroVariant>("sculpted-emblem");
  const [blurbModalOpen, setBlurbModalOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as string | null;
      if (saved === "editorial-masthead") {
        setVariant("editorial-masthead");
      } else {
        setVariant("sculpted-emblem");
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSelectVariant = useCallback((newVariant: WikiHeroVariant) => {
    setVariant(newVariant);
    try {
      localStorage.setItem(STORAGE_KEY, newVariant);
    } catch {
      // ignore
    }
  }, []);

  // Fetch Main_Page HTML to extract the featured article from it
  const { data: mainPageData } = api.wikios.getArticleHtml.useQuery(
    { title: "Main Page" },
    { staleTime: 10 * 60 * 1000 }
  );

  // Fetch recent changes
  const { data: recentChanges, isLoading: isLoadingRecent } = api.wikios.getRecentChanges.useQuery(
    { limit: 6 },
    { staleTime: 30_000 }
  );

  // Fetch countries for "Explore the World" (all realms)
  const { data: countries } = api.countries.getSelectList.useQuery(
    { limit: 100 },
    { staleTime: 10 * 60 * 1000 }
  );

  // Randomly shuffle countries on mount/reload for Explore Countries grid
  const randomCountries = useMemo(() => {
    if (!countries || countries.length === 0) return [];
    const copy = [...countries];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  }, [countries]);

  // Fetch site stats
  const { data: siteStats } = api.wikios.getSiteStats.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // Fetch random active blurb prompt
  const { data: activePrompt } = api.blurbs.getRandomActivePrompt.useQuery(undefined, {
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Extract featured article from Main_Page contentHtml
  const featuredArticleHtml = useMemo(() => {
    if (!mainPageData?.contentHtml) return null;
    return extractFeaturedArticle(mainPageData.contentHtml);
  }, [mainPageData?.contentHtml]);

  // Extract structured featured article details for Apple Editorial card
  const featuredArticleDetails = useMemo(() => {
    if (!featuredArticleHtml) return null;

    // Extract title & slug from link or heading
    const titleMatch =
      featuredArticleHtml.match(/<h3[^>]*>[\s\S]*?<a[^>]+href="(?:\/wiki\/|https?:\/\/ixwiki\.com\/wiki\/)([^">]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i) ||
      featuredArticleHtml.match(/<a[^>]+href="(?:\/wiki\/|https?:\/\/ixwiki\.com\/wiki\/)([^">]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
      featuredArticleHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);

    const slug = titleMatch ? decodeURIComponent(titleMatch[1] || "").replace(/ /g, "_") : "Featured_Article";
    const title = titleMatch
      ? (titleMatch[2] || titleMatch[1])?.replace(/<[^>]+>/g, "").trim()
      : "Featured Article";

    // Extract image src using robust HTML image scanner with normalizeWikiImageUrl fallback
    let imgSrc = extractLeadImageFromHtml(featuredArticleHtml);
    if (!imgSrc) {
      const imgMatch = featuredArticleHtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
      if (imgMatch && imgMatch[1]) {
        imgSrc = normalizeWikiImageUrl(imgMatch[1]);
      }
    }

    // Extract paragraph text (clean of bylines / tags)
    const pMatches = featuredArticleHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    const validParagraphs = pMatches.filter(
      (p) => !p.toLowerCase().includes("byline") && !p.toLowerCase().includes("featured article")
    );
    const summary =
      validParagraphs.length > 0
        ? validParagraphs[0].replace(/<[^>]+>/g, "").replace(/^Featured article\s*/i, "").trim()
        : "";

    return {
      title,
      slug,
      imgSrc,
      summary,
    };
  }, [featuredArticleHtml]);

  // Live query author info for the extracted featured article
  const { data: featuredAuthorInfo } = api.wikios.getArticleAuthors.useQuery(
    { title: featuredArticleDetails?.title ?? "" },
    {
      enabled: Boolean(
        featuredArticleDetails?.title && featuredArticleDetails.title !== "Featured Article"
      ),
      staleTime: 5 * 60 * 1000,
    }
  );

  const featuredArticleData = useMemo(() => {
    if (!featuredArticleDetails) return null;
    const creatorName =
      typeof featuredAuthorInfo?.creator === "object"
        ? featuredAuthorInfo?.creator?.username
        : (featuredAuthorInfo?.creator as string | undefined);
    const lastEditorName =
      typeof featuredAuthorInfo?.lastEditor === "object"
        ? featuredAuthorInfo?.lastEditor?.username
        : (featuredAuthorInfo?.lastEditor as string | undefined);

    return {
      ...featuredArticleDetails,
      authorInfo: featuredAuthorInfo
        ? {
            creator: creatorName || null,
            creatorAvatar: null,
            createdAt: typeof featuredAuthorInfo.creator === "object" ? featuredAuthorInfo.creator?.timestamp || null : null,
            lastEditor: lastEditorName || null,
            lastEditorAvatar: null,
            lastEditedAt: typeof featuredAuthorInfo.lastEditor === "object" ? featuredAuthorInfo.lastEditor?.timestamp || null : null,
          }
        : null,
    };
  }, [featuredArticleDetails, featuredAuthorInfo]);

  // Extract latest live dispatch change
  const latestChange = useMemo(() => {
    if (!recentChanges || recentChanges.length === 0) return null;
    const first = recentChanges[0];
    if (!first) return null;
    return {
      title: first.title,
      user: first.user,
      timestamp: first.timestamp,
      comment: first.comment,
    };
  }, [recentChanges]);

  // Fetch members of Category:Bureau_of_International_Statistics for World Almanac Spotlight (limit 100)
  const { data: almanacMembers, isLoading: isLoadingAlmanacMembers } =
    api.wikios.getCategoryMembers.useQuery(
      { category: "Bureau of International Statistics", limit: 100 },
      { staleTime: 10 * 60 * 1000 }
    );

  // Pick a pseudo-random daily rotated article from the statistical pool
  const selectedAlmanacTitle = useMemo(() => {
    const memberList = almanacMembers?.members;
    const validPages = (memberList ?? [])
      .filter((m) => m.type === "page" || !m.isSubcategory)
      .map((m) => m.title)
      .filter(
        (t) =>
          !t.startsWith("Category:") &&
          !t.startsWith("Template:") &&
          !t.startsWith("User:") &&
          !t.startsWith("MediaWiki:")
      );

    const pool = validPages.length > 0 ? validPages : FALLBACK_ALMANAC_PAGES;

    // Seeded daily PRNG based on current UTC calendar day: YYYY-MM-DD
    const now = new Date();
    const dateKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
    let hash = 0;
    for (let i = 0; i < dateKey.length; i++) {
      hash = (Math.imul(31, hash) + dateKey.charCodeAt(i)) | 0;
    }
    const positiveHash = Math.abs(hash);
    const index = positiveHash % pool.length;
    return pool[index] || "List of countries by GDP";
  }, [almanacMembers]);

  // Fetch the live parsed HTML of the selected B.I.S. Almanac article
  const { data: almanacArticleHtmlData, isLoading: isLoadingAlmanacArticle } =
    api.wikios.getArticleHtml.useQuery(
      { title: selectedAlmanacTitle },
      {
        enabled: Boolean(selectedAlmanacTitle),
        staleTime: 10 * 60 * 1000,
      }
    );

  // Parse lead paragraph, title, and image directly from the wiki article
  const almanacSpotlightData = useMemo(() => {
    if (!selectedAlmanacTitle) return null;
    const rawHtml = almanacArticleHtmlData?.contentHtml || "";

    // Extract robust lead image via universal HTML scanner
    const thumbnail = extractLeadImageFromHtml(rawHtml);

    // Extract clean lead paragraph (skipping empty / infobox paragraphs)
    const pMatches = rawHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    const validParagraph = pMatches.find(
      (p) =>
        p.length > 25 &&
        !p.toLowerCase().includes("infobox") &&
        !p.toLowerCase().includes("mw-empty-elt")
    );
    const excerpt = validParagraph
      ? validParagraph
          .replace(/<[^>]+>/g, "")
          .replace(/\[\d+\]/g, "")
          .trim()
          .replace(/\s+/g, " ")
      : `Official comparative statistical catalog of the League of Nations Bureau of International Statistics for ${selectedAlmanacTitle.replace(/_/g, " ")}.`;

    return {
      title: selectedAlmanacTitle.replace(/_/g, " "),
      slug: encodeURIComponent(selectedAlmanacTitle.replace(/ /g, "_")),
      category: "Bureau of International Statistics",
      excerpt,
      thumbnail,
      metricLabel: "B.I.S. Registry",
      metricValue: "Official Index",
    };
  }, [selectedAlmanacTitle, almanacArticleHtmlData]);

  return (
    <div className="wikios-main w-full pt-1 pb-3">
      <div className="w-full max-w-6xl mx-auto space-y-4 sm:space-y-5">
        {/* ── 1. Master Hero & Direction Switcher ── */}
        <header className="wikios-main-hero relative w-full">
          <div className="wikios-main-hero-inner w-full">
            <WikiHeroMaster
              variant={variant}
              onSelectVariant={handleSelectVariant}
              siteStats={siteStats}
              activePrompt={activePrompt}
              featuredArticleHtml={featuredArticleHtml}
              featuredArticleData={featuredArticleData}
              latestChange={latestChange}
              totalNations={countries?.length ? (countries.length > 50 ? countries.length : 82) : 82}
              onOpenBlurbs={() => setBlurbModalOpen(true)}
            />
          </div>
        </header>

        {/* ── 2. Redesigned Main Content Area (Layout-Aware) ── */}
        <main className="w-full">
          <AnimatePresence mode="wait">
            {variant === "editorial-masthead" ? (
              <motion.div
                key="editorial-content"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <EditorialMainPageContent
                  categories={CATEGORIES}
                  recentChanges={recentChanges}
                  isLoadingRecent={isLoadingRecent}
                  countries={randomCountries}
                  almanacSpotlight={almanacSpotlightData}
                  isLoadingAlmanac={isLoadingAlmanacArticle || isLoadingAlmanacMembers}
                />
              </motion.div>
            ) : (
              <motion.div
                key="sculpted-content"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <SculptedMainPageContent
                  categories={CATEGORIES}
                  recentChanges={recentChanges}
                  isLoadingRecent={isLoadingRecent}
                  countries={randomCountries}
                  almanacSpotlight={almanacSpotlightData}
                  isLoadingAlmanac={isLoadingAlmanacArticle || isLoadingAlmanacMembers}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* ── 3. Blurb Prompt Modal ── */}
      {activePrompt && (
        <BlurbPromptModal
          open={blurbModalOpen}
          onClose={() => setBlurbModalOpen(false)}
          prompt={activePrompt}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Extract featured article from Main_Page HTML
// ---------------------------------------------------------------------------

function extractFeaturedArticle(html: string): string | null {
  if (!html) return null;

  const patterns = [
    /<div[^>]*id="featured(?:_|&#95;)article"/i,
    /<div[^>]*id="mp-tfa"/i,
    /<div[^>]*id="mainpage-featured"/i,
    /<div[^>]*class="[^"]*(?:featured-article|tfa-box|mp-box|featured_article)[^"]*"/i,
    /<section[^>]*class="[^"]*featured[^"]*"/i,
  ];

  let startIdx = -1;
  for (const pattern of patterns) {
    const idx = html.search(pattern);
    if (idx !== -1) {
      startIdx = idx;
      break;
    }
  }

  if (startIdx === -1) {
    const cardIdx = html.search(/<div[^>]*class="[^"]*card[^"]*"/i);
    if (cardIdx !== -1) {
      startIdx = cardIdx;
    }
  }

  if (startIdx === -1) {
    if (html.length < 2500 && html.includes("<p>")) {
      return transformFeaturedContent(html);
    }
    return null;
  }

  let depth = 0;
  let pos = startIdx;
  const isSection = html.slice(startIdx, startIdx + 10).toLowerCase().startsWith("<section");
  const openTag = isSection ? "<section" : "<div";
  const closeTag = isSection ? "</section>" : "</div>";

  while (pos < html.length) {
    const nextOpen = html.indexOf(openTag, pos + (depth === 0 ? 0 : 1));
    const nextClose = html.indexOf(closeTag, pos);

    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openTag.length;
    } else {
      if (depth <= 1) {
        const endPos = nextClose + closeTag.length;
        return transformFeaturedContent(html.slice(startIdx, endPos));
      }
      depth--;
      pos = nextClose + closeTag.length;
    }
  }

  return null;
}

function transformFeaturedContent(cardHtml: string): string {
  return cardHtml
    .replace(/<div[^>]*class="[^"]*byline[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<p[^>]*class="[^"]*byline[^"]*"[^>]*>[\s\S]*?<\/p>/gi, "")
    .replace(/<div[^>]*class="[^"]*card-byline[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<p>\s*Featured article\s*<\/p>/gi, "")
    .replace(/class="card[^"]*"/i, 'class="wikios-fa-card"')
    .replace(/class="card-image[^"]*"/gi, 'class="wikios-fa-image"')
    .replace(/class="card-text"/gi, 'class="wikios-fa-text"')
    .replace(/class="byline"/gi, 'class="wikios-fa-byline hidden"')
    .replace(/href="\/w\/Special:MyLanguage\//g, 'href="/wiki/')
    .replace(/href="https?:\/\/ixwiki\.com\/wiki\//g, 'href="/wiki/');
}
