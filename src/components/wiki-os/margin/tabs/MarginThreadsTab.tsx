"use client";
// src/components/wiki-os/margin/tabs/MarginThreadsTab.tsx
// Structured discussion threads aligned with Lore Theory: 5 Ws classification,
// DiffViewer suggested edits, diplomatic communiqués, quote-in-reply, and child page creation.
// Signature Highlighter Yellow / Warm Amber branding for Margin.

import React, { useState, useRef, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  ChatBubble as MessageSquare,
  Plus,
  Check,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  Trash as Trash2,
  DesignPencil as Edit3,
  Quote,
  Search,
  Crown,
  Copy,
  Leaf as Sprout,
  HelpCircle,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundCues } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { DiffViewer } from "~/components/diff-viewer";
import { MarginUserAvatar, type CommentAuthor } from "../shared/MarginUserAvatar";
import { MarginCategoryHelpModal } from "../modals/MarginCategoryHelpModal";

export const LORE_DIMENSIONS = [
  {
    id: "WHY",
    label: "Why (National purpose)",
    short: "WHY",
    emoji: "🌟",
    color: "#fef036",
    desc: "Core concept, worldview, and national philosophy",
  },
  {
    id: "WHEN",
    label: "When (History and era)",
    short: "WHEN",
    emoji: "⏳",
    color: "#38bdf8",
    desc: "Historical events, founding dates, and turning points",
  },
  {
    id: "WHERE",
    label: "Where (Geography)",
    short: "WHERE",
    emoji: "🗺️",
    color: "#4ade80",
    desc: "Terrain, borders, provinces, and regions",
  },
  {
    id: "WHO",
    label: "Who (Key figure)",
    short: "WHO",
    emoji: "👤",
    color: "#c084fc",
    desc: "Leaders, monarchs, and notable people",
  },
  {
    id: "WHAT",
    label: "What (Custom or office)",
    short: "WHAT",
    emoji: "📦",
    color: "#fb923c",
    desc: "Traditions, artifacts, and government offices",
  },
];

export const THREAD_CATEGORIES = LORE_DIMENSIONS.map((d) => ({
  id: d.id,
  label: d.short,
  emoji: d.emoji,
  color: d.color,
}));

interface ThreadItem {
  id: string;
  articleTitle: string;
  status: "OPEN" | "RESOLVED" | "ARCHIVED";
  title: string;
  sectionAnchor: string | null;
  selectedText: string | null;
  anchorOffset: number | null;
  resolvedAt: Date | null;
  resolvedBy: { id: string; username: string } | null;
  createdBy: CommentAuthor;
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
  comments: Array<{
    id: string;
    threadId: string;
    content: string;
    suggestedEdit: string | null;
    reactions: Record<string, number>;
    createdAt: Date;
    author: CommentAuthor;
  }>;
}

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface MarginThreadsTabProps {
  articleTitle: string;
  threads: ThreadItem[];
  isLoading: boolean;
  activeAnchor: string | null;
  draftQuote?: string | null;
  onClearDraftQuote?: () => void;
  selectedThreadId: string | null;
  onSelectThread: (threadId: string | null) => void;
  isAuthenticated: boolean;
  onRefetch: () => void;
  themeColors?: ThemeColors | null;
}

