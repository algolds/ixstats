"use client";
// src/app/stashes/page.tsx
// Stash manager — browse, organize, search, and annotate saved wiki pages, quotes, images, and forum threads.
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { FORUM_HOME } from "~/lib/thinkpages-forum/links";
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
  MediaImage as ImageIcon,
  ChatBubble as MessageSquare,
} from "iconoir-react";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";
import { StashWelcomeModal } from "~/components/wiki-os/shared/StashWelcomeModal";
import { Button } from "~/components/ui/button";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  StashSidebar,
  StashPagesList,
  StashQuotesList,
  StashImagesGrid,
  StashThreadsList,
  StashSettingsMenu,
  CreateStashPopover,
  type StashTab,
  type StashedQuoteItem,
} from "~/components/wiki-os/stashes";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";
import { isStashedArticle, isStashedForumThread } from "~/lib/wiki-os/stash-content-type";

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
    // oxlint-disable-next-line
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
      items.filter(isStashedArticle),
    // oxlint-disable-next-line
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
    // oxlint-disable-next-line
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
      items.filter((item) => item.contentType === "image" || item.pageTitle.startsWith("commons:")),
    // oxlint-disable-next-line
    [items]
  );

  const allThreads = useMemo(
    () => items.filter(isStashedForumThread),
    // oxlint-disable-next-line
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

  const handleUnstash = (pageTitle: string, contentType?: string) => {
    unstashMutation.mutate({
      pageTitle,
      contentType,
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
      ...allThreads.map((t) => `- ${t.note ?? t.pageTitle}`),
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
      threads: allThreads.map((t) => ({
        title: t.pageTitle,
        slug: t.pageSlug,
        savedAt: t.savedAt,
      })),
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

  const tabs: Array<{
    id: StashTab;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "articles", label: "Articles", count: allArticles.length, icon: WikiOSLogomark },
    { id: "quotes", label: "Quotes", count: allQuotes.length, icon: Highlighter },
    { id: "images", label: "Media", count: allImages.length, icon: ImageIcon },
    { id: "threads", label: "Threads", count: allThreads.length, icon: MessageSquare },
  ];

  return (
    <>
      <SignedIn>
        <WikiOSLayout>
          <div className="mx-auto min-h-screen max-w-7xl space-y-6 p-3 sm:p-6">
            {/* Top Page Header */}
            <div className="border-separator flex flex-wrap items-center justify-between gap-4 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-red/10 text-red rounded-card flex size-11 items-center justify-center">
                  <Bookmark className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-large-title text-label">Stash</h1>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setWelcomeOpen(true)}
                      title="Stash guide"
                      aria-label="Stash guide"
                    >
                      <HelpCircle aria-hidden />
                    </Button>
                  </div>
                  <p className="text-footnote text-label-secondary">
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
              <div
                role="alert"
                className="animate-in fade-in bg-destructive/10 rounded-row text-footnote text-destructive flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setError(null)}
                  aria-label="Dismiss error"
                  className="text-destructive"
                >
                  <X aria-hidden />
                </Button>
              </div>
            )}

            {/* Main Content Layout: Sidebar + Canvas */}
            {stashes.length > 0 && (
              <div className="flex flex-col items-start gap-6 md:flex-row">
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
                <main className="w-full min-w-0 flex-1 space-y-4">
                  {activeStash && (
                    <div className="border-separator bg-surface rounded-card shadow-card space-y-4 border p-4">
                      {/* Active Stash Header Banner */}
                      <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="shadow-card h-3.5 w-3.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: activeStash.color,
                              boxShadow: `0 0 12px ${activeStash.color}80`,
                            }}
                          />
                          <h2 className="text-headline text-label truncate">{activeStash.name}</h2>
                          <span className="border-separator bg-surface-secondary text-caption text-label-secondary shrink-0 rounded-full border px-2 py-0.5 font-semibold">
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
                      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                        {/* Instant Filter Search */}
                        <SearchField
                          size="sm"
                          containerClassName="max-w-xs flex-1"
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                          aria-label="Filter in this stash"
                          placeholder="Filter in this stash..."
                        />

                        {/* Segmented Tab Control */}
                        <SegmentedControl
                          aria-label="Stash content"
                          size="sm"
                          className="self-start sm:self-auto"
                          value={stashTab}
                          onValueChange={(next) => {
                            soundEffects.press();
                            setStashTab(next);
                          }}
                          options={tabs.map((tab) => ({
                            value: tab.id,
                            icon: <tab.icon />,
                            "aria-label": `${tab.label} (${tab.count})`,
                            label: (
                              <span className="flex items-center gap-1">
                                {tab.label}
                                <span className="text-caption text-label-secondary tabular-nums">
                                  {tab.count}
                                </span>
                              </span>
                            ),
                          }))}
                        />
                      </div>

                      {/* Loading State */}
                      {itemsQuery.isLoading && (
                        <div className="text-label-secondary flex flex-col items-center justify-center gap-2 py-16">
                          <Loader2 className="text-red h-6 w-6 animate-spin opacity-40" />
                          <span className="text-footnote">Loading stash items...</span>
                        </div>
                      )}

                      {/* Content Views */}
                      {!itemsQuery.isLoading && (
                        <div>
                          {/* Tab 1: Articles */}
                          {stashTab === "articles" &&
                            (filteredArticles.length > 0 ? (
                              <StashPagesList
                                items={filteredArticles}
                                onUnstash={handleUnstash}
                                thumbnailsMap={thumbnailsMap ?? {}}
                              />
                            ) : (
                              <div className="text-label-secondary space-y-2 py-16 text-center">
                                <WikiOSLogomark className="text-tint mx-auto h-10 w-10 opacity-20" />
                                <p className="text-headline text-label">
                                  {query
                                    ? "No articles match your search"
                                    : "No articles in this collection"}
                                </p>
                                <p className="text-footnote text-label-secondary mx-auto max-w-sm">
                                  Browse wiki articles and click the{" "}
                                  <Bookmark className="text-red inline h-3 w-3" />{" "}
                                  <strong>Stash</strong> button in the toolbar to save them here.
                                </p>
                              </div>
                            ))}

                          {/* Tab 2: Quotes & Highlights */}
                          {stashTab === "quotes" &&
                            (filteredQuotes.length > 0 ? (
                              <StashQuotesList quotes={filteredQuotes} />
                            ) : (
                              <div className="text-label-secondary space-y-2 py-16 text-center">
                                <Highlighter className="mx-auto h-10 w-10 opacity-20" />
                                <p className="text-headline text-label">
                                  {query
                                    ? "No quotes match your search"
                                    : "No saved quotes in this collection"}
                                </p>
                                <p className="text-footnote text-label-secondary mx-auto max-w-sm">
                                  Highlight text while reading an article and click{" "}
                                  <strong>Save quote</strong> in the Margin capsule to curate
                                  excerpts here.
                                </p>
                              </div>
                            ))}

                          {/* Tab 3: Media & Images */}
                          {stashTab === "images" &&
                            (filteredImages.length > 0 ? (
                              <StashImagesGrid
                                items={filteredImages}
                                resolvedImagesMap={resolvedImagesMap}
                                onUnstash={handleUnstash}
                              />
                            ) : (
                              <div className="text-label-secondary space-y-2 py-16 text-center">
                                <ImageIcon className="mx-auto h-10 w-10 opacity-20" />
                                <p className="text-headline text-label">
                                  {query
                                    ? "No media matches your search"
                                    : "No media in this collection"}
                                </p>
                                <p className="text-footnote text-label-secondary mx-auto max-w-sm">
                                  Browse the{" "}
                                  <Link
                                    href={withBasePath("/util/repository")}
                                    className="text-tint font-semibold hover:underline"
                                  >
                                    Media repository
                                  </Link>{" "}
                                  and click Stash to curate visual assets.
                                </p>
                              </div>
                            ))}

                          {/* Tab 4: Forum Threads */}
                          {stashTab === "threads" &&
                            (filteredThreads.length > 0 ? (
                              <StashThreadsList items={filteredThreads} onUnstash={handleUnstash} />
                            ) : (
                              <div className="text-label-secondary space-y-2 py-16 text-center">
                                <MessageSquare className="mx-auto h-10 w-10 opacity-20" />
                                <p className="text-headline text-label">
                                  {query
                                    ? "No threads match your search"
                                    : "No forum threads in this collection"}
                                </p>
                                <p className="text-footnote text-label-secondary mx-auto max-w-sm">
                                  Browse the{" "}
                                  <Link
                                    href={FORUM_HOME}
                                    className="text-orange font-semibold hover:underline"
                                  >
                                    Forum
                                  </Link>{" "}
                                  and bookmark threads to save them here.
                                </p>
                              </div>
                            ))}
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
        <div className="bg-background text-label flex min-h-screen flex-col items-center justify-center p-4">
          <div className="rounded-sheet border-separator bg-surface shadow-floating mx-auto max-w-sm space-y-4 border p-8 text-center">
            <div className="bg-red/10 text-red rounded-card mx-auto flex size-14 items-center justify-center">
              <Bookmark className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-title-3">Access stash</h2>
              <p className="text-footnote text-label-secondary mt-1 leading-relaxed">
                Sign in to manage your saved lore collections, highlights, media assets, and forum
                bookmarks.
              </p>
            </div>
            <SignInButton mode="modal" />
          </div>
        </div>
      </SignedOut>
    </>
  );
}
