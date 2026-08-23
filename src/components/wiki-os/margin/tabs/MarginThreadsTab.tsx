// src/components/wiki-os/margin/tabs/MarginThreadsTab.tsx
// Structured discussion threads with comments, hold-to-resolve, and left-sidebar matched styling.

"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  ChatBubble as MessageSquare,
  Plus,
  Check,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  Trash as Trash2,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";

interface CommentAuthor {
  id: string;
  username: string;
  avatar: string | null;
  role: { name: string; displayName: string } | null;
  country: { id: string; name: string; flag: string | null } | null;
}

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

function getInitials(name: string): string {
  const cleaned = name.trim().replace(/_/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function MarginUserAvatar({
  author,
  size = "sm",
  primaryColor = "var(--wikios-accent, #a855f7)",
  liveAvatar,
}: {
  author: CommentAuthor;
  size?: "xs" | "sm" | "md";
  primaryColor?: string;
  liveAvatar?: string | null;
}) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(author.username);
  const avatarUrl = !imgError ? (author.avatar || liveAvatar) : null;
  const flagUrl = author.country?.flag;

  const sizeClasses = {
    xs: "w-5 h-5 text-[8.5px]",
    sm: "w-6 h-6 text-[9.5px]",
    md: "w-8 h-8 text-xs",
  }[size];

  return (
    <div className="relative shrink-0 flex items-center justify-center select-none">
      <div
        className={cn(
          "rounded-full overflow-hidden flex items-center justify-center font-bold transition-all border shadow-xs",
          sizeClasses,
          "border-[var(--wikios-border)] bg-purple-500/15 text-purple-200"
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={author.username}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {/* Country Flag Micro Badge */}
      {flagUrl && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3 h-2.5 rounded-xs overflow-hidden border border-[var(--wikios-border)] shadow-xs bg-[var(--wikios-bg)] flex items-center justify-center"
          title={author.country?.name}
        >
          <img src={flagUrl} alt="" className="w-full h-full object-cover" />
        </span>
      )}
    </div>
  );
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
    }, 1000);
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
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
        title="Reopen discussion thread"
      >
        <Check className="w-3 h-3" />
        <span>Resolved (Click to Reopen)</span>
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
          "relative overflow-hidden px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border shadow-xs cursor-pointer",
          holding
            ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300 scale-95"
            : "border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)] hover:border-[var(--wikios-border)]"
        )}
      >
        {holding && (
          <div
            className="absolute inset-0 bg-emerald-500/30 transition-all duration-1000 ease-linear origin-left"
            style={{ width: "100%" }}
          />
        )}
        <span className="relative z-10 flex items-center gap-1">
          <Check className="w-3 h-3 text-emerald-400" />
          <span>{holding ? "Keep holding..." : "Hold to Resolve"}</span>
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
  const notify = useNotify();
  const primaryColor = themeColors?.primary || "var(--wikios-accent, #3b82f6)";

  const isCreatorMatch =
    (currentUserId && thread.createdBy.id === currentUserId) ||
    (currentUsername && thread.createdBy.username.toLowerCase() === currentUsername.toLowerCase());

  const creatorLiveAvatar = isCreatorMatch ? currentUserAvatar : undefined;

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
    });
  };

  const isResolved = thread.status === "RESOLVED";

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-200 shadow-xs backdrop-blur-md overflow-hidden",
        isResolved
          ? "border-emerald-500/20 bg-emerald-950/10 opacity-75 hover:opacity-100"
          : "border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/70 hover:border-purple-500/40 hover:shadow-[0_0_15px_rgba(168,85,247,0.08)]"
      )}
    >
      {/* Header Bar */}
      <div
        onClick={onToggleExpand}
        className="p-2.5 flex items-start justify-between gap-2.5 cursor-pointer select-none group hover:bg-[var(--wikios-border)]/40 transition-colors"
      >
        <MarginUserAvatar
          author={thread.createdBy}
          size="sm"
          primaryColor={primaryColor}
          liveAvatar={creatorLiveAvatar}
        />

        <div className="flex-1 min-w-0">
          {/* Top metadata: Author, Country, Role, Anchor */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-[11px] font-bold text-[var(--wikios-text)] group-hover:text-purple-300 truncate transition-colors">
              {thread.createdBy.username}
            </span>

            {thread.createdBy.role?.displayName && (
              <span className="rounded border border-purple-500/30 bg-purple-500/10 text-purple-300 px-1 py-0.2 text-[8px] font-semibold">
                {thread.createdBy.role.displayName}
              </span>
            )}

            {thread.createdBy.country && (
              <span className="inline-flex items-center gap-1 rounded border border-[var(--wikios-border)] bg-[var(--wikios-bg)]/40 px-1 py-0.2 text-[8.5px] font-medium text-[var(--wikios-text-muted)]">
                <span className="truncate max-w-[70px]">{thread.createdBy.country.name}</span>
              </span>
            )}

            {thread.sectionAnchor && (
              <span
                className="rounded border border-purple-500/30 bg-purple-500/10 text-purple-300 px-1 py-0.2 text-[8.5px] font-semibold truncate max-w-28"
              >
                #{thread.sectionAnchor}
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-xs font-semibold text-[var(--wikios-text)] leading-snug line-clamp-2 transition-colors">
            {thread.title}
          </h4>

          {/* Selected text quote if anchored */}
          {thread.selectedText && (
            <div className="mt-1.5 p-2 rounded-lg border-l-2 border-purple-400 bg-white/5 text-[11px] text-[var(--wikios-text-muted)] italic leading-snug line-clamp-2">
              &ldquo;{thread.selectedText}&rdquo;
            </div>
          )}
        </div>

        {/* Status Pill & Expand Chevron */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider leading-none",
              isResolved
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border border-[var(--wikios-border)] bg-[var(--wikios-bg)]/60 text-[var(--wikios-text-muted)]"
            )}
          >
            {isResolved ? "Done" : `${thread.comments.length}`}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--wikios-text-dim)]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--wikios-text-dim)]" />
          )}
        </div>
      </div>

      {/* Expanded Thread Content & Comments */}
      {isExpanded && (
        <div className="border-t border-[var(--wikios-border)] bg-[var(--wikios-bg)]/30 p-3.5 space-y-3">
          {/* Thread messages list */}
          <div className="space-y-2.5">
            {thread.comments.map((comment) => {
              const isCommentMatch =
                (currentUserId && comment.author.id === currentUserId) ||
                (currentUsername &&
                  comment.author.username.toLowerCase() === currentUsername.toLowerCase());
              const commentLiveAvatar = isCommentMatch ? currentUserAvatar : undefined;

              return (
                <div
                  key={comment.id}
                  className="p-2.5 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/50 text-xs space-y-1.5"
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
                      {comment.author.role?.displayName && (
                        <span className="rounded border border-purple-500/30 bg-purple-500/10 text-purple-300 px-1 py-0.1 text-[8px] font-semibold">
                          {comment.author.role.displayName}
                        </span>
                      )}
                      {comment.author.country?.name && (
                        <span className="text-[var(--wikios-text-dim)] text-[9.5px]">
                          ({comment.author.country.name})
                        </span>
                      )}
                    </div>
                    <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>

                  <p className="text-[var(--wikios-text)] leading-relaxed whitespace-pre-wrap pl-6.5">
                    {comment.content}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Action Bar: Hold-to-Resolve & Delete */}
          <div className="flex items-center justify-between pt-1 border-t border-[var(--wikios-border)]">
            {isAuthenticated && (
              <HoldToResolveButton
                isResolved={isResolved}
                onResolveToggle={(resolved) =>
                  resolveMutation.mutate({ threadId: thread.id, resolved })
                }
                isPending={resolveMutation.isPending}
              />
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete this entire discussion thread?")) {
                    deleteThreadMutation.mutate({ threadId: thread.id });
                  }
                }}
                className="text-[var(--wikios-text-dim)] hover:text-rose-400 p-1 transition-colors cursor-pointer"
                title="Delete Thread"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Reply Composer */}
          {isAuthenticated && (
            <form onSubmit={handleReplySubmit} className="pt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/80 px-3 py-1.5 text-xs text-[var(--wikios-text)] placeholder:text-[var(--wikios-text-dim)] outline-none focus:border-purple-400 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || postCommentMutation.isPending}
                  className="rounded-xl px-3.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 active:scale-95 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
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
  const primaryColor = themeColors?.primary || "var(--wikios-accent, #3b82f6)";

  const [filter, setFilter] = useState<"OPEN" | "ALL">("OPEN");
  const [showNewThread, setShowNewThread] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const notify = useNotify();

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("wikios_margin_guide_dismissed");
      if (!dismissed) {
        setGuideVisible(true);
      }
    } catch {}
  }, []);

  const dismissGuide = () => {
    soundEffects.press();
    setGuideVisible(false);
    try {
      localStorage.setItem("wikios_margin_guide_dismissed", "true");
    } catch {}
  };

  useEffect(() => {
    if (draftQuote) {
      setShowNewThread(true);
      if (!newTitle) {
        setNewTitle(`Regarding: "${draftQuote.slice(0, 35)}${draftQuote.length > 35 ? "..." : ""}"`);
      }
    }
  }, [draftQuote]);

  const createThreadMutation = api.wikios.createThread.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success("Discussion thread created");
      setShowNewThread(false);
      setNewTitle("");
      setNewContent("");
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
    createThreadMutation.mutate({
      articleTitle,
      title: newTitle.trim(),
      content: newContent.trim(),
      sectionAnchor: activeAnchor || undefined,
      selectedText: draftQuote || undefined,
    });
  };

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (filter === "OPEN") return t.status === "OPEN";
      return true;
    });
  }, [threads, filter]);

  return (
    <div className="space-y-4">
      {/* First-Use Only Interactive Discovery Card */}
      {guideVisible && (
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-500/10 to-transparent backdrop-blur-md p-3 space-y-2 animate-in fade-in zoom-in-95 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/20 text-[11px] font-bold text-purple-300">
                💬
              </span>
              <span className="text-xs font-bold text-[var(--wikios-text)]">
                How to use Margin
              </span>
            </div>
            <button
              type="button"
              onClick={dismissGuide}
              className="text-[10px] font-bold text-purple-300 hover:text-white px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/25 cursor-pointer transition-all active:scale-95"
            >
              Got it
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
            <div className="p-2 rounded-xl bg-[var(--wikios-card-bg)]/80 border border-[var(--wikios-border)] space-y-0.5">
              <p className="font-semibold text-[var(--wikios-text)]">1. Select Prose</p>
              <p className="text-[10px] text-[var(--wikios-text-dim)] leading-tight">
                Highlight text in the article to trigger the floating capsule.
              </p>
            </div>
            <div className="p-2 rounded-xl bg-[var(--wikios-card-bg)]/80 border border-[var(--wikios-border)] space-y-0.5">
              <p className="font-semibold text-[var(--wikios-text)]">2. Anchor Thread</p>
              <p className="text-[10px] text-[var(--wikios-text-dim)] leading-tight">
                Attach thoughts to headings, paragraphs, or quote excerpts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Filter Pills & New Thread Button */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--wikios-border)] pb-3">
        <div className="flex items-center p-1 rounded-xl bg-[var(--wikios-card-bg)]/80 border border-[var(--wikios-border)] shadow-xs">
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
                  "px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-all cursor-pointer",
                  isActive
                    ? "bg-[var(--wikios-surface)] text-purple-300 font-bold border border-white/10 shadow-xs"
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
            className="flex items-center gap-1.5 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] px-3 py-1 text-xs font-semibold text-[var(--wikios-text)] hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-300 active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-purple-400" />
            <span>New</span>
          </button>
        )}
      </div>

      {/* New Thread Form */}
      {showNewThread && (
        <form
          onSubmit={handleCreateSubmit}
          className="p-3.5 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/90 backdrop-blur-md space-y-2.5 animate-in fade-in zoom-in-95 shadow-lg"
        >
          {isAuthenticated && (
            <div className="flex items-center justify-between pb-1.5 border-b border-[var(--wikios-border)]/60 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--wikios-text)]">
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
                  Posting as <strong className="text-purple-300 font-semibold">{currentUsername || "You"}</strong>
                </span>
              </div>
              {activeAnchor && (
                <span className="text-[10px] text-purple-300 font-medium">#{activeAnchor}</span>
              )}
            </div>
          )}

          {draftQuote && (
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-[var(--wikios-text-muted)] space-y-1">
              <span className="text-[9.5px] font-bold text-purple-300 uppercase tracking-wider">Referenced Text:</span>
              <p className="italic text-[11px] text-[var(--wikios-text)] line-clamp-2">&ldquo;{draftQuote}&rdquo;</p>
            </div>
          )}

          <input
            type="text"
            placeholder="Topic or question..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-bg)]/80 px-3 py-1.5 text-xs text-[var(--wikios-text)] placeholder:text-[var(--wikios-text-dim)] outline-none focus:border-purple-400 transition-colors"
          />

          <textarea
            placeholder="Details, context, or evidence..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-bg)]/80 px-3 py-1.5 text-xs text-[var(--wikios-text)] placeholder:text-[var(--wikios-text-dim)] outline-none focus:border-purple-400 transition-colors resize-vertical"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowNewThread(false);
                onClearDraftQuote?.();
              }}
              className="px-3 py-1 rounded-xl text-xs font-semibold text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim() || !newContent.trim() || createThreadMutation.isPending}
              className="px-3.5 py-1 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:opacity-40 shadow-xs cursor-pointer"
            >
              {createThreadMutation.isPending ? "Posting..." : "Post Thread"}
            </button>
          </div>
        </form>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-[var(--wikios-text-muted)]">
          <div
            className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"
          />
          <span className="text-xs">Loading Margin threads...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredThreads.length === 0 && (
        <div className="py-12 text-center text-[var(--wikios-text-muted)] space-y-1.5">
          <MessageSquare className="w-8 h-8 text-[var(--wikios-text-dim)] mx-auto mb-2" />
          <p className="text-xs font-semibold text-[var(--wikios-text)]">No discussion threads</p>
          <p className="text-[11px] text-[var(--wikios-text-dim)] max-w-xs mx-auto">
            Highlight text in the article or click &ldquo;New&rdquo; to start a discussion.
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
    </div>
  );
}