// ---------------------------------------------------------------------------
// Subcomponent: HoldToResolveButton
// ---------------------------------------------------------------------------
function HoldToResolveButton({
  isResolved,
  onResolveToggle,
  isPending,
}: {
  isResolved: boolean;
  onResolveToggle: (resolved: boolean) => void;
  isPending: boolean;
}) {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startHold = () => {
    if (isPending) return;
    setHolding(true);
    timerRef.current = setTimeout(() => {
      soundCues?.success?.();
      onResolveToggle(!isResolved);
      setHolding(false);
    }, 900);
  };

  const cancelHold = () => {
    setHolding(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  if (isResolved) {
    return (
      <button
        type="button"
        onClick={() => onResolveToggle(false)}
        className="rounded-control border-green/30 bg-green/10 text-caption text-green hover:bg-green/20 flex cursor-pointer items-center gap-1 border px-2.5 py-1 font-semibold transition-[background-color,border-color,transform] duration-100 active:scale-[0.98]"
        title="Reopen discussion thread"
      >
        <Check className="h-3 w-3" />
        <span>Resolved (click to reopen)</span>
      </button>
    );
  }

  return (
    <div className="relative inline-flex select-none">
      <button
        type="button"
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        disabled={isPending}
        className={cn(
          "rounded-control text-caption relative cursor-pointer overflow-hidden border px-2.5 py-1 font-semibold transition-[background-color,border-color,transform] duration-100",
          holding
            ? "border-green/60 bg-green/20 text-green scale-95"
            : "border-separator bg-surface text-label-secondary hover:border-separator hover:text-label"
        )}
      >
        {holding && (
          <div
            className="bg-green/30 absolute inset-0 origin-left transition-[width] duration-900 ease-linear"
            style={{ width: "100%" }}
          />
        )}
        <span className="relative z-10 flex items-center gap-1">
          <Check className="text-green h-3 w-3" />
          <span>{holding ? "Keep holding..." : "Hold to resolve"}</span>
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: ThreadCard
// ---------------------------------------------------------------------------
function ThreadCard({
  thread,
  isExpanded,
  onToggleExpand,
  isAuthenticated,
  onRefetch,
  themeColors,
  currentUserAvatar,
  currentUsername,
  currentUserId,
}: {
  thread: ThreadItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isAuthenticated: boolean;
  onRefetch: () => void;
  themeColors?: ThemeColors | null;
  currentUserAvatar?: string | null;
  currentUsername?: string | null;
  currentUserId?: string | null;
}) {
  const [replyText, setReplyText] = useState("");
  const [showSuggestEdit, setShowSuggestEdit] = useState(false);
  const [suggestedReplacement, setSuggestedReplacement] = useState(thread.selectedText || "");
  const [copiedReplacementId, setCopiedReplacementId] = useState<string | null>(null);

  const replyInputRef = useRef<HTMLInputElement>(null);
  const notify = useNotify();
  const primaryColor = themeColors?.primary || "#fef036";

  const isCreatorMatch =
    (currentUserId && thread.createdBy.id === currentUserId) ||
    (currentUsername && thread.createdBy.username.toLowerCase() === currentUsername.toLowerCase());

  const creatorLiveAvatar = isCreatorMatch ? currentUserAvatar : undefined;
  const isResolved = thread.status === "RESOLVED";

  // Parse Lore Dimension tag if present in title (e.g. "[WHY] Topic")
  const dimensionMatch = thread.title.match(/^\[(WHY|WHEN|WHERE|WHO|WHAT)\]\s*(.*)$/i);
  const dimensionKey = dimensionMatch ? dimensionMatch[1]?.toUpperCase() : null;
  const displayTitle = dimensionMatch ? dimensionMatch[2] : thread.title;
  const dimensionInfo = LORE_DIMENSIONS.find((d) => d.id === dimensionKey);

  const resolveMutation = api.wikios.resolveThread.useMutation({
    onSuccess: () => {
      soundCues?.success?.();
      notify.success(thread.status === "OPEN" ? "Thread resolved" : "Thread reopened");
      onRefetch();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to update status");
    },
  });

  const postCommentMutation = api.wikios.postComment.useMutation({
    onSuccess: () => {
      setReplyText("");
      setShowSuggestEdit(false);
      notify.success("Reply posted");
      onRefetch();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to post comment");
    },
  });

  const deleteThreadMutation = api.wikios.deleteThread.useMutation({
    onSuccess: () => {
      notify.success("Thread deleted");
      onRefetch();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to delete thread");
    },
  });

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || postCommentMutation.isPending) return;
    postCommentMutation.mutate({
      threadId: thread.id,
      content: replyText.trim(),
      suggestedEdit:
        showSuggestEdit && suggestedReplacement.trim() ? suggestedReplacement.trim() : undefined,
    });
  };

  const handleQuoteComment = (authorName: string, snippet: string) => {
    const quoteFormat = `> @${authorName}: "${snippet.slice(0, 80)}${snippet.length > 80 ? "..." : ""}"\n`;
    setReplyText((prev) => (prev ? `${prev}\n${quoteFormat}` : quoteFormat));
    replyInputRef.current?.focus();
  };

  const handleCopyReplacement = async (commentId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReplacementId(commentId);
      notify.success("Replacement copied to clipboard");
      setTimeout(() => setCopiedReplacementId(null), 1500);
    } catch {
      notify.error("Failed to copy replacement");
    }
  };

  const sproutChildSlug = encodeURIComponent(
    (thread.selectedText || thread.title)
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .slice(0, 40)
      .trim()
      .replace(/ /g, "_")
  );

  return (
    <div
      className={cn(
        "rounded-card overflow-hidden border transition-[border-color,background-color,box-shadow,opacity] duration-150",
        isResolved
          ? "border-green/20 bg-green/10 opacity-75 hover:opacity-100"
          : "border-separator bg-surface hover:border-margin-border"
      )}
    >
      {/* Header Bar */}
      <div
        onClick={onToggleExpand}
        className="group hover:bg-fill-4 flex cursor-pointer items-start justify-between gap-2.5 p-2.5 transition-colors select-none"
      >
        <MarginUserAvatar
          author={thread.createdBy}
          size="sm"
          primaryColor={primaryColor}
          liveAvatar={creatorLiveAvatar}
        />

        <div className="min-w-0 flex-1">
          {/* Top metadata: Lore Dimension, Author, Country, Anchor */}
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {dimensionInfo && (
              <span
                className="py-0.2 rounded-control-sm text-caption inline-flex items-center gap-1 px-1.5 font-semibold"
                style={{
                  backgroundColor: `color-mix(in srgb, ${dimensionInfo.color === "#fef036" ? "var(--margin-accent)" : dimensionInfo.color} 18%, transparent)`,
                  color:
                    dimensionInfo.color === "#fef036"
                      ? "var(--margin-accent-text)"
                      : dimensionInfo.color,
                  border: `1px solid color-mix(in srgb, ${dimensionInfo.color === "#fef036" ? "var(--margin-accent)" : dimensionInfo.color} 35%, transparent)`,
                }}
              >
                <span>{dimensionInfo.emoji}</span>
                <span>{dimensionInfo.short}</span>
              </span>
            )}

            <span className="text-caption text-label truncate font-semibold transition-colors group-hover:text-(--margin-accent-text)">
              {thread.createdBy.username}
            </span>

            {thread.createdBy.country && (
              <span className="py-0.2 rounded-control-sm border-margin-border bg-margin-bg text-caption inline-flex items-center gap-1 border px-1 font-semibold text-(--margin-accent-text)">
                <Crown className="h-2.5 w-2.5" />
                <span className="max-w-[75px] truncate">{thread.createdBy.country.name}</span>
              </span>
            )}

            {thread.sectionAnchor && (
              <span className="py-0.2 rounded-control-sm border-separator bg-surface-secondary text-caption text-label-secondary max-w-28 truncate border px-1 font-semibold">
                #{thread.sectionAnchor}
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-caption text-label line-clamp-2 leading-snug font-semibold transition-colors">
            {displayTitle}
          </h4>

          {/* Selected text quote if anchored */}
          {thread.selectedText && (
            <div className="rounded-control border-margin-accent bg-margin-bg text-footnote text-label-secondary mt-1.5 line-clamp-2 border-l-2 p-2 leading-snug italic">
              &ldquo;{thread.selectedText}&rdquo;
            </div>
          )}
        </div>

        {/* Status Pill & Expand Chevron */}
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "py-0.2 text-eyebrow rounded-full px-1.5 leading-none",
              isResolved
                ? "border-green/30 bg-green/10 text-green border"
                : "border-separator bg-surface-secondary text-label-secondary border"
            )}
          >
            {isResolved ? "Done" : `${thread.comments.length}`}
          </span>
          {isExpanded ? (
            <ChevronDown className="text-label-secondary h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="text-label-secondary h-3.5 w-3.5" />
          )}
        </div>
      </div>

      {/* Expanded Details & Discussion Timeline */}
      {isExpanded && (
        <div className="animate-in fade-in-50 border-separator space-y-3 border-t px-3 pt-1 pb-3 duration-150">
          {/* Discussion Comments List */}
          <div className="border-separator space-y-2 border-t pt-1">
            {thread.comments.map((comment) => {
              const isCommentAuthorMatch =
                (currentUserId && comment.author.id === currentUserId) ||
                (currentUsername &&
                  comment.author.username.toLowerCase() === currentUsername.toLowerCase());
              const commentLiveAvatar = isCommentAuthorMatch ? currentUserAvatar : undefined;

              return (
                <div
                  key={comment.id}
                  className="group rounded-row border-separator bg-surface-secondary text-footnote relative space-y-1.5 border p-2.5"
                >
                  <div className="text-footnote text-label-secondary flex items-center justify-between">
                    <div className="text-label flex items-center gap-1.5 font-semibold">
                      <MarginUserAvatar
                        author={comment.author}
                        size="xs"
                        primaryColor={primaryColor}
                        liveAvatar={commentLiveAvatar}
                      />
                      <span className="text-footnote">{comment.author.username}</span>
                      {comment.author.country?.name && (
                        <span className="text-caption text-(--margin-accent-text)">
                          ({comment.author.country.name})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                      {isAuthenticated && (
                        <button
                          type="button"
                          onClick={() =>
                            handleQuoteComment(comment.author.username, comment.content)
                          }
                          className="rounded-control-sm text-label-secondary cursor-pointer p-0.5 opacity-0 transition-[opacity,color] duration-100 group-hover:opacity-100 hover:text-(--margin-accent-text)"
                          title="Quote in reply"
                        >
                          <Quote className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-label pl-6.5 leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                  </p>

                  {/* Interactive Suggested Edit DiffViewer */}
                  {comment.suggestedEdit && (
                    <div className="space-y-1.5 pt-1 pl-6.5">
                      <div className="text-caption flex items-center justify-between font-semibold text-(--margin-accent-text)">
                        <span className="flex items-center gap-1">
                          <Edit3 className="h-3 w-3" />
                          <span>Suggested edit</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => handleCopyReplacement(comment.id, comment.suggestedEdit!)}
                          className="rounded-control-sm border-margin-border bg-margin-bg text-footnote hover:bg-margin-bg/80 flex cursor-pointer items-center gap-1 border px-1.5 py-0.5 text-(--margin-accent-text) transition-transform duration-100 active:scale-[0.98]"
                        >
                          {copiedReplacementId === comment.id ? (
                            <>
                              <Check className="text-green h-2.5 w-2.5" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-2.5 w-2.5" />
                              <span>Copy replacement</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="rounded-row border-separator overflow-hidden border">
                        <DiffViewer
                          oldCode={thread.selectedText || ""}
                          newCode={comment.suggestedEdit}
                          layout="unified"
                          oldTitle="Current text"
                          newTitle="Proposed replacement"
                          className="text-footnote"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Bar: Hold-to-Resolve, Create Child Page & Delete */}
          <div className="border-separator flex items-center justify-between border-t pt-1">
            <div className="flex items-center gap-2">
              {isAuthenticated && (
                <HoldToResolveButton
                  isResolved={isResolved}
                  onResolveToggle={(resolved) =>
                    resolveMutation.mutate({ threadId: thread.id, resolved })
                  }
                  isPending={resolveMutation.isPending}
                />
              )}

              {/* Create Subpage Button */}
              <Link
                href={`/wiki/edit/${sproutChildSlug}?parent=${encodeURIComponent(thread.articleTitle)}`}
                className="rounded-control border-green/30 bg-green/10 text-caption text-green hover:bg-green/20 flex cursor-pointer items-center gap-1 border px-2 py-1 font-semibold transition-transform duration-100 active:scale-[0.98]"
                title="Create a new subpage from this discussion"
              >
                <Sprout className="h-3 w-3" />
                <span>Create subpage</span>
              </Link>
            </div>

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete this discussion thread?")) {
                    deleteThreadMutation.mutate({ threadId: thread.id });
                  }
                }}
                className="text-label-secondary hover:text-red cursor-pointer p-1 transition-colors"
                title="Delete thread"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Reply Composer with Suggest Edit support */}
          {isAuthenticated && (
            <form onSubmit={handleReplySubmit} className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowSuggestEdit((prev) => !prev)}
                  className={cn(
                    "rounded-control text-caption flex cursor-pointer items-center gap-1 border px-2 py-0.5 font-semibold transition-[background-color,border-color,color] duration-100 active:scale-[0.98]",
                    showSuggestEdit
                      ? "border-margin-border bg-margin-bg text-(--margin-accent-text)"
                      : "border-separator bg-surface text-label-secondary hover:text-label"
                  )}
                >
                  <Edit3 className="h-3 w-3 text-(--margin-accent-text)" />
                  <span>{showSuggestEdit ? "Suggested edit enabled" : "Suggest edit"}</span>
                </button>
              </div>

              {/* Secondary textarea for suggested edit replacement */}
              {showSuggestEdit && (
                <div className="rounded-row border-margin-border bg-margin-bg space-y-2 border p-2.5">
                  <span className="text-caption font-semibold text-(--margin-accent-text)">
                    Proposed replacement:
                  </span>
                  <textarea
                    rows={2}
                    value={suggestedReplacement}
                    onChange={(e) => setSuggestedReplacement(e.target.value)}
                    placeholder="Type replacement text..."
                    className="rounded-control border-separator bg-surface text-footnote text-label focus:border-margin-accent w-full border px-2.5 py-1.5 tabular-nums outline-none"
                  />
                  {thread.selectedText && suggestedReplacement && (
                    <div className="pt-1">
                      <DiffViewer
                        oldCode={thread.selectedText}
                        newCode={suggestedReplacement}
                        layout="unified"
                        oldTitle="Current"
                        newTitle="Proposed"
                        className="text-footnote"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={replyInputRef}
                  type="text"
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="rounded-row border-separator bg-surface text-footnote text-label placeholder:text-label-tertiary focus:border-margin-accent flex-1 border px-3 py-1.5 transition-colors outline-none"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || postCommentMutation.isPending}
                  className="bg-margin-accent hover:bg-margin-accent/90 rounded-row text-caption cursor-pointer px-3.5 py-1.5 font-semibold text-(--margin-badge-text) transition-transform duration-100 active:scale-[0.98] disabled:opacity-40"
                >
                  Reply
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Tab Component
// ---------------------------------------------------------------------------
export function MarginThreadsTab({
  articleTitle,
  threads,
  isLoading,
  activeAnchor,
  draftQuote,
  onClearDraftQuote,
  selectedThreadId,
  onSelectThread,
  isAuthenticated,
  onRefetch,
  themeColors,
}: MarginThreadsTabProps) {
  const { user: currentWikiUser } = useWikiAuth();
  const ixnayStatus = api.ixnayid.getStatus.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const currentUsername = ixnayStatus.data?.wiki.username || currentWikiUser?.username;
  const currentUserAvatar = currentWikiUser?.imageUrl;
  const currentUserId = currentWikiUser?.id;
  const primaryColor = themeColors?.primary || "#fef036";

  const [filter, setFilter] = useState<"OPEN" | "ALL">("OPEN");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDimension, setSelectedDimension] = useState<string>("WHY");
  const [showCategoryHelp, setShowCategoryHelp] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newSuggestedEdit, setNewSuggestedEdit] = useState("");
  const [showNewSuggestEdit, setShowNewSuggestEdit] = useState(false);
  const notify = useNotify();

  useEffect(() => {
    if (draftQuote) {
      // oxlint-disable-next-line
      setShowNewThread(true);
      // oxlint-disable-next-line
      if (!newTitle) {
        setNewTitle(
          `Regarding: "${draftQuote.slice(0, 35)}${draftQuote.length > 35 ? "..." : ""}"`
        );
      }
      setNewSuggestedEdit(draftQuote);
    }
  }, [draftQuote]);

  const createThreadMutation = api.wikios.createThread.useMutation({
    onSuccess: () => {
      soundCues?.success?.();
      notify.success("Discussion created");
      setShowNewThread(false);
      setNewTitle("");
      setNewContent("");
      setNewSuggestedEdit("");
      setShowNewSuggestEdit(false);
      onClearDraftQuote?.();
      onRefetch();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to create thread");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const fullTitle = `[${selectedDimension}] ${newTitle.trim()}`;
    const fullContent = newContent.trim();

    createThreadMutation.mutate({
      articleTitle,
      title: fullTitle,
      content: fullContent,
      sectionAnchor: activeAnchor || undefined,
      selectedText: draftQuote || undefined,
      suggestedEdit:
        showNewSuggestEdit && newSuggestedEdit.trim() ? newSuggestedEdit.trim() : undefined,
    });
  };

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (filter === "OPEN" && t.status !== "OPEN") return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(query);
        const matchesAuthor = t.createdBy.username.toLowerCase().includes(query);
        const matchesContent = t.comments.some((c) => c.content.toLowerCase().includes(query));
        if (!matchesTitle && !matchesAuthor && !matchesContent) return false;
      }
      return true;
    });
  }, [threads, filter, searchQuery]);

  return (
    <div className="space-y-3.5">
      {/* Top Filter Bar: Search, Status, New Button */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Status Segmented Pill */}
          <div className="rounded-row border-separator bg-fill-4 flex items-center border p-0.5">
            {(
              [
                { id: "OPEN", label: "Open" },
                { id: "ALL", label: "All" },
              ] as const
            ).map((f) => {
              const isActive = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-control text-caption cursor-pointer px-2.5 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 select-none active:scale-[0.98]",
                    isActive
                      ? "border-yellow/50 bg-surface text-label border font-semibold"
                      : "text-label-secondary hover:text-label"
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setShowNewThread((prev) => !prev)}
              className="bg-margin-accent hover:bg-margin-accent/90 rounded-row border-yellow/50 text-caption flex shrink-0 cursor-pointer items-center gap-1.5 border px-3 py-1 font-semibold text-(--margin-badge-text) transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 select-none active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Thread</span>
            </button>
          )}
        </div>

        {/* Instant Search Bar */}
        <div className="relative">
          <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search discussions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-row border-separator bg-fill-4 text-footnote text-label placeholder:text-label-tertiary focus:border-yellow/60 focus:bg-surface w-full border py-1.5 pr-3 pl-8 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 outline-none"
          />
        </div>
      </div>

      {/* New Thread Composer */}
      {showNewThread && (
        <form
          onSubmit={handleCreateSubmit}
          className="animate-in fade-in zoom-in-95 rounded-card border-separator bg-surface shadow-floating space-y-3 border p-3.5"
        >
          {/* Composer Header */}
          <div className="border-separator text-caption text-label flex items-center gap-1.5 border-b pb-1.5 font-semibold">
            <MarginUserAvatar
              author={{
                id: currentUserId || "you",
                username: currentUsername || "You",
                avatar: currentUserAvatar || null,
                role: null,
                country: null,
              }}
              size="xs"
              primaryColor={primaryColor}
              liveAvatar={currentUserAvatar}
            />
            <span className="text-footnote text-label-secondary">
              Posting as{" "}
              <strong className="text-label font-semibold">{currentUsername || "You"}</strong>
            </span>
          </div>

          {/* 5 Ws Priority Hierarchy Chips */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-eyebrow text-label-secondary">Category</span>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryHelp(true);
                }}
                className="text-caption text-label flex cursor-pointer items-center gap-1 font-semibold transition-colors hover:underline"
              >
                <HelpCircle className="text-yellow h-3 w-3" />
                <span>Category Guide</span>
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {LORE_DIMENSIONS.map((dim) => {
                const isSelected = selectedDimension === dim.id;
                return (
                  <button
                    key={dim.id}
                    type="button"
                    onClick={() => setSelectedDimension(dim.id)}
                    className={cn(
                      "rounded-row flex cursor-pointer flex-col items-center border px-1 py-1.5 text-center transition-[background-color,border-color,color,box-shadow] duration-100 select-none active:scale-[0.98]",
                      isSelected
                        ? "bg-margin-accent/20 border-yellow/60 text-label ring-yellow/40 font-semibold ring-1"
                        : "border-separator bg-surface text-label-secondary hover:text-label"
                    )}
                    title={dim.desc}
                  >
                    <span className="text-footnote">{dim.emoji}</span>
                    <span className="text-caption mt-0.5 font-semibold">{dim.short}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {draftQuote && (
            <div className="bg-margin-accent/15 rounded-row border-yellow/40 text-footnote text-label-secondary space-y-1 border p-2.5">
              <span className="text-subhead text-label">Referenced passage:</span>
              <p className="text-footnote text-label line-clamp-2 italic">
                &ldquo;{draftQuote}&rdquo;
              </p>
            </div>
          )}

          <input
            type="text"
            placeholder="Thread title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="rounded-row border-separator bg-background text-footnote text-label placeholder:text-label-tertiary focus:border-yellow/60 w-full border px-3 py-1.5 transition-colors outline-none"
          />

          <textarea
            placeholder="Add context, questions, or evidence..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            className="resize-vertical rounded-row border-separator bg-background text-footnote text-label placeholder:text-label-tertiary focus:border-yellow/60 w-full border px-3 py-1.5 transition-colors outline-none"
          />

          {/* Toggle Propose Suggested Edit Diff */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowNewSuggestEdit((prev) => !prev)}
              className={cn(
                "rounded-control text-caption flex cursor-pointer items-center gap-1.5 border px-2 py-1 font-semibold transition-[background-color,border-color,color] duration-100 active:scale-[0.98]",
                showNewSuggestEdit
                  ? "bg-margin-accent/20 border-yellow/50 text-label font-semibold"
                  : "border-separator text-label-secondary hover:text-label"
              )}
            >
              <Edit3 className="text-yellow h-3 w-3" />
              <span>{showNewSuggestEdit ? "Include text diff" : "Suggest edit"}</span>
            </button>

            {showNewSuggestEdit && (
              <div className="bg-margin-accent/10 rounded-row border-yellow/40 space-y-2 border p-2.5">
                <textarea
                  rows={2}
                  value={newSuggestedEdit}
                  onChange={(e) => setNewSuggestedEdit(e.target.value)}
                  placeholder="Type replacement text..."
                  className="rounded-control border-separator bg-surface text-footnote text-label focus:border-yellow/60 w-full border px-2.5 py-1.5 tabular-nums outline-none"
                />
                {draftQuote && newSuggestedEdit && (
                  <DiffViewer
                    oldCode={draftQuote}
                    newCode={newSuggestedEdit}
                    layout="unified"
                    oldTitle="Original"
                    newTitle="Proposed"
                    className="text-footnote"
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowNewThread(false);
                onClearDraftQuote?.();
              }}
              className="rounded-row text-caption text-label-secondary hover:text-label px-3 py-1 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim() || !newContent.trim() || createThreadMutation.isPending}
              className="bg-margin-accent hover:bg-margin-accent/90 rounded-row text-caption cursor-pointer px-3.5 py-1.5 font-semibold text-(--margin-badge-text) active:scale-[0.98] disabled:opacity-40"
            >
              {createThreadMutation.isPending ? "Posting..." : "Post thread"}
            </button>
          </div>
        </form>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-label-secondary flex flex-col items-center justify-center gap-2 py-12">
          <div className="border-yellow/50 h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-footnote">Loading discussions...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredThreads.length === 0 && (
        <div className="text-label-secondary space-y-1.5 py-12 text-center">
          <MessageSquare className="text-label-secondary mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-caption text-label font-semibold">No discussions yet</p>
          <p className="text-footnote text-label-secondary mx-auto max-w-xs">
            {searchQuery
              ? "Try a different search term"
              : "Select text in the article to start a discussion."}
          </p>
        </div>
      )}

      {/* Thread List */}
      {!isLoading && filteredThreads.length > 0 && (
        <div className="space-y-2">
          {filteredThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              isExpanded={selectedThreadId === thread.id}
              onToggleExpand={() =>
                onSelectThread(selectedThreadId === thread.id ? null : thread.id)
              }
              isAuthenticated={isAuthenticated}
              onRefetch={onRefetch}
              themeColors={themeColors}
              currentUserAvatar={currentUserAvatar}
              currentUsername={currentUsername}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {/* Category Guide Help Modal */}
      <MarginCategoryHelpModal
        isOpen={showCategoryHelp}
        onClose={() => setShowCategoryHelp(false)}
        themeColors={themeColors}
      />
    </div>
  );
}
