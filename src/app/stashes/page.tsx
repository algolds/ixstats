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
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { createPortal } from "react-dom";
import {
  Bookmark,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Clock,
  StickyNote,
  Highlighter,
  Loader2,
  AlertCircle,
  ArrowRight,
  BookOpen,
  FolderOpen,
  Hash,
  Copy,
  Download,
  ZoomIn,
  MessageSquare,
  HelpCircle,
  ImageIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import "~/styles/wiki-os.css";
import { StashWelcomeModal } from "~/components/wiki-os/shared/StashWelcomeModal";
import { sanitizeUserContent } from "~/lib/sanitize-html";

const PRESET_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
];

interface CommonsImage {
  pageid: number;
  title: string;
  thumbUrl: string;
  url: string;
  descriptionUrl: string;
  width: number;
  height: number;
  mime: string;
  description: string;
  artist: string;
  license: string;
}

export default function StashesPage() {
  usePageTitle({ title: "My Stash" });

  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);
  const [editingStash, setEditingStash] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<CommonsImage | null>(null);
  const [stashTab, setStashTab] = useState<"pages" | "images" | "threads">("pages");
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
      setEditingStash(null);
    },
    onError: (err) => setError(err.message ?? "Failed to update"),
  });
  const deleteMutation = api.wikios.deleteStash.useMutation({
    onSuccess: () => {
      utils.wikios.getStashes.invalidate();
      setSelectedStashId(null);
      setConfirmDelete(null);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const displayedItems = useMemo(() => {
    if (stashTab === "pages") {
      return items.filter(
        (item) =>
          !item.pageTitle.startsWith("commons:") && !item.pageTitle.startsWith("forum:thread:")
      );
    } else if (stashTab === "images") {
      return items.filter((item) => item.pageTitle.startsWith("commons:"));
    } else {
      return items.filter((item) => item.pageTitle.startsWith("forum:thread:"));
    }
  }, [items, stashTab]);

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
                  <div className="wikios-stashes-sidebar w-full shrink-0 md:w-60">
                    <div className="wikios-stashes-sidebar-label">Your Stashes</div>
                    {stashes.map((s) => (
                      <div key={s.id} className="wikios-stash-sidebar-item-wrapper">
                        {editingStash === s.id ? (
                          <div className="wikios-stash-edit-inline">
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="wikios-stash-edit-input"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  updateMutation.mutate({
                                    id: s.id,
                                    name: editName,
                                    color: editColor,
                                  });
                                if (e.key === "Escape") setEditingStash(null);
                              }}
                            />
                            <div className="wikios-stash-edit-colors">
                              {PRESET_COLORS.map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setEditColor(c)}
                                  className={cn(
                                    "wikios-stash-preset-color",
                                    editColor === c && "wikios-stash-preset-active"
                                  )}
                                  style={{ background: c }}
                                />
                              ))}
                            </div>
                            <div className="wikios-stash-edit-actions">
                              <button
                                onClick={() =>
                                  updateMutation.mutate({
                                    id: s.id,
                                    name: editName,
                                    color: editColor,
                                  })
                                }
                                className="wikios-stash-btn-primary-sm"
                                disabled={updateMutation.isPending}
                              >
                                {updateMutation.isPending ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Check size={11} />
                                )}{" "}
                                Save
                              </button>
                              <button
                                onClick={() => setEditingStash(null)}
                                className="wikios-stash-btn-secondary-sm"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedStashId(s.id)}
                            className={cn(
                              "wikios-stash-sidebar-item",
                              activeStash?.id === s.id && "wikios-stash-sidebar-active"
                            )}
                          >
                            <span
                              className="wikios-stash-sidebar-color"
                              style={{ background: s.color }}
                            />
                            <span className="wikios-stash-sidebar-name">{s.name}</span>
                            <span className="wikios-stash-sidebar-count">{s.itemCount}</span>
                          </button>
                        )}
                        {editingStash !== s.id && (
                          <div className="wikios-stash-sidebar-actions">
                            <button
                              onClick={() => {
                                setEditingStash(s.id);
                                setEditName(s.name);
                                setEditColor(s.color);
                              }}
                              className="wikios-stash-sidebar-action"
                              title="Edit"
                            >
                              <Pencil size={11} />
                            </button>
                            {!s.isDefault &&
                              (confirmDelete === s.id ? (
                                <div className="wikios-stash-confirm-delete">
                                  <button
                                    onClick={() => deleteMutation.mutate({ id: s.id })}
                                    className="wikios-stash-confirm-yes"
                                    title="Confirm"
                                  >
                                    {deleteMutation.isPending ? (
                                      <Loader2 size={11} className="animate-spin" />
                                    ) : (
                                      <Check size={11} />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="wikios-stash-confirm-no"
                                    title="Cancel"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDelete(s.id)}
                                  className="wikios-stash-sidebar-action wikios-stash-sidebar-delete"
                                  title="Delete"
                                >
                                  <Trash2 size={11} />
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add new stash inline */}
                    <button
                      onClick={() => setShowCreate(true)}
                      className="wikios-stash-sidebar-add"
                    >
                      <Plus size={12} /> New stash
                    </button>
                  </div>

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
                            Pages (
                            {
                              items.filter(
                                (item) =>
                                  !item.pageTitle.startsWith("commons:") &&
                                  !item.pageTitle.startsWith("forum:thread:")
                              ).length
                            }
                            )
                          </button>
                          <button
                            onClick={() => setStashTab("images")}
                            className={cn(
                              "wikios-filter-btn",
                              stashTab === "images" && "wikios-filter-btn--active"
                            )}
                          >
                            Images (
                            {items.filter((item) => item.pageTitle.startsWith("commons:")).length})
                          </button>
                          <button
                            onClick={() => setStashTab("threads")}
                            className={cn(
                              "wikios-filter-btn",
                              stashTab === "threads" && "wikios-filter-btn--active"
                            )}
                          >
                            Threads (
                            {
                              items.filter((item) => item.pageTitle.startsWith("forum:thread:"))
                                .length
                            }
                            )
                          </button>
                        </div>
                      </div>
                    )}

                    {itemsQuery.isLoading && (
                      <div className="wikios-stashes-loading-sm">
                        <Loader2 size={16} className="animate-spin opacity-40" />
                      </div>
                    )}

                    {displayedItems.length === 0 && !itemsQuery.isLoading && activeStash && (
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

                    {displayedItems.length > 0 && (
                      <div
                        className={cn(
                          stashTab !== "images"
                            ? "wikios-stashes-items"
                            : "grid grid-cols-2 gap-3 sm:grid-cols-3"
                        )}
                      >
                        {displayedItems.map((item) => {
                          const isImage = item.pageTitle.startsWith("commons:");
                          const isThread = item.pageTitle.startsWith("forum:thread:");
                          const imgInfo = isImage ? resolvedImagesMap.get(item.pageTitle) : null;

                          if (isImage) {
                            const cleanTitle = item.pageTitle
                              .replace(/^commons:File:/, "")
                              .replace(/_/g, " ");
                            return (
                              <div
                                key={item.id}
                                className="wikios-commons-card group relative cursor-pointer overflow-hidden"
                                onClick={() => imgInfo && setSelectedImage(imgInfo)}
                              >
                                <TextureOverlay
                                  texture="paperGrain"
                                  opacity={0.05}
                                  className="mix-blend-overlay"
                                />
                                <TextureOverlay
                                  texture="dots"
                                  opacity={0.03}
                                  className="mix-blend-overlay"
                                />
                                <div className="wikios-commons-card-thumb">
                                  {imgInfo ? (
                                    <img
                                      src={imgInfo.thumbUrl}
                                      alt={cleanTitle}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-white/5">
                                      <Loader2 className="h-4 w-4 animate-spin opacity-40" />
                                    </div>
                                  )}
                                  <div className="wikios-commons-card-overlay">
                                    <ZoomIn className="h-5 w-5" />
                                  </div>
                                </div>
                                <div className="wikios-commons-card-info">
                                  <span
                                    className="wikios-commons-card-title truncate"
                                    title={cleanTitle}
                                  >
                                    {cleanTitle}
                                  </span>
                                  <span className="wikios-commons-card-meta">
                                    {imgInfo ? `${imgInfo.width}×${imgInfo.height}` : "..."}
                                  </span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    unstashMutation.mutate({
                                      pageTitle: item.pageTitle,
                                      stashId: activeStash?.id,
                                    });
                                  }}
                                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded border border-white/10 bg-black/60 text-white opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-500"
                                  title="Remove from stash"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            );
                          }

                          if (isThread) {
                            const cleanTitle =
                              item.note ?? item.pageTitle.replace("forum:thread:", "Thread #");
                            return (
                              <div key={item.id} className="wikios-stash-item-card">
                                <Link
                                  href={withBasePath(item.pageSlug)}
                                  className="wikios-stash-item-link"
                                >
                                  <div className="wikios-stash-item-info">
                                    <span className="wikios-stash-item-title flex items-center gap-1.5">
                                      <MessageSquare
                                        size={13}
                                        className="shrink-0 text-orange-500"
                                      />
                                      {cleanTitle}
                                    </span>
                                    <div className="wikios-stash-item-meta">
                                      <span>
                                        <Clock size={10} />{" "}
                                        {new Date(item.savedAt).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                  <ArrowRight size={14} className="wikios-stash-item-arrow" />
                                </Link>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    unstashMutation.mutate({
                                      pageTitle: item.pageTitle,
                                      stashId: activeStash?.id,
                                    });
                                  }}
                                  className="wikios-stash-item-remove"
                                  title="Remove from stash"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div key={item.id} className="wikios-stash-item-card">
                              <Link
                                href={withBasePath(`/wiki/${item.pageSlug}`)}
                                className="wikios-stash-item-link"
                              >
                                <div className="wikios-stash-item-info">
                                  <span className="wikios-stash-item-title">
                                    {item.pageTitle.replace(/_/g, " ")}
                                  </span>
                                  <div className="wikios-stash-item-meta">
                                    <span>
                                      <Clock size={10} />{" "}
                                      {new Date(item.savedAt).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}
                                    </span>
                                    {item.annotationCount > 0 && (
                                      <span className="wikios-stash-item-badge wikios-stash-item-badge-highlight">
                                        <Highlighter size={10} /> {item.annotationCount} highlight
                                        {item.annotationCount !== 1 ? "s" : ""}
                                      </span>
                                    )}
                                    {item.note && (
                                      <span className="wikios-stash-item-badge wikios-stash-item-badge-note">
                                        <StickyNote size={10} /> Has note
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <ArrowRight size={14} className="wikios-stash-item-arrow" />
                              </Link>
                              {item.note && (
                                <div
                                  className="wikios-stash-item-note"
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeUserContent(item.note),
                                  }}
                                />
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unstashMutation.mutate({
                                    pageTitle: item.pageTitle,
                                    stashId: activeStash?.id,
                                  });
                                }}
                                className="wikios-stash-item-remove"
                                title="Remove from stash"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          {selectedImage && (
            <StashedImageModal
              image={selectedImage}
              onClose={() => setSelectedImage(null)}
              onUnstash={() => {
                unstashMutation.mutate({
                  pageTitle: `commons:${selectedImage.title}`,
                  stashId: activeStash?.id,
                });
                setSelectedImage(null);
              }}
            />
          )}
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

function StashedImageModal({
  image,
  onClose,
  onUnstash,
}: {
  image: CommonsImage;
  onClose: () => void;
  onUnstash: () => void;
}) {
  const [format, setFormat] = useState<"thumb" | "embed" | "raw" | "url">("thumb");
  const [copied, setCopied] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const utils = api.useUtils();

  const cleanTitle = image.title.replace(/^File:/, "").replace(/_/g, " ");

  const handleCopyImage = async () => {
    setIsCopyingImage(true);
    try {
      let blob: Blob;
      try {
        const response = await fetch(image.url);
        if (!response.ok) throw new Error("CORS or direct fetch failed");
        blob = await response.blob();
      } catch (directErr) {
        console.warn("Direct fetch failed, falling back to server download:", directErr);
        const cleanName = image.title.replace(/^File:/, "");
        const res = await utils.wiki.downloadFile.fetch({ filename: cleanName });
        if (!res || !res.content) {
          throw new Error("Failed to download image from server");
        }
        const byteCharacters = atob(res.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: res.mime || "image/png" });
      }

      const imgEl = new window.Image();
      const objectUrl = URL.createObjectURL(blob);
      imgEl.src = objectUrl;

      await new Promise((resolve, reject) => {
        imgEl.onload = resolve;
        imgEl.onerror = () => reject(new Error("Failed to load image element"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = imgEl.naturalWidth || imgEl.width;
      canvas.height = imgEl.naturalHeight || imgEl.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        throw new Error("Could not get canvas context");
      }
      ctx.drawImage(imgEl, 0, 0);
      URL.revokeObjectURL(objectUrl);

      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });
      if (!pngBlob) throw new Error("Failed to convert image to PNG");

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": pngBlob,
        }),
      ]);

      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    } catch (err) {
      console.error("Failed to copy image:", err);
      alert("Failed to copy image to clipboard. Try downloading it instead.");
    } finally {
      setIsCopyingImage(false);
    }
  };

  const formatText = useMemo(() => {
    switch (format) {
      case "thumb":
        return `[[${image.title}|thumb|${cleanTitle}]]`;
      case "embed":
        return `[[${image.title}|250px]]`;
      case "raw":
        return `[[${image.title}]]`;
      case "url":
        return image.url;
    }
  }, [format, image, cleanTitle]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Lock body scroll while modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  return createPortal(
    <div
      className="animate-in fade-in fixed inset-0 z-[120002] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md duration-200"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 cursor-pointer rounded-full border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/80 p-2.5 text-[var(--wikios-text)] transition-all hover:bg-[var(--wikios-border)]"
        title="Close Lightbox"
        type="button"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="animate-in zoom-in-95 relative flex max-h-[95vh] w-full max-w-4xl flex-col gap-6 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-6 shadow-2xl backdrop-blur-xl duration-200 md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Image Container */}
        <div
          className="group relative flex min-h-[300px] flex-1 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-bg)]/40 md:min-h-0"
          onClick={() => setIsZoomed(true)}
          title="Click to view fullscreen"
        >
          <img
            src={image.url}
            alt={cleanTitle}
            className="max-h-[50vh] max-w-full rounded object-contain transition-transform duration-200 group-hover:scale-[1.01] md:max-h-[70vh]"
          />
          {/* Zoom icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/30">
            <div className="rounded-full bg-black/60 p-3 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
              <ZoomIn className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Right: Info and Actions */}
        <div className="flex w-full flex-col justify-between gap-4 md:w-80">
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-[var(--wikios-accent)] uppercase">
                Stashed Media
              </span>
              <h2 className="mt-0.5 text-lg leading-tight font-bold break-words text-[var(--wikios-text)]">
                {cleanTitle}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-y-1 border-y border-[var(--wikios-border)] py-3 text-xs text-[var(--wikios-text-dim)]">
              <div>Dimensions:</div>
              <div className="text-right text-[var(--wikios-text-muted)]">
                {image.width} × {image.height}
              </div>
              <div>Type:</div>
              <div className="text-right text-[var(--wikios-text-muted)]">
                {image.mime.split("/")[1]?.toUpperCase() ?? "Unknown"}
              </div>
              {image.license && (
                <>
                  <div>License:</div>
                  <div
                    className="truncate text-right text-[var(--wikios-text-muted)]"
                    title={image.license}
                  >
                    {image.license}
                  </div>
                </>
              )}
            </div>

            {/* Wikitext formats */}
            <div>
              <span className="mb-1.5 block text-[9px] font-bold tracking-wider text-[var(--wikios-text-dim)] uppercase">
                Wikitext Copy Format
              </span>
              <div className="wikios-filter-group grid grid-cols-4">
                {(["thumb", "embed", "raw", "url"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={cn(
                      "wikios-filter-btn",
                      format === fmt && "wikios-filter-btn--active"
                    )}
                  >
                    {fmt === "thumb"
                      ? "Thumb"
                      : fmt === "embed"
                        ? "Embed"
                        : fmt === "raw"
                          ? "File"
                          : "URL"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleCopy}
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--wikios-accent)] py-2 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : format === "url" ? "Copy URL" : "Copy Wikitext"}
              </button>
              <button
                onClick={handleCopyImage}
                disabled={isCopyingImage}
                className="col-span-1 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] py-2 text-sm font-semibold text-[var(--wikios-text)] transition-all hover:bg-[var(--wikios-border)] active:scale-[0.98] disabled:opacity-50"
                title="Copy Image to Clipboard"
              >
                {isCopyingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : copiedImage ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {copiedImage ? "Copied!" : "Image"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => window.open(image.url, "_blank")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] py-2 text-xs font-semibold text-[var(--wikios-text)] transition-all hover:bg-[var(--wikios-border)]"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <button
                onClick={onUnstash}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 py-2 text-xs font-semibold text-red-500 transition-all hover:bg-red-500/20 dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" /> Unstash
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Image Lightbox */}
      {isZoomed && (
        <div
          className="animate-in fade-in fixed inset-0 z-[120003] flex cursor-zoom-out items-center justify-center bg-black/95 backdrop-blur-md duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-4 right-4 cursor-pointer rounded-full border border-white/10 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20"
            title="Exit Fullscreen"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={image.url}
            alt={cleanTitle}
            className="animate-in zoom-in-95 max-h-[95vh] max-w-[95vw] rounded object-contain shadow-2xl duration-200"
          />
        </div>
      )}
    </div>,
    document.body
  );
}
