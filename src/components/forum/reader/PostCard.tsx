// src/components/forum/reader/PostCard.tsx
// Renders a single forum post within a thread view.

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Heart, Quote, Reply, Bookmark, EditPencil as Pencil, Trash as Trash2, Xmark as X, Check, Send } from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import * as IconoirIcons from "iconoir-react";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { sanitizeHtml } from "~/lib/utils";

interface PostCardProps {
  postId: number;
  threadId: number;
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  authorTitle: string | null;
  authorMessageCount: number;
  authorReactionScore: number;
  authorJoinDate: number;
  postDate: number;
  contentHtml: string;
  isFirstPost: boolean;
  reactionScore: number;
  position: number;
  attachments: Array<{
    id: number;
    filename: string;
    fileSize: number;
    thumbnailUrl: string | null;
    directUrl: string | null;
    contentType: string;
    width: number | null;
    height: number | null;
  }>;
  threadTitle?: string;
  currentForumUserId?: number | null;
  onQuote?: (authorName: string, content: string) => void;
  onReply?: () => void;
}

function formatDate(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJoinDate(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

export function PostCard({
  postId,
  threadId,
  authorId,
  authorName,
  authorAvatar,
  authorTitle,
  authorMessageCount,
  authorReactionScore,
  authorJoinDate,
  postDate,
  contentHtml,
  isFirstPost,
  reactionScore,
  position,
  attachments,
  threadTitle,
  currentForumUserId,
  onQuote,
  onReply,
}: PostCardProps) {
  const [localReactionScore, setLocalReactionScore] = useState(reactionScore);
  const [hasReacted, setHasReacted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const isOwnPost = currentForumUserId != null && currentForumUserId === authorId;
  const utils = api.useUtils();
  const { chatBadge } = useActiveCosmetics();
  const CrownIcon = (IconoirIcons as any)[chatBadge.icon] || IconoirIcons.Crown;

  const reactMutation = api.forum.reactToPost.useMutation({
    onMutate: () => {
      // Optimistic update
      setHasReacted((prev) => !prev);
      setLocalReactionScore((prev) => (hasReacted ? prev - 1 : prev + 1));
    },
    onError: () => {
      // Revert on error
      setHasReacted((prev) => !prev);
      setLocalReactionScore(reactionScore);
    },
  });

  const editMutation = api.forum.editPost.useMutation({
    onSuccess: () => {
      setIsEditing(false);
      utils.forum.getThread.invalidate({ threadId });
    },
  });

  const deleteMutation = api.forum.deletePost.useMutation({
    onSuccess: () => {
      setShowDeleteConfirm(false);
      utils.forum.getThread.invalidate({ threadId });
    },
  });

  // Stash thread (replaces XenForo bookmarks — uses LoreStash system)
  const stashQuery = api.forum.isThreadStashed.useQuery({ threadId }, { staleTime: 30_000 });
  const stashMutation = api.forum.stashThread.useMutation({
    onMutate: () => setIsBookmarked(true),
    onSuccess: () => utils.forum.isThreadStashed.invalidate({ threadId }),
    onError: () => setIsBookmarked(false),
  });
  const unstashMutation = api.forum.unstashThread.useMutation({
    onMutate: () => setIsBookmarked(false),
    onSuccess: () => utils.forum.isThreadStashed.invalidate({ threadId }),
    onError: () => setIsBookmarked(true),
  });

  // Sync local state with query
  const isStashed = stashQuery.data?.stashed ?? isBookmarked;

  const handleReact = useCallback(() => {
    reactMutation.mutate({ postId });
  }, [postId, reactMutation]);

  const handleQuote = useCallback(() => {
    if (onQuote) {
      // Strip HTML for quote text
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = contentHtml;
      onQuote(authorName, tempDiv.textContent ?? "");
    }
  }, [onQuote, authorName, contentHtml]);

  return (
    <article
      className={`glass-forum-post forum-post-card ${isFirstPost ? "glass-forum-post-op" : ""}`}
      id={`post-${postId}`}
    >
      {/* Author sidebar (desktop only) */}
      <div className="forum-post-author">
        <Link href={withBasePath(`/forum/members/${authorId}`)}>
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt={authorName}
              className="forum-post-avatar"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="forum-post-avatar flex items-center justify-center border-orange-500/20 bg-orange-500/10 text-lg font-semibold text-orange-400">
              {authorName.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <Link
          href={withBasePath(`/forum/members/${authorId}`)}
          className="forum-post-username flex items-center gap-1"
        >
          <span>{authorName}</span>
          {isOwnPost && chatBadge.enabled && (
            <CrownIcon className="h-3.5 w-3.5 shrink-0" style={{ color: chatBadge.color }} />
          )}
        </Link>
        {authorTitle && <span className="forum-post-user-title">{authorTitle}</span>}
        <div className="forum-post-user-stats">
          <div>Posts: {authorMessageCount.toLocaleString()}</div>
          <div>Reactions: {authorReactionScore.toLocaleString()}</div>
          <div>Joined: {formatJoinDate(authorJoinDate)}</div>
        </div>
      </div>

      {/* Post body */}
      <div className="forum-post-body">
        {/* Header: mobile author + date */}
        <div className="forum-post-header">
          {/* Mobile-only inline author */}
          <div className="flex items-center gap-2 md:hidden">
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt=""
                className="h-6 w-6 rounded-full"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-[10px] font-medium text-orange-400">
                {authorName.charAt(0).toUpperCase()}
              </div>
            )}
            <Link
              href={withBasePath(`/forum/members/${authorId}`)}
              className="flex items-center gap-1 text-xs font-medium text-[var(--forum-text)]"
            >
              <span>{authorName}</span>
              {isOwnPost && chatBadge.enabled && (
                <CrownIcon className="h-3 w-3 shrink-0" style={{ color: chatBadge.color }} />
              )}
            </Link>
          </div>
          <span className="forum-post-date">{formatDate(postDate)}</span>
          <span className="text-[var(--forum-text-dim)]">#{position + 1}</span>
        </div>

        {/* Content — edit mode or rendered HTML */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editMessage}
              onChange={(e) => setEditMessage(e.target.value)}
              className="forum-composer-input min-h-[120px]"
              rows={6}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => editMutation.mutate({ postId, message: editMessage })}
                disabled={!editMessage.trim() || editMutation.isPending}
                className="forum-composer-submit text-xs"
              >
                {editMutation.isPending ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setIsEditing(false)} className="forum-action-btn text-xs">
                Cancel
              </button>
            </div>
            {editMutation.error && (
              <p className="text-xs text-red-400">{editMutation.error.message}</p>
            )}
          </div>
        ) : (
          <div
            className="forum-post-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentHtml) }}
          />
        )}

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
            <span className="text-xs text-red-400">Delete this post?</span>
            <button
              onClick={() => deleteMutation.mutate({ postId })}
              disabled={deleteMutation.isPending}
              className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting..." : "Confirm"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs text-[var(--forum-text-dim)] hover:text-[var(--forum-text)]"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((att) => {
              if (att.contentType.startsWith("image/") && att.directUrl) {
                return (
                  <a
                    key={att.id}
                    href={att.directUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={att.thumbnailUrl ?? att.directUrl}
                      alt={att.filename}
                      className="h-20 w-auto rounded-lg border border-[var(--forum-border)] object-cover"
                      loading="lazy"
                    />
                  </a>
                );
              }
              return (
                <a
                  key={att.id}
                  href={att.directUrl ?? "#"}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--forum-border)] px-3 py-1.5 text-xs text-[var(--forum-text-muted)] hover:border-[var(--forum-accent-border)] hover:text-[var(--forum-accent)]"
                  download
                >
                  {att.filename}
                  <span className="text-[var(--forum-text-dim)]">
                    ({(att.fileSize / 1024).toFixed(0)} KB)
                  </span>
                </a>
              );
            })}
          </div>
        )}

        {/* Reaction bar + actions */}
        <div className="forum-reactions">
          <button
            onClick={handleReact}
            className={cn("forum-reaction-btn", hasReacted && "forum-reaction-btn-active")}
            title="Like"
          >
            <Heart className={cn("h-3.5 w-3.5", hasReacted && "fill-current")} />
            {localReactionScore > 0 && <span>{localReactionScore}</span>}
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => {
                if (isStashed) {
                  unstashMutation.mutate({ threadId });
                } else {
                  stashMutation.mutate({ threadId, title: threadTitle ?? `Thread #${threadId}` });
                }
              }}
              className={cn("forum-action-btn", isStashed && "text-[var(--forum-accent)]")}
              title={isStashed ? "Remove from stash" : "Stash thread"}
            >
              <Bookmark className={cn("h-3.5 w-3.5", isStashed && "fill-current")} />
            </button>
            <button onClick={handleQuote} className="forum-action-btn" title="Quote">
              <Quote className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Quote</span>
            </button>
            <button onClick={onReply} className="forum-action-btn" title="Reply">
              <Reply className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reply</span>
            </button>
            {isOwnPost && (
              <>
                <button
                  onClick={() => {
                    setEditMessage("");
                    setIsEditing(true);
                  }}
                  className="forum-action-btn"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="forum-action-btn hover:!text-red-400"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
