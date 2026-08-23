// src/app/stashes/page.tsx
// Stash manager — browse, organize, search, and annotate saved wiki pages, quotes, images, and forum threads.
// Apple Design & WikiOS standard.

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import {
  Bookmark,
  Xmark as X,
  SystemRestart as Loader2,
  WarningCircle as AlertCircle,
  HelpCircle,
  DesignPencil as Highlighter,
  Search,
  MediaImage as ImageIcon,
  ChatBubble as MessageSquare,
} from "iconoir-react";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";
import { StashWelcomeModal } from "~/components/wiki-os/shared/StashWelcomeModal";
import {
  StashSidebar,
  StashPagesList,
  StashQuotesList,
  StashImagesGrid,
  StashThreadsList,
  StashSettingsMenu,
  CreateStashPopover,
  type CommonsImage,
  type StashTab,
  type StashedQuoteItem,
} from "~/components/wiki-os/stashes";

export default function StashesPage() {
  usePageTitle({ title: "Stash" });
  const notify = useNotify();

  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stashTab, setStashTab] = useState<StashTab>("articles");
  const [searchQuery, setSearchQuery] = useState("");
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Reset tab & search when active stash changes
  useEffect(() => {
    setStashTab("articles");
    setSearchQuery("");
  }, [selectedStashId]);

  const utils = api.useUtils();

  const stashesQuery = api.wikios.getStashes.useQuery();
  const createMutation = api.wikios.createStash.useMutation({
    onSuccess: (data) => {
      utils.wikios.getStashes.invalidate();
      soundEffects.press();
      setError(null);
      setSelectedStashId(data.id);
      notify.success(`Created collection "${data.name}"`);
    },
    onError: (err) => setError(err.message ?? "Failed to create"),
  });

  const updateMutation = api.wikios.updateStash.useMutation({
    onSuccess: () => {
      utils.wikios.getStashes.invalidate();
      notify.success("Collection updated");
    },
    onError: (err) => setError(err.message ?? "Failed to update"),
  });

  const deleteMutation = api.wikios.deleteStash.useMutation({
    onSuccess: () => {
      utils.wikios.getStashes.invalidate();
      setSelectedStashId(null);
      notify.success("Collection deleted");
    },
    onError: (err) => setError(err.message ?? "Failed to delete"),
  });

  const stashes = stashesQuery.data ?? [];
  const activeStash = selectedStashId ? stashes.find((s) => s.id === selectedStashId) : stashes[0];

  const itemsQuery = api.wikios.getStashItems.useQuery(
    { stashId: activeStash?.id ?? "", limit: 50 },
    { enabled: !!activeStash?.id }
  );

  const unstashMutation = api.wikios.unstashPage.useMutation({
    onSuccess: () => {
      utils.wikios.getStashItems.invalidate();
      utils.wikios.getStashes.invalidate();
      notify.success("Removed from collection");
    },
  });

  const items = itemsQuery.data?.items ?? [];

  // Group items by category
  const allArticles = useMemo(
    () =>
      items.filter(
        (item) =>
          item.contentType === "wiki" ||
          (!item.pageTitle.startsWith("commons:") && !item.pageTitle.startsWith("forum:thread:"))
      ),
    [items]
  );

  const articleTitles = useMemo(() => allArticles.map((a) => a.pageTitle), [allArticles]);

  // Fetch article lead thumbnails
  const { data: thumbnailsMap } = api.wikios.getArticleThumbnails.useQuery(
    { titles: articleTitles },
    { enabled: articleTitles.length > 0, staleTime: 5 * 60 * 1000 }
  );

  // Filter image titles for media resolution
  const commonsImageTitles = useMemo(() => {
    return items
      .filter((item) => item.contentType === "image" || item.pageTitle.startsWith("commons:"))
      .map((item) => item.pageTitle.replace(/^commons:/, ""));
  }, [items]);

  const { data: resolvedCommonsImages } = api.commons.getImageInfoByTitles.useQuery(
    { titles: commonsImageTitles },
    { enabled: commonsImageTitles.length > 0, staleTime: 5 * 60 * 1000 }
  );

  const resolvedImagesMap = useMemo(() => {
    const map = new Map<string, CommonsImage>();
    if (resolvedCommonsImages) {
      for (const img of resolvedCommonsImages) {
        map.set(`commons:${img.title}`, img);
      }
    }
    return map;
  }, [resolvedCommonsImages]);

  const totalItems = stashes.reduce((sum, s) => sum + s.itemCount, 0);

  const allImages = useMemo(
    () =>
      items.filter(
        (item) => item.contentType === "image" || item.pageTitle.startsWith("commons:")
      ),
    [items]
  );

  const allThreads = useMemo(
    () =>
      items.filter(
        (item) => item.contentType === "forum_thread" || item.pageTitle.startsWith("forum:thread:")
      ),
    [items]
  );

  // Flatten quotes across all saved articles in this stash
  const allQuotes: StashedQuoteItem[] = useMemo(() => {
    const list: StashedQuoteItem[] = [];
    for (const article of allArticles) {
      if (article.annotations && article.annotations.length > 0) {
        for (const ann of article.annotations) {
          list.push({
            id: ann.id,
            itemId: article.id,
            pageTitle: article.pageTitle,
            pageSlug: article.pageSlug,
            selectedText: ann.selectedText,
            comment: ann.comment,
            color: ann.color,
            savedAt: ann.createdAt,
          });
        }
      }
    }
    return list;
  }, [allArticles]);

  // Apply search query filter
  const query = searchQuery.trim().toLowerCase();

  const filteredArticles = useMemo(() => {
    if (!query) return allArticles;
    return allArticles.filter(
      (a) =>
        a.pageTitle.toLowerCase().includes(query) ||
        (a.note && a.note.toLowerCase().includes(query))
    );
  }, [allArticles, query]);

  const filteredQuotes = useMemo(() => {
    if (!query) return allQuotes;
    return allQuotes.filter(
      (q) =>
        q.selectedText.toLowerCase().includes(query) ||
        q.pageTitle.toLowerCase().includes(query) ||
        (q.comment && q.comment.toLowerCase().includes(query))
    );
  }, [allQuotes, query]);

  const filteredImages = useMemo(() => {
    if (!query) return allImages;
    return allImages.filter((img) => img.pageTitle.toLowerCase().includes(query));
  }, [allImages, query]);

  const filteredThreads = useMemo(() => {
    if (!query) return allThreads;
    return allThreads.filter(
      (t) =>
        t.pageTitle.toLowerCase().includes(query) ||
        (t.note && t.note.toLowerCase().includes(query))
    );
  }, [allThreads, query]);

  const handleUnstash = (pageTitle: string) => {
    unstashMutation.mutate({
      pageTitle,
      stashId: activeStash?.id,
    });
  };

  // Export current collection to Markdown
  const handleExportMarkdown = () => {
    if (!activeStash) return;
    soundEffects.press();
    const lines = [
      `# ${activeStash.name} (Stash Export)`,
      `Exported from WikiOS Stash on ${new Date().toLocaleDateString()}`,
      ``,
      `## Articles (${allArticles.length})`,
      ...allArticles.map((a) => `- [${a.pageTitle.replace(/_/g, " ")}](/wiki/${a.pageSlug})`),
      ``,
      `## Saved Quotes & Highlights (${allQuotes.length})`,
      ...allQuotes.map(
        (q) =>
          `> "${q.selectedText}"\n> — *From [${q.pageTitle.replace(/_/g, " ")}](/wiki/${q.pageSlug})*${q.comment ? `\n> Note: ${q.comment}` : ""}\n`
      ),
      ``,
      `## Media (${allImages.length})`,
      ...allImages.map((img) => `- ${img.pageTitle}`),
      ``,
      `## Discussions (${allThreads.length})`,
      ...allThreads.map((t) => `- ${t.pageTitle}`),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeStash.name.toLowerCase().replace(/\s+/g, "_")}_stash.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify.success("Exported collection to Markdown");
  };

  // Export current collection to JSON
  const handleExportJson = () => {
    if (!activeStash) return;
    soundEffects.press();
    const data = {
      name: activeStash.name,
      color: activeStash.color,
      itemCount: activeStash.itemCount,
      exportedAt: new Date().toISOString(),
      articles: allArticles.map((a) => ({
        title: a.pageTitle,
        slug: a.pageSlug,
        savedAt: a.savedAt,
        note: a.note,
        annotations: a.annotations,
      })),
      quotes: allQuotes,
      images: allImages.map((img) => ({ title: img.pageTitle, id: img.id })),
      threads: allThreads.map((t) => ({ title: t.pageTitle, slug: t.pageSlug, savedAt: t.savedAt })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeStash.name.toLowerCase().replace(/\s+/g, "_")}_stash.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify.success("Exported collection to JSON");
  };

  const tabs: Array<{ id: StashTab; label: string; count: number; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "articles", label: "Articles", count: allArticles.length, icon: WikiOSLogomark },
    { id: "quotes", label: "Quotes", count: allQuotes.length, icon: Highlighter },
    { id: "images", label: "Media", count: allImages.length, icon: ImageIcon },
    { id: "threads", label: "Threads", count: allThreads.length, icon: MessageSquare },
  ];

  return (
    <>
      <SignedIn>
        <WikiOSLayout sidebarVariant="dashboard">
          <div className="min-h-screen p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
            {/* Top Page Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--wikios-border)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/15 text-rose-400 shadow-md">
                  <Bookmark className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-[var(--wikios-text)]">
                      Stash
                    </h1>
                    <button
                      type="button"
                      onClick={() => setWelcomeOpen(true)}
                      className="text-[var(--wikios-text-dim)] hover:text-rose-400 p-1 rounded-lg hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                      title="Stash Guide"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-[var(--wikios-text-dim)]">
                    {totalItems} item{totalItems === 1 ? "" : "s"} saved across {stashes.length}{" "}
                    collection{stashes.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2">
                <CreateStashPopover
                  onCreate={async (params) => {
                    await createMutation.mutateAsync(params);
                  }}
                  isCreating={createMutation.isPending}
                  existingNames={stashes.map((s) => s.name)}
                />
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="p-1 text-rose-300 hover:text-white rounded-lg hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Main Content Layout: Sidebar + Canvas */}
            {stashes.length > 0 && (
              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Left Collections Rail */}
                <StashSidebar
                  stashes={stashes}
                  activeStashId={activeStash?.id}
                  onSelectStash={setSelectedStashId}
                  onUpdateStash={async (params) => {
                    await updateMutation.mutateAsync(params);
                  }}
                  onDeleteStash={async (id) => {
                    await deleteMutation.mutateAsync({ id });
                  }}
                  onCreateStash={async (params) => {
                    await createMutation.mutateAsync(params);
                  }}
                  isCreating={createMutation.isPending}
                  isUpdating={updateMutation.isPending}
                  isDeleting={deleteMutation.isPending}
                />

                {/* Right Content Canvas */}
                <main className="flex-1 min-w-0 w-full space-y-4">
                  {activeStash && (
                    <div className="p-4 rounded-3xl bg-[var(--wikios-card-bg)]/80 border border-[var(--wikios-border)] shadow-xs backdrop-blur-xl space-y-4">
                      {/* Active Stash Header Banner */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--wikios-border)]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                            style={{
                              backgroundColor: activeStash.color,
                              boxShadow: `0 0 12px ${activeStash.color}80`,
                            }}
                          />
                          <h2 className="text-base font-bold text-[var(--wikios-text)] tracking-tight truncate">
                            {activeStash.name}
                          </h2>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--wikios-surface)] border border-[var(--wikios-border)] text-[var(--wikios-text-dim)] shrink-0">
                            {activeStash.itemCount} item{activeStash.itemCount === 1 ? "" : "s"}
                          </span>
                        </div>

                        {/* Stash Settings Dropdown (Rename, Color Swatches, Export MD/JSON, Share, Delete) */}
                        <StashSettingsMenu
                          stash={activeStash}
                          onUpdateStash={async (params) => {
                            await updateMutation.mutateAsync(params);
                          }}
                          onDeleteStash={async (id) => {
                            await deleteMutation.mutateAsync({ id });
                          }}
                          onExportMarkdown={handleExportMarkdown}
                          onExportJson={handleExportJson}
                          isUpdating={updateMutation.isPending}
                          isDeleting={deleteMutation.isPending}
                        />
                      </div>

                      {/* Search Bar + Floating Segmented Tab Bar */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        {/* Instant Filter Search */}
                        <div className="relative flex-1 max-w-xs">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--wikios-text-dim)]" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter in this stash..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] text-xs text-[var(--wikios-text)] placeholder:text-[var(--wikios-text-dim)] outline-none focus:border-[var(--wikios-accent)] transition-colors shadow-2xs"
                          />
                        </div>

                        {/* Segmented Tab Control */}
                        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-[var(--wikios-border)] relative shadow-2xs self-start sm:self-auto">
                          {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = stashTab === tab.id;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                  soundEffects.press();
                                  setStashTab(tab.id);
                                }}
                                className={cn(
                                  "relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none",
                                  isActive
                                    ? "text-[var(--wikios-text)] font-bold shadow-xs"
                                    : "text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)]"
                                )}
                              >
                                {isActive && (
                                  <motion.div
                                    layoutId="stash-active-tab-pill"
                                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                                    className="absolute inset-0 rounded-xl bg-[var(--wikios-surface)] border border-[var(--wikios-border)] shadow-xs"
                                  />
                                )}
                                <Icon className="w-3.5 h-3.5 relative z-10" />
                                <span className="relative z-10">{tab.label}</span>
                                <span
                                  className={cn(
                                    "relative z-10 ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold leading-none",
                                    isActive
                                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/25"
                                      : "bg-white/5 text-[var(--wikios-text-dim)]"
                                  )}
                                >
                                  {tab.count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Loading State */}
                      {itemsQuery.isLoading && (
                        <div className="py-16 flex flex-col items-center justify-center gap-2 text-[var(--wikios-text-muted)]">
                          <Loader2 className="h-6 w-6 animate-spin opacity-40 text-rose-500" />
                          <span className="text-xs">Loading stash items...</span>
                        </div>
                      )}

                      {/* Content Views */}
                      {!itemsQuery.isLoading && (
                        <div>
                          {/* Tab 1: Articles */}
                          {stashTab === "articles" && (
                            filteredArticles.length > 0 ? (
                              <StashPagesList
                                items={filteredArticles}
                                onUnstash={handleUnstash}
                                thumbnailsMap={thumbnailsMap ?? {}}
                              />
                            ) : (
                              <div className="py-16 text-center space-y-2 text-[var(--wikios-text-muted)]">
                                <WikiOSLogomark className="h-10 w-10 mx-auto opacity-20 text-[var(--wikios-accent)]" />
                                <p className="text-xs font-bold text-[var(--wikios-text)]">
                                  {query ? "No articles match your search" : "No articles in this collection"}
                                </p>
                                <p className="text-[11px] text-[var(--wikios-text-dim)] max-w-sm mx-auto">
                                  Browse wiki articles and click the <Bookmark className="h-3 w-3 inline text-rose-400" /> <strong>Stash</strong> button in the toolbar to save them here.
                                </p>
                              </div>
                            )
                          )}

                          {/* Tab 2: Quotes & Highlights */}
                          {stashTab === "quotes" && (
                            filteredQuotes.length > 0 ? (
                              <StashQuotesList quotes={filteredQuotes} />
                            ) : (
                              <div className="py-16 text-center space-y-2 text-[var(--wikios-text-muted)]">
                                <Highlighter className="h-10 w-10 mx-auto opacity-20" />
                                <p className="text-xs font-bold text-[var(--wikios-text)]">
                                  {query ? "No quotes match your search" : "No saved quotes in this collection"}
                                </p>
                                <p className="text-[11px] text-[var(--wikios-text-dim)] max-w-sm mx-auto">
                                  Highlight text while reading an article and click <strong>Save Quote</strong> in the Margin capsule to curate excerpts here.
                                </p>
                              </div>
                            )
                          )}

                          {/* Tab 3: Media & Images */}
                          {stashTab === "images" && (
                            filteredImages.length > 0 ? (
                              <StashImagesGrid
                                items={filteredImages}
                                resolvedImagesMap={resolvedImagesMap}
                                onUnstash={handleUnstash}
                              />
                            ) : (
                              <div className="py-16 text-center space-y-2 text-[var(--wikios-text-muted)]">
                                <ImageIcon className="h-10 w-10 mx-auto opacity-20" />
                                <p className="text-xs font-bold text-[var(--wikios-text)]">
                                  {query ? "No media matches your search" : "No media in this collection"}
                                </p>
                                <p className="text-[11px] text-[var(--wikios-text-dim)] max-w-sm mx-auto">
                                  Browse the{" "}
                                  <Link
                                    href={withBasePath("/wiki/repository")}
                                    className="text-[var(--wikios-accent)] font-semibold hover:underline"
                                  >
                                    Media Repository
                                  </Link>{" "}
                                  and click Stash to curate visual assets.
                                </p>
                              </div>
                            )
                          )}

                          {/* Tab 4: Forum Threads */}
                          {stashTab === "threads" && (
                            filteredThreads.length > 0 ? (
                              <StashThreadsList items={filteredThreads} onUnstash={handleUnstash} />
                            ) : (
                              <div className="py-16 text-center space-y-2 text-[var(--wikios-text-muted)]">
                                <MessageSquare className="h-10 w-10 mx-auto opacity-20" />
                                <p className="text-xs font-bold text-[var(--wikios-text)]">
                                  {query ? "No threads match your search" : "No forum threads in this collection"}
                                </p>
                                <p className="text-[11px] text-[var(--wikios-text-dim)] max-w-sm mx-auto">
                                  Browse the{" "}
                                  <Link
                                    href={withBasePath("/forum")}
                                    className="text-orange-400 font-semibold hover:underline"
                                  >
                                    Forum
                                  </Link>{" "}
                                  and bookmark threads to save them here.
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </main>
              </div>
            )}
          </div>

          <StashWelcomeModal open={welcomeOpen} onOpenChangeAction={setWelcomeOpen} />
        </WikiOSLayout>
      </SignedIn>

      <SignedOut>
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--wikios-bg)] p-4 text-[var(--wikios-text)]">
          <div className="mx-auto max-w-sm text-center space-y-4 p-8 rounded-3xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 backdrop-blur-2xl shadow-xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mx-auto shadow-md">
              <Bookmark className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Access Stash</h2>
              <p className="mt-1 text-xs text-[var(--wikios-text-muted)] leading-relaxed">
                Sign in to manage your saved lore collections, highlights, media assets, and forum bookmarks.
              </p>
            </div>
            <SignInButton mode="modal" />
          </div>
        </div>
      </SignedOut>
    </>
  );
}
