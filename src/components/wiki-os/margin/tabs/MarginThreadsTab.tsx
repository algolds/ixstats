"use client";
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
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Textarea } from "~/components/ui/textarea";

/** The Margin's highlighter accent on a filled `Button` (its identity colour, not the app tint). */
const MARGIN_FILLED = "bg-margin-accent text-(--margin-badge-text) hover:bg-margin-accent-hover";

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
}

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
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onResolveToggle(false)}
        className="bg-green/10 text-green hover:bg-green/20"
        title="Reopen discussion thread"
      >
        <Check className="size-3" />
        <span>Resolved (click to reopen)</span>
      </Button>
    );
  }

  return (
    <div className="relative inline-flex select-none">
      <Button
        variant="outline"
        size="sm"
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        disabled={isPending}
        className={cn(
          "overflow-hidden",
          holding
            ? "border-green/60 bg-green/20 text-green hover:bg-green/20 scale-95"
            : "text-label-secondary hover:text-label"
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
      </Button>
    </div>
  );
}

function ThreadCard({
  thread,
  isExpanded,
  onToggleExpand,
  isAuthenticated,
  onRefetch,
  currentUserAvatar,
  currentUsername,
  currentUserId,
}: {
  thread: ThreadItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isAuthenticated: boolean;
  onRefetch: () => void;
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
  const liveAvatarFor = (author: CommentAuthor) =>
    (currentUserId && author.id === currentUserId) ||
    (currentUsername && author.username.toLowerCase() === currentUsername.toLowerCase())
      ? currentUserAvatar
      : undefined;
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
        className="group hover:bg-fill-4 flex cursor-pointer items-start justify-between gap-2 p-3 transition-colors select-none"
      >
        <MarginUserAvatar
          author={thread.createdBy}
          size="sm"
          liveAvatar={liveAvatarFor(thread.createdBy)}
        />

        <div className="min-w-0 flex-1">
          {/* Top metadata: Lore Dimension, Author, Country, Anchor */}
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {dimensionInfo && (
              <span
                className="py-0.2 rounded-control-sm text-caption inline-flex items-center gap-1 px-2 font-semibold"
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
            <div className="rounded-control border-margin-accent bg-margin-bg text-footnote text-label-secondary mt-2 line-clamp-2 border-l-2 p-2 leading-snug italic">
              &ldquo;{thread.selectedText}&rdquo;
            </div>
          )}
        </div>

        {/* Status Pill & Expand Chevron */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "py-0.2 text-eyebrow rounded-full px-2 leading-none",
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
              return (
                <div
                  key={comment.id}
                  className="group rounded-row border-separator bg-surface-secondary text-footnote relative space-y-2 border p-3"
                >
                  <div className="text-footnote text-label-secondary flex items-center justify-between">
                    <div className="text-label flex items-center gap-2 font-semibold">
                      <MarginUserAvatar
                        author={comment.author}
                        size="xs"
                        liveAvatar={liveAvatarFor(comment.author)}
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
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            handleQuoteComment(comment.author.username, comment.content)
                          }
                          className="text-label-secondary opacity-0 group-hover:opacity-100 hover:text-(--margin-accent-text) focus-visible:opacity-100"
                          title="Quote in reply"
                          aria-label="Quote in reply"
                        >
                          <Quote className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-label pl-7 leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                  </p>

                  {/* Interactive Suggested Edit DiffViewer */}
                  {comment.suggestedEdit && (
                    <div className="space-y-2 pt-1 pl-7">
                      <div className="text-caption flex items-center justify-between font-semibold text-(--margin-accent-text)">
                        <span className="flex items-center gap-1">
                          <Edit3 className="h-3 w-3" />
                          <span>Suggested edit</span>
                        </span>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyReplacement(comment.id, comment.suggestedEdit!)}
                          className="border-margin-border bg-margin-bg hover:bg-margin-bg/80 text-(--margin-accent-text)"
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
                        </Button>
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
                className="rounded-control border-green/30 bg-green/10 text-caption text-green hover:bg-green/20 flex cursor-pointer items-center gap-1 border px-2 py-1 font-semibold"
                title="Create a new subpage from this discussion"
              >
                <Sprout className="h-3 w-3" />
                <span>Create subpage</span>
              </Link>
            </div>

            {isAuthenticated && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  if (confirm("Delete this discussion thread?")) {
                    deleteThreadMutation.mutate({ threadId: thread.id });
                  }
                }}
                className="text-label-secondary hover:text-red"
                title="Delete thread"
                aria-label="Delete thread"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>

          {/* Reply Composer with Suggest Edit support */}
          {isAuthenticated && (
            <form onSubmit={handleReplySubmit} className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  aria-pressed={showSuggestEdit}
                  onClick={() => setShowSuggestEdit((prev) => !prev)}
                  className={cn(
                    showSuggestEdit
                      ? "border-margin-border bg-margin-bg hover:bg-margin-bg text-(--margin-accent-text)"
                      : "text-label-secondary hover:text-label"
                  )}
                >
                  <Edit3 className="size-3 text-(--margin-accent-text)" />
                  <span>{showSuggestEdit ? "Suggested edit enabled" : "Suggest edit"}</span>
                </Button>
              </div>

              {/* Secondary textarea for suggested edit replacement */}
              {showSuggestEdit && (
                <div className="rounded-row border-margin-border bg-margin-bg space-y-2 border p-3">
                  <span className="text-caption font-semibold text-(--margin-accent-text)">
                    Proposed replacement:
                  </span>
                  <Textarea
                    rows={2}
                    value={suggestedReplacement}
                    onChange={(e) => setSuggestedReplacement(e.target.value)}
                    placeholder="Type replacement text..."
                    aria-label="Proposed replacement"
                    className="text-footnote min-h-0 tabular-nums"
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
                <Input
                  ref={replyInputRef}
                  type="text"
                  placeholder="Write a reply..."
                  aria-label="Write a reply"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={!replyText.trim() || postCommentMutation.isPending}
                  className={MARGIN_FILLED}
                >
                  Reply
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

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
}: MarginThreadsTabProps) {
  const { user: currentWikiUser } = useWikiAuth();
  const ixnayStatus = api.ixnayid.getStatus.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const currentUsername = ixnayStatus.data?.wiki.username || currentWikiUser?.username;
  const currentUserAvatar = currentWikiUser?.imageUrl;
  const currentUserId = currentWikiUser?.id;
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
    <div className="space-y-4">
      {/* Top Filter Bar: Search, Status, New Button */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Status Segmented Pill */}
          <SegmentedControl
            size="sm"
            aria-label="Thread status"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "OPEN", label: "Open" },
              { value: "ALL", label: "All" },
            ]}
          />

          {isAuthenticated && (
            <Button
              size="sm"
              aria-expanded={showNewThread}
              onClick={() => setShowNewThread((prev) => !prev)}
              className={cn("shrink-0", MARGIN_FILLED)}
            >
              <Plus className="size-3.5" />
              <span>New thread</span>
            </Button>
          )}
        </div>

        {/* Instant Search Bar */}
        <SearchField
          placeholder="Search discussions..."
          aria-label="Search discussions"
          value={searchQuery}
          onValueChange={setSearchQuery}
          size="sm"
        />
      </div>

      {/* New Thread Composer */}
      {showNewThread && (
        <form
          onSubmit={handleCreateSubmit}
          className="animate-in fade-in zoom-in-95 rounded-card border-separator bg-surface shadow-floating space-y-3 border p-4"
        >
          {/* Composer Header */}
          <div className="border-separator text-caption text-label flex items-center gap-2 border-b pb-2 font-semibold">
            <MarginUserAvatar
              author={{
                id: currentUserId || "you",
                username: currentUsername || "You",
                avatar: currentUserAvatar || null,
                role: null,
                country: null,
              }}
              size="xs"
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
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setShowCategoryHelp(true);
                }}
                className="text-label h-auto px-0"
              >
                <HelpCircle className="text-yellow size-3" />
                <span>Category guide</span>
              </Button>
            </div>
            <RadioCardGroup
              aria-label="Category"
              value={selectedDimension}
              onValueChange={setSelectedDimension}
              className="grid grid-cols-5 gap-1"
            >
              {LORE_DIMENSIONS.map((dim) => (
                // The wrapper carries the native hover hint (RadioCard's `title` is its heading).
                <span key={dim.id} title={dim.desc} className="flex">
                  <RadioCard
                    value={dim.id}
                    indicator={false}
                    aria-label={dim.label}
                    className="flex-col items-center gap-0 px-1 py-2 text-center"
                  >
                    <span className="text-footnote" aria-hidden>
                      {dim.emoji}
                    </span>
                    <span className="text-caption mt-0.5 font-semibold">{dim.short}</span>
                  </RadioCard>
                </span>
              ))}
            </RadioCardGroup>
          </div>

          {draftQuote && (
            <div className="bg-margin-accent/15 rounded-row border-yellow/40 text-footnote text-label-secondary space-y-1 border p-3">
              <span className="text-subhead text-label">Referenced passage:</span>
              <p className="text-footnote text-label line-clamp-2 italic">
                &ldquo;{draftQuote}&rdquo;
              </p>
            </div>
          )}

          <Input
            type="text"
            placeholder="Thread title..."
            aria-label="Thread title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />

          <Textarea
            placeholder="Add context, questions, or evidence..."
            aria-label="Thread content"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            className="min-h-0"
          />

          {/* Toggle Propose Suggested Edit Diff */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              aria-pressed={showNewSuggestEdit}
              onClick={() => setShowNewSuggestEdit((prev) => !prev)}
              className={cn(
                showNewSuggestEdit
                  ? "bg-margin-accent/20 hover:bg-margin-accent/20 border-yellow/50 text-label"
                  : "text-label-secondary hover:text-label"
              )}
            >
              <Edit3 className="text-yellow size-3" />
              <span>{showNewSuggestEdit ? "Include text diff" : "Suggest edit"}</span>
            </Button>

            {showNewSuggestEdit && (
              <div className="bg-margin-accent/10 rounded-row border-yellow/40 space-y-2 border p-3">
                <Textarea
                  rows={2}
                  value={newSuggestedEdit}
                  onChange={(e) => setNewSuggestedEdit(e.target.value)}
                  placeholder="Type replacement text..."
                  aria-label="Proposed replacement"
                  className="text-footnote min-h-0 tabular-nums"
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowNewThread(false);
                onClearDraftQuote?.();
              }}
              className="text-label-secondary"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!newTitle.trim() || !newContent.trim() || createThreadMutation.isPending}
              className={MARGIN_FILLED}
            >
              {createThreadMutation.isPending ? "Posting..." : "Post thread"}
            </Button>
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
        <div className="text-label-secondary space-y-2 py-12 text-center">
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
      />
    </div>
  );
}
