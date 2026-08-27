// src/components/wiki-os/margin/tabs/MarginThreadsTab.tsx
// Structured discussion threads aligned with Lore Theory: 5 Ws classification,
// DiffViewer suggested edits, diplomatic communiqués, quote-in-reply, and child page creation.
// Signature Highlighter Yellow / Warm Amber branding for Margin.

"use client";

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
import { soundEffects } from "~/lib/sound/cuelume";
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
      soundEffects.success();
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
        className="flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 transition-[background-color,border-color,transform] duration-100 hover:bg-emerald-500/20 active:scale-95"
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
          "relative cursor-pointer overflow-hidden rounded-lg border px-2.5 py-1 text-[11px] font-semibold shadow-xs transition-[background-color,border-color,transform] duration-100",
          holding
            ? "scale-95 border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
            : "border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] text-[var(--wikios-text-muted)] hover:border-[var(--wikios-border)] hover:text-[var(--wikios-text)]"
        )}
      >
        {holding && (
          <div
            className="absolute inset-0 origin-left bg-emerald-500/30 transition-[width] duration-900 ease-linear"
            style={{ width: "100%" }}
          />
        )}
        <span className="relative z-10 flex items-center gap-1">
          <Check className="h-3 w-3 text-emerald-400" />
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
      soundEffects.success();
      notify.success(thread.status === "OPEN" ? "Thread resolved" : "Thread reopened");
      onRefetch();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to update status");
    },
  });

  const postCommentMutation = api.wikios.postComment.useMutation({
    onSuccess: () => {
      soundEffects.press();
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
      soundEffects.release();
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
    soundEffects.press();
    const quoteFormat = `> @${authorName}: "${snippet.slice(0, 80)}${snippet.length > 80 ? "..." : ""}"\n`;
    setReplyText((prev) => (prev ? `${prev}\n${quoteFormat}` : quoteFormat));
    replyInputRef.current?.focus();
  };

  const handleCopyReplacement = async (commentId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      soundEffects.press();
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
        "overflow-hidden rounded-2xl border shadow-xs backdrop-blur-md transition-[border-color,background-color,box-shadow,opacity] duration-150",
        isResolved
          ? "border-emerald-500/20 bg-emerald-950/10 opacity-75 hover:opacity-100"
          : "border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/70 hover:border-[var(--margin-accent-border)] hover:shadow-[0_0_15px_var(--margin-accent-glow)]"
      )}
    >
      {/* Header Bar */}
      <div
        onClick={onToggleExpand}
        className="group flex cursor-pointer items-start justify-between gap-2.5 p-2.5 transition-colors select-none hover:bg-[var(--wikios-border)]/40"
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
                className="py-0.2 inline-flex items-center gap-1 rounded-md px-1.5 text-[8.5px] font-bold shadow-xs"
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

            <span className="truncate text-[11px] font-bold text-[var(--wikios-text)] transition-colors group-hover:text-[var(--margin-accent-text)]">
              {thread.createdBy.username}
            </span>

            {thread.createdBy.country && (
              <span className="py-0.2 inline-flex items-center gap-1 rounded border border-[var(--margin-accent-border)] bg-[var(--margin-accent-bg)] px-1 text-[8.5px] font-semibold text-[var(--margin-accent-text)]">
                <Crown className="h-2.5 w-2.5" />
                <span className="max-w-[75px] truncate">{thread.createdBy.country.name}</span>
              </span>
            )}

            {thread.sectionAnchor && (
              <span className="py-0.2 max-w-28 truncate rounded border border-[var(--wikios-border)] bg-[var(--wikios-bg)]/60 px-1 text-[8.5px] font-semibold text-[var(--wikios-text-dim)]">
                #{thread.sectionAnchor}
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="line-clamp-2 text-xs leading-snug font-semibold text-[var(--wikios-text)] transition-colors">
            {displayTitle}
          </h4>

          {/* Selected text quote if anchored */}
          {thread.selectedText && (
            <div className="mt-1.5 line-clamp-2 rounded-lg border-l-2 border-[var(--margin-accent)] bg-[var(--margin-accent-bg)] p-2 text-[11px] leading-snug text-[var(--wikios-text-muted)] italic">
              &ldquo;{thread.selectedText}&rdquo;
            </div>
          )}
        </div>

        {/* Status Pill & Expand Chevron */}
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "py-0.2 rounded-full px-1.5 text-[9px] leading-none font-bold tracking-wider uppercase",
              isResolved
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border border-[var(--wikios-border)] bg-[var(--wikios-bg)]/60 text-[var(--wikios-text-muted)]"
            )}
          >
            {isResolved ? "Done" : `${thread.comments.length}`}
          </span>
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-[var(--wikios-text-dim)]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[var(--wikios-text-dim)]" />
          )}
        </div>
      </div>

      {/* Expanded Details & Discussion Timeline */}
      {isExpanded && (
        <div className="animate-in fade-in-50 space-y-3 border-t border-[var(--wikios-border)]/60 px-3 pt-1 pb-3 duration-150">
          {/* Discussion Comments List */}
          <div className="space-y-2 border-t border-[var(--wikios-border)]/40 pt-1">
            {thread.comments.map((comment) => {
              const isCommentAuthorMatch =
                (currentUserId && comment.author.id === currentUserId) ||
                (currentUsername &&
                  comment.author.username.toLowerCase() === currentUsername.toLowerCase());
              const commentLiveAvatar = isCommentAuthorMatch ? currentUserAvatar : undefined;

              return (
                <div
                  key={comment.id}
                  className="group relative space-y-1.5 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/50 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between text-[10px] text-[var(--wikios-text-dim)]">
                    <div className="flex items-center gap-1.5 font-semibold text-[var(--wikios-text)]">
                      <MarginUserAvatar
                        author={comment.author}
                        size="xs"
                        primaryColor={primaryColor}
                        liveAvatar={commentLiveAvatar}
                      />
                      <span className="text-[11px]">{comment.author.username}</span>
                      {comment.author.country?.name && (
                        <span className="text-[9.5px] font-medium text-[var(--margin-accent-text)]">
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
                          className="cursor-pointer rounded p-0.5 text-[var(--wikios-text-dim)] opacity-0 transition-[opacity,color] duration-100 group-hover:opacity-100 hover:text-[var(--margin-accent-text)]"
                          title="Quote in reply"
                        >
                          <Quote className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="pl-6.5 leading-relaxed whitespace-pre-wrap text-[var(--wikios-text)]">
                    {comment.content}
                  </p>

                  {/* Interactive Suggested Edit DiffViewer */}
                  {comment.suggestedEdit && (
                    <div className="space-y-1.5 pt-1 pl-6.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-[var(--margin-accent-text)]">
                        <span className="flex items-center gap-1">
                          <Edit3 className="h-3 w-3" />
                          <span>Suggested edit</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => handleCopyReplacement(comment.id, comment.suggestedEdit!)}
                          className="flex cursor-pointer items-center gap-1 rounded border border-[var(--margin-accent-border)] bg-[var(--margin-accent-bg)] px-1.5 py-0.5 text-[9.5px] text-[var(--margin-accent-text)] transition-transform duration-100 hover:bg-[var(--margin-accent-bg)]/80 active:scale-95"
                        >
                          {copiedReplacementId === comment.id ? (
                            <>
                              <Check className="h-2.5 w-2.5 text-emerald-400" />
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

                      <div className="overflow-hidden rounded-xl border border-[var(--wikios-border)] shadow-xs">
                        <DiffViewer
                          oldCode={thread.selectedText || ""}
                          newCode={comment.suggestedEdit}
                          layout="unified"
                          oldTitle="Current text"
                          newTitle="Proposed replacement"
                          className="text-[11px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Bar: Hold-to-Resolve, Create Child Page & Delete */}
          <div className="flex items-center justify-between border-t border-[var(--wikios-border)] pt-1">
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
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10.5px] font-semibold text-emerald-400 shadow-xs transition-transform duration-100 hover:bg-emerald-500/20 active:scale-95"
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
                className="cursor-pointer p-1 text-[var(--wikios-text-dim)] transition-colors hover:text-rose-400"
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
                    "flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-0.5 text-[10.5px] font-semibold transition-[background-color,border-color,color] duration-100 active:scale-95",
                    showSuggestEdit
                      ? "border-[var(--margin-accent-border)] bg-[var(--margin-accent-bg)] text-[var(--margin-accent-text)]"
                      : "border-[var(--wikios-border)] bg-[var(--wikios-surface)] text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)]"
                  )}
                >
                  <Edit3 className="h-3 w-3 text-[var(--margin-accent-text)]" />
                  <span>{showSuggestEdit ? "Suggested edit enabled" : "Suggest edit"}</span>
                </button>
              </div>

              {/* Secondary textarea for suggested edit replacement */}
              {showSuggestEdit && (
                <div className="space-y-2 rounded-xl border border-[var(--margin-accent-border)] bg-[var(--margin-accent-bg)] p-2.5">
                  <span className="text-[10px] font-bold text-[var(--margin-accent-text)]">
                    Proposed replacement:
                  </span>
                  <textarea
                    rows={2}
                    value={suggestedReplacement}
                    onChange={(e) => setSuggestedReplacement(e.target.value)}
                    placeholder="Type replacement text..."
                    className="w-full rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] px-2.5 py-1.5 font-mono text-xs text-[var(--wikios-text)] outline-none focus:border-[var(--margin-accent)]"
                  />
                  {thread.selectedText && suggestedReplacement && (
                    <div className="pt-1">
                      <DiffViewer
                        oldCode={thread.selectedText}
                        newCode={suggestedReplacement}
                        layout="unified"
                        oldTitle="Current"
                        newTitle="Proposed"
                        className="text-[10px]"
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
                  className="flex-1 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/80 px-3 py-1.5 text-xs text-[var(--wikios-text)] transition-colors outline-none placeholder:text-[var(--wikios-text-dim)] focus:border-[var(--margin-accent)]"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || postCommentMutation.isPending}
                  className="bg-margin-accent hover:bg-margin-accent/90 cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-bold text-stone-950 shadow-xs transition-transform duration-100 active:scale-95 disabled:opacity-40"
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
      soundEffects.success();
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
          <div className="flex items-center rounded-xl border border-[var(--wikios-border)] bg-white/5 p-0.5 shadow-xs">
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
                    "cursor-pointer rounded-lg px-2.5 py-1 text-[10.5px] font-semibold transition-all duration-150 select-none active:scale-95",
                    isActive
                      ? "border border-yellow-400/50 bg-[var(--wikios-surface)] font-bold text-[var(--wikios-text)] shadow-xs"
                      : "text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)]"
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
              className="bg-margin-accent hover:bg-margin-accent/90 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-yellow-400/50 px-3 py-1 text-xs font-bold text-stone-950 shadow-xs transition-all duration-150 select-none active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Thread</span>
            </button>
          )}
        </div>

        {/* Instant Search Bar */}
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--wikios-text-dim)]" />
          <input
            type="text"
            placeholder="Search discussions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-[var(--wikios-border)] bg-white/5 py-1.5 pr-3 pl-8 text-xs text-[var(--wikios-text)] transition-all duration-150 outline-none placeholder:text-[var(--wikios-text-dim)] focus:border-yellow-400/60 focus:bg-[var(--wikios-surface)]"
          />
        </div>
      </div>

      {/* New Thread Composer */}
      {showNewThread && (
        <form
          onSubmit={handleCreateSubmit}
          className="animate-in fade-in zoom-in-95 space-y-3 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/95 p-3.5 shadow-lg backdrop-blur-md"
        >
          {/* Composer Header */}
          <div className="flex items-center gap-1.5 border-b border-[var(--wikios-border)]/60 pb-1.5 text-xs font-semibold text-[var(--wikios-text)]">
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
            <span className="text-[11px] text-[var(--wikios-text-dim)]">
              Posting as{" "}
              <strong className="font-bold text-[var(--wikios-text)]">
                {currentUsername || "You"}
              </strong>
            </span>
          </div>

          {/* 5 Ws Priority Hierarchy Chips */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-[var(--wikios-text-dim)] uppercase">
                Category
              </span>
              <button
                type="button"
                onClick={() => {
                  soundEffects.press();
                  setShowCategoryHelp(true);
                }}
                className="flex cursor-pointer items-center gap-1 text-[10.5px] font-semibold text-[var(--wikios-text)] transition-colors hover:underline"
              >
                <HelpCircle className="dark:text-margin-accent h-3 w-3 text-yellow-600" />
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
                      "flex cursor-pointer flex-col items-center rounded-xl border px-1 py-1.5 text-center transition-[background-color,border-color,color,box-shadow] duration-100 select-none active:scale-95",
                      isSelected
                        ? "bg-margin-accent/20 border-yellow-400/60 font-bold text-[var(--wikios-text)] shadow-xs ring-1 ring-yellow-400/40"
                        : "border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)]"
                    )}
                    title={dim.desc}
                  >
                    <span className="text-xs">{dim.emoji}</span>
                    <span className="mt-0.5 text-[9px] font-bold">{dim.short}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {draftQuote && (
            <div className="bg-margin-accent/15 space-y-1 rounded-xl border border-yellow-400/40 p-2.5 text-xs text-[var(--wikios-text-muted)]">
              <span className="text-[9.5px] font-bold tracking-wider text-[var(--wikios-text)] uppercase">
                Referenced passage:
              </span>
              <p className="line-clamp-2 text-[11px] text-[var(--wikios-text)] italic">
                &ldquo;{draftQuote}&rdquo;
              </p>
            </div>
          )}

          <input
            type="text"
            placeholder="Thread title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-bg)]/80 px-3 py-1.5 text-xs text-[var(--wikios-text)] transition-colors outline-none placeholder:text-[var(--wikios-text-dim)] focus:border-yellow-400/60"
          />

          <textarea
            placeholder="Add context, questions, or evidence..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            className="resize-vertical w-full rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-bg)]/80 px-3 py-1.5 text-xs text-[var(--wikios-text)] transition-colors outline-none placeholder:text-[var(--wikios-text-dim)] focus:border-yellow-400/60"
          />

          {/* Toggle Propose Suggested Edit Diff */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowNewSuggestEdit((prev) => !prev)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[10.5px] font-semibold transition-[background-color,border-color,color] duration-100 active:scale-95",
                showNewSuggestEdit
                  ? "bg-margin-accent/20 border-yellow-400/50 font-bold text-[var(--wikios-text)]"
                  : "border-[var(--wikios-border)] text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)]"
              )}
            >
              <Edit3 className="dark:text-margin-accent h-3 w-3 text-yellow-600" />
              <span>{showNewSuggestEdit ? "Include text diff" : "Suggest edit"}</span>
            </button>

            {showNewSuggestEdit && (
              <div className="bg-margin-accent/10 space-y-2 rounded-xl border border-yellow-400/40 p-2.5">
                <textarea
                  rows={2}
                  value={newSuggestedEdit}
                  onChange={(e) => setNewSuggestedEdit(e.target.value)}
                  placeholder="Type replacement text..."
                  className="w-full rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] px-2.5 py-1.5 font-mono text-xs text-[var(--wikios-text)] outline-none focus:border-yellow-400/60"
                />
                {draftQuote && newSuggestedEdit && (
                  <DiffViewer
                    oldCode={draftQuote}
                    newCode={newSuggestedEdit}
                    layout="unified"
                    oldTitle="Original"
                    newTitle="Proposed"
                    className="text-[10px]"
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
              className="rounded-xl px-3 py-1 text-xs font-semibold text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim() || !newContent.trim() || createThreadMutation.isPending}
              className="bg-margin-accent hover:bg-margin-accent/90 cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-bold text-stone-950 shadow-xs active:scale-95 disabled:opacity-40"
            >
              {createThreadMutation.isPending ? "Posting..." : "Post thread"}
            </button>
          </div>
        </form>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-[var(--wikios-text-muted)]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
          <span className="text-xs">Loading discussions...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredThreads.length === 0 && (
        <div className="space-y-1.5 py-12 text-center text-[var(--wikios-text-muted)]">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-[var(--wikios-text-dim)] opacity-50" />
          <p className="text-xs font-semibold text-[var(--wikios-text)]">No discussions yet</p>
          <p className="mx-auto max-w-xs text-[11px] text-[var(--wikios-text-dim)]">
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
