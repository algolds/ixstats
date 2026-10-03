"use client";
// src/components/forum/reader/PostCard.tsx
// Renders a single forum post within a thread view.

import { useState, useCallback } from "react";
import Link from "next/link";
// oxlint-disable-next-line eslint/no-unused-vars
import {
  Heart,
  Quote,
  Reply,
  Bookmark,
  EditPencil as Pencil,
  Trash as Trash2,
  Check,
} from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { ActionPill } from "~/components/ui/action-pill";
import { api } from "~/trpc/react";
import * as IconoirIcons from "iconoir-react";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { sanitizeHtml } from "~/lib/utils";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

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
      className={cn(
        "bg-surface text-label border-separator rounded-card shadow-card border",
        "forum-post-card",
        isFirstPost && "border-t-tint border-t-2"
      )}
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
            <div className="forum-post-avatar bg-tint-fill text-tint text-title-3 flex items-center justify-center">
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
              <div className="bg-tint-fill text-tint text-footnote flex size-6 items-center justify-center rounded-full font-medium">
                {authorName.charAt(0).toUpperCase()}
              </div>
            )}
            <Link
              href={withBasePath(`/forum/members/${authorId}`)}
              className="text-footnote text-label flex items-center gap-1 font-medium"
            >
              <span>{authorName}</span>
              {isOwnPost && chatBadge.enabled && (
                <CrownIcon className="h-3 w-3 shrink-0" style={{ color: chatBadge.color }} />
              )}
            </Link>
          </div>
          <span className="forum-post-date">{formatDate(postDate)}</span>
          <span className="text-label-secondary">#{position + 1}</span>
        </div>

        {/* Content — edit mode or rendered HTML */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editMessage}
              onChange={(e) => setEditMessage(e.target.value)}
              className="min-h-[120px]"
              rows={6}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => editMutation.mutate({ postId, message: editMessage })}
                disabled={!editMessage.trim() || editMutation.isPending}
              >
                {editMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
            {editMutation.error && (
              <p className="text-footnote text-destructive">{editMutation.error.message}</p>
            )}
          </div>
        ) : (
          <div
            className="forum-post-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentHtml) }}
          />
        )}

        {/* Delete confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this post?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            {deleteMutation.error && (
              <p className="text-footnote text-destructive">{deleteMutation.error.message}</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={(event) => {
                  // Stay open while the delete runs; onSuccess closes it.
                  event.preventDefault();
                  deleteMutation.mutate({ postId });
                }}
              >
                <Trash2 aria-hidden="true" />
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                      className="rounded-control border-separator h-20 w-auto border object-cover"
                      loading="lazy"
                    />
                  </a>
                );
              }
              return (
                <a
                  key={att.id}
                  href={att.directUrl ?? "#"}
                  className="rounded-control border-separator text-footnote text-label-secondary hover:border-tint/30 hover:text-tint flex items-center gap-2 border px-3 py-2"
                  download
                >
                  {att.filename}
                  <span className="text-label-secondary">
                    ({(att.fileSize / 1024).toFixed(0)} KB)
                  </span>
                </a>
              );
            })}
          </div>
        )}

        {/* Reaction bar + actions */}
        <div className="forum-reactions">
          <ActionPill
            size="md"
            pressed={hasReacted}
            onClick={handleReact}
            icon={<Heart className={cn(hasReacted && "fill-current")} />}
            count={localReactionScore > 0 ? localReactionScore : null}
            aria-label="Like"
            title="Like"
          />

          <div className="ml-auto flex items-center gap-1">
            <ActionPill
              size="md"
              pressed={isStashed}
              onClick={() => {
                if (isStashed) {
                  unstashMutation.mutate({ threadId });
                } else {
                  stashMutation.mutate({ threadId, title: threadTitle ?? `Thread #${threadId}` });
                }
              }}
              icon={<Bookmark className={cn(isStashed && "fill-current")} />}
              aria-label={isStashed ? "Remove from stash" : "Stash thread"}
              title={isStashed ? "Remove from stash" : "Stash thread"}
            />
            <ActionPill
              size="md"
              onClick={handleQuote}
              icon={<Quote />}
              aria-label="Quote"
              title="Quote"
            >
              <span className="hidden sm:inline">Quote</span>
            </ActionPill>
            <ActionPill
              size="md"
              onClick={onReply}
              icon={<Reply />}
              aria-label="Reply"
              title="Reply"
            >
              <span className="hidden sm:inline">Reply</span>
            </ActionPill>
            {isOwnPost && (
              <>
                <ActionPill
                  size="md"
                  onClick={() => {
                    setEditMessage("");
                    setIsEditing(true);
                  }}
                  icon={<Pencil />}
                  aria-label="Edit"
                  title="Edit"
                >
                  <span className="hidden sm:inline">Edit</span>
                </ActionPill>
                <ActionPill
                  size="md"
                  onClick={() => setShowDeleteConfirm(true)}
                  icon={<Trash2 />}
                  className="hover:text-destructive"
                  aria-label="Delete"
                  title="Delete"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
