// src/app/stashes/page.tsx
// Lore Stash manager — browse, organize, and annotate saved wiki pages, images, and forum threads.

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import {
  Bookmark,
  Plus,
  X,
  Loader2,
  AlertCircle,
  BookOpen,
  FolderOpen,
  Hash,
  HelpCircle,
  StickyNote,
  Highlighter,
} from "lucide-react";
import { cn } from "~/lib/utils";
import "~/styles/wiki-os.css";
import { StashWelcomeModal } from "~/components/wiki-os/shared/StashWelcomeModal";
import {
  PRESET_COLORS,
  StashSidebar,
  StashPagesList,
  StashImagesGrid,
  StashThreadsList,
  type CommonsImage,
  type StashTab,
} from "~/components/wiki-os/stashes";

export default function StashesPage() {
  usePageTitle({ title: "My Stash" });

  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [error, setError] = useState<string | null>(null);
  const [stashTab, setStashTab] = useState<StashTab>("pages");
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Reset tab when active stash changes
  useEffect(() => {
    setStashTab("pages");
  }, [selectedStashId]);

  const utils = api.useUtils();

  const stashesQuery = api.wikios.getStashes.useQuery();
  const createMutation = api.wikios.createStash.useMutation({
    onSuccess: (data) => {
      utils.wikios.getStashes.invalidate();
      setNewName("");
      setNewColor("#3b82f6");
      setShowCreate(false);
      setError(null);
      setSelectedStashId(data.id);
    },
    onError: (err) => setError(err.message ?? "Failed to create"),
  });
  const updateMutation = api.wikios.updateStash.useMutation({
    onSuccess: () => {
      utils.wikios.getStashes.invalidate();
    },
    onError: (err) => setError(err.message ?? "Failed to update"),
  });
  const deleteMutation = api.wikios.deleteStash.useMutation({
    onSuccess: () => {
      utils.wikios.getStashes.invalidate();
      setSelectedStashId(null);
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
    },
  });

  const items = itemsQuery.data?.items ?? [];

  const commonsImageTitles = useMemo(() => {
    return items
      .filter((item) => item.pageTitle.startsWith("commons:"))
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

  const totalPages = stashes.reduce((sum, s) => sum + s.itemCount, 0);

  const displayedPages = useMemo(
    () =>
      items.filter(
        (item) =>
          !item.pageTitle.startsWith("commons:") && !item.pageTitle.startsWith("forum:thread:")
      ),
    [items]
  );
  const displayedImages = useMemo(
    () => items.filter((item) => item.pageTitle.startsWith("commons:")),
    [items]
  );
  const displayedThreads = useMemo(
    () => items.filter((item) => item.pageTitle.startsWith("forum:thread:")),
    [items]
  );

  const currentCount =
    stashTab === "pages"
      ? displayedPages.length
      : stashTab === "images"
        ? displayedImages.length
        : displayedThreads.length;

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (stashes.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" already exists`);
      return;
    }
    setError(null);
    createMutation.mutate({ name: trimmed, color: newColor });
  };

  const handleUnstash = (pageTitle: string) => {
    unstashMutation.mutate({
      pageTitle,
      stashId: activeStash?.id,
    });
  };

  return (
    <>
      <SignedIn>
        <WikiOSLayout sidebarVariant="dashboard">
          <div className="wikios-root min-h-screen p-1 sm:p-2">
            <div className="w-full px-2 sm:px-4">
              {/* Header */}
              <div className="wikios-stashes-page-header">
                <div>
                  <h1 className="wikios-stashes-page-title flex items-center gap-2">
                    <Bookmark size={22} /> My Stash
                    <button
                      onClick={() => setWelcomeOpen(true)}
                      className="text-muted-foreground ml-1 cursor-pointer rounded p-0.5 transition-colors hover:bg-white/5 hover:text-rose-500"
                      title="Open Help Guide"
                    >
                      <HelpCircle size={16} />
                    </button>
                  </h1>
                  <p className="wikios-stashes-page-subtitle">
                    {totalPages} {totalPages === 1 ? "page" : "pages"} across {stashes.length}{" "}
                    {stashes.length === 1 ? "stash" : "stashes"}
                  </p>
                </div>
                {!showCreate && stashes.length > 0 && (
                  <button onClick={() => setShowCreate(true)} className="wikios-stashes-create-btn">
                    <Plus size={14} /> New Stash
                  </button>
                )}
              </div>

              {error && (
                <div className="wikios-stash-error-banner">
                  <AlertCircle size={14} /> {error}
                  <button onClick={() => setError(null)} className="wikios-stash-error-dismiss">
                    <X size={12} />
                  </button>
                </div>
              )}

              {stashesQuery.isLoading && (
                <div className="wikios-stashes-loading">
                  <Loader2 size={24} className="animate-spin opacity-40" />
                  <span>Loading your stashes...</span>
                </div>
              )}

              {/* Empty state */}
              {!stashesQuery.isLoading && stashes.length === 0 && !showCreate && (
                <div className="wikios-stashes-empty-state">
                  <div className="wikios-stashes-empty-icon">
                    <Bookmark size={40} />
                  </div>
                  <h2>Start your Lore Stash</h2>
                  <p>
                    Save wiki pages, media repository images, and forum threads to read later, add
                    personal notes, and highlight text with the Markup tool for your worldbuilding
                    research.
                  </p>
                  <div className="wikios-stashes-empty-features">
                    <div className="wikios-stashes-feature">
                      <BookOpen size={16} />
                      <div>
                        <strong>Save for later</strong>
                        <span>Bookmark pages across color-coded collections</span>
                      </div>
                    </div>
                    <div className="wikios-stashes-feature">
                      <StickyNote size={16} />
                      <div>
                        <strong>Personal notes</strong>
                        <span>Add rich text notes to any saved page</span>
                      </div>
                    </div>
                    <div className="wikios-stashes-feature">
                      <Highlighter size={16} />
                      <div>
                        <strong>Markup tool</strong>
                        <span>Highlight and annotate text directly on articles</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="wikios-stashes-empty-action"
                  >
                    <Plus size={14} /> Create your first stash
                  </button>
                </div>
              )}

              {/* Create form */}
              {showCreate && (
                <div className="wikios-stash-create-card">
                  <h3 className="wikios-stash-create-title">Create a new Lore Stash</h3>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setError(null);
                    }}
                    placeholder="e.g. Characters, Geography, Timeline, Magic System..."
                    className="wikios-stash-create-input-lg"
                    autoFocus
                    maxLength={100}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") setShowCreate(false);
                    }}
                  />
                  <div className="wikios-stash-create-color-row">
                    <span className="wikios-stash-create-color-label">Color:</span>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={cn(
                          "wikios-stash-preset-color-lg",
                          newColor === c && "wikios-stash-preset-active-lg"
                        )}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <div className="wikios-stash-create-actions-lg">
                    <button
                      onClick={() => {
                        setShowCreate(false);
                        setError(null);
                      }}
                      className="wikios-stash-btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      className="wikios-stash-btn-primary"
                      disabled={!newName.trim() || createMutation.isPending}
                    >
                      {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                      {createMutation.isPending ? "Creating..." : "Create Stash"}
                    </button>
                  </div>
                </div>
              )}

              {/* Main layout */}
              {stashes.length > 0 && (
                <div className="mt-6 flex flex-col gap-6 md:flex-row">
                  {/* Sidebar */}
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
                    onOpenCreate={() => setShowCreate(true)}
                    isUpdating={updateMutation.isPending}
                    isDeleting={deleteMutation.isPending}
                  />

                  {/* Main content */}
                  <div className="wikios-stashes-main min-w-0 flex-1">
                    {activeStash && (
                      <div className="wikios-stashes-content-header flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="wikios-stashes-content-title-row">
                            <span
                              className="wikios-stash-header-swatch"
                              style={{ background: activeStash.color }}
                            />
                            <h2 className="wikios-stashes-stash-name">{activeStash.name}</h2>
                          </div>
                          <div className="wikios-stashes-content-stats">
                            <span>
                              <Hash size={12} /> {activeStash.itemCount}{" "}
                              {activeStash.itemCount === 1 ? "item" : "items"}
                            </span>
                          </div>
                        </div>

                        <div className="wikios-filter-group select-none">
                          <button
                            onClick={() => setStashTab("pages")}
                            className={cn(
                              "wikios-filter-btn",
                              stashTab === "pages" && "wikios-filter-btn--active"
                            )}
                          >
                            Pages ({displayedPages.length})
                          </button>
                          <button
                            onClick={() => setStashTab("images")}
                            className={cn(
                              "wikios-filter-btn",
                              stashTab === "images" && "wikios-filter-btn--active"
                            )}
                          >
                            Images ({displayedImages.length})
                          </button>
                          <button
                            onClick={() => setStashTab("threads")}
                            className={cn(
                              "wikios-filter-btn",
                              stashTab === "threads" && "wikios-filter-btn--active"
                            )}
                          >
                            Threads ({displayedThreads.length})
                          </button>
                        </div>
                      </div>
                    )}

                    {itemsQuery.isLoading && (
                      <div className="wikios-stashes-loading-sm">
                        <Loader2 size={16} className="animate-spin opacity-40" />
                      </div>
                    )}

                    {currentCount === 0 && !itemsQuery.isLoading && activeStash && (
                      <div className="wikios-stashes-empty-stash">
                        <FolderOpen size={36} className="opacity-15" />
                        <p>No stashed {stashTab} found</p>
                        <p className="wikios-stashes-empty-hint">
                          {stashTab === "pages" ? (
                            <>
                              Browse wiki articles and click{" "}
                              <Bookmark size={12} className="inline" /> <strong>Stash</strong> to
                              save pages here.
                              <br />
                              Use the <Highlighter size={12} className="inline" />{" "}
                              <strong>Markup</strong> tool on stashed pages to highlight and
                              annotate text.
                            </>
                          ) : stashTab === "images" ? (
                            <>
                              Browse the{" "}
                              <Link
                                href={withBasePath("/wiki/repository")}
                                className="text-[var(--wikios-accent)] hover:underline"
                              >
                                Image Repository
                              </Link>{" "}
                              and click the <Bookmark size={12} className="inline" />{" "}
                              <strong>Stash</strong> button to save media images here.
                            </>
                          ) : (
                            <>
                              Browse the{" "}
                              <Link
                                href={withBasePath("/forum")}
                                className="text-[var(--wikios-accent)] hover:underline"
                              >
                                Forum
                              </Link>{" "}
                              and click the bookmark icon on thread posts to save threads here.
                            </>
                          )}
                        </p>
                      </div>
                    )}

                    {stashTab === "pages" && displayedPages.length > 0 && (
                      <StashPagesList items={displayedPages} onUnstash={handleUnstash} />
                    )}

                    {stashTab === "images" && displayedImages.length > 0 && (
                      <StashImagesGrid
                        items={displayedImages}
                        resolvedImagesMap={resolvedImagesMap}
                        onUnstash={handleUnstash}
                      />
                    )}

                    {stashTab === "threads" && displayedThreads.length > 0 && (
                      <StashThreadsList items={displayedThreads} onUnstash={handleUnstash} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <StashWelcomeModal open={welcomeOpen} onOpenChangeAction={setWelcomeOpen} />
        </WikiOSLayout>
      </SignedIn>
      <SignedOut>
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
          <div className="mx-auto max-w-sm text-center">
            <Bookmark className="mx-auto mb-4 h-12 w-12 text-slate-400 dark:text-slate-600" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Access Lore Stashes
            </h2>
            <p className="mt-2 mb-6 text-sm text-slate-500 dark:text-slate-400">
              Please sign in to view your saved collections, highlights, and stashed images or forum
              threads.
            </p>
            <SignInButton mode="modal" />
          </div>
        </div>
      </SignedOut>
    </>
  );
}
