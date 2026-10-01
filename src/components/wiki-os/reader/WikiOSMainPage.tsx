"use client";
// src/components/wiki-os/reader/WikiOSMainPage.tsx
// Custom WikiOS main page

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { OpenBook as BookOpen, OpenNewWindow as ExternalLink } from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { WikiHeroMaster, type WikiHeroVariant } from "./hero";
import { EditorialMainPageContent, SculptedMainPageContent } from "./main";

const STORAGE_KEY = "wikios:heroVariant";
/** The page's data is built once a minute on the server. */
const MAIN_PAGE_STALE_MS = 60_000;

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
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col gap-0 overflow-hidden rounded-3xl border border-white/20 bg-white/80 p-0 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/90">
        {/* Header */}
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <BookOpen className="text-wiki h-4 w-4 shrink-0" />
                <DialogTitle className="text-base font-semibold">{prompt.title}</DialogTitle>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{prompt.question}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
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
                r.featured
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "bg-foreground/[0.02] border-white/10"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                {r.country?.flag && (
                  <img src={r.country.flag} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
                )}
                <span className="text-foreground text-xs font-medium">
                  {r.country?.name ?? "Unknown"}
                </span>
                {r.featured && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 px-1 py-0 text-xs text-amber-400"
                  >
                    Featured
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground line-clamp-4 text-sm whitespace-pre-wrap">
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
            className="text-wiki hover:text-wiki-hover inline-flex items-center gap-1.5 text-xs transition-colors"
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
        // oxlint-disable-next-line
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

  // One answer for the whole page (featured article, almanac, recent changes, counts, topic tiles,
  // prompt): the route reads it on the server, so it is in the first HTML and not fetched again.
  const { data: main } = api.wikios.getMainPage.useQuery(undefined, {
    staleTime: MAIN_PAGE_STALE_MS,
    refetchOnWindowFocus: false,
  });
  const categories = main?.categories ?? [];
  const featured = main?.featured ?? null;
  const recentChanges = main?.recentChanges;
  const activePrompt = main?.prompt ?? null;

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
      // oxlint-disable-next-line
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  }, [countries]);

  // Live query author info for the featured article
  const { data: featuredAuthorInfo } = api.wikios.getArticleAuthors.useQuery(
    { title: featured?.title ?? "" },
    {
      enabled: Boolean(featured?.title && featured.title !== "Featured Article"),
      staleTime: 5 * 60 * 1000,
    }
  );

  const featuredArticleData = useMemo(() => {
    if (!featured) return null;
    const creatorName =
      typeof featuredAuthorInfo?.creator === "object"
        ? featuredAuthorInfo?.creator?.username
        : (featuredAuthorInfo?.creator as string | undefined);
    const lastEditorName =
      typeof featuredAuthorInfo?.lastEditor === "object"
        ? featuredAuthorInfo?.lastEditor?.username
        : (featuredAuthorInfo?.lastEditor as string | undefined);

    return {
      title: featured.title,
      slug: featured.slug,
      imgSrc: featured.image,
      summary: featured.excerpt,
      authorInfo: featuredAuthorInfo
        ? {
            creator: creatorName || null,
            creatorAvatar: null,
            createdAt:
              typeof featuredAuthorInfo.creator === "object"
                ? featuredAuthorInfo.creator?.timestamp || null
                : null,
            lastEditor: lastEditorName || null,
            lastEditorAvatar: null,
            lastEditedAt:
              typeof featuredAuthorInfo.lastEditor === "object"
                ? featuredAuthorInfo.lastEditor?.timestamp || null
                : null,
          }
        : null,
    };
  }, [featured, featuredAuthorInfo]);

  // Extract latest live dispatch change
  const latestChange = useMemo(() => {
    const first = recentChanges?.[0];
    if (!first) return null;
    return {
      title: first.title,
      user: first.user,
      timestamp: first.timestamp,
      comment: first.comment,
    };
  }, [recentChanges]);

  // The almanac card: the server picked the day's article and read its lead and picture
  const almanacSpotlightData = useMemo(() => {
    const almanac = main?.almanac;
    if (!almanac) return null;
    return {
      ...almanac,
      excerpt:
        almanac.excerpt ||
        `Official comparative statistical catalog of the League of Nations Bureau of International Statistics for ${almanac.title}.`,
      metricLabel: "B.I.S. Registry",
      metricValue: "Official Index",
    };
  }, [main?.almanac]);

  return (
    <div className="wikios-main w-full pt-1 pb-3">
      <h1 className="sr-only">IxWiki, the IxStats encyclopedia</h1>
      <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5">
        {/* ── 1. Master Hero & Direction Switcher ── */}
        <header className="wikios-main-hero relative w-full">
          <div className="wikios-main-hero-inner w-full">
            <WikiHeroMaster
              variant={variant}
              onSelectVariant={handleSelectVariant}
              siteStats={main?.stats}
              activePrompt={activePrompt}
              featuredArticleData={featuredArticleData}
              latestChange={latestChange}
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
                  categories={categories}
                  recentChanges={recentChanges}
                  isLoadingRecent={!main}
                  countries={randomCountries}
                  almanacSpotlight={almanacSpotlightData}
                  isLoadingAlmanac={!main}
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
                  categories={categories}
                  recentChanges={recentChanges}
                  isLoadingRecent={!main}
                  countries={randomCountries}
                  almanacSpotlight={almanacSpotlightData}
                  isLoadingAlmanac={!main}
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
