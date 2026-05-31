// src/components/forum/reader/ThreadListItem.tsx
// Single row in a thread list view.

"use client";

import Link from "next/link";
import { Pin, Lock, Eye, MessageSquare } from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import * as LucideIcons from "lucide-react";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";

interface ThreadListItemProps {
  threadId: number;
  title: string;
  authorId?: number; // NormalizedThread includes this
  authorName: string;
  authorAvatar: string | null;
  postDate: number;
  replyCount: number;
  viewCount: number;
  lastPostDate: number;
  lastPostUsername: string;
  isSticky: boolean;
  isOpen: boolean;
}

function formatTimeAgo(unixTimestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - unixTimestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixTimestamp * 1000).toLocaleDateString();
}

export function ThreadListItem({
  threadId,
  title,
  authorId,
  authorName,
  authorAvatar,
  postDate,
  replyCount,
  viewCount,
  lastPostDate,
  lastPostUsername,
  isSticky,
  isOpen,
}: ThreadListItemProps) {
  // Get linked forum user ID
  const { data: linkStatus } = api.forum.getLinkStatus.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const currentForumUserId = linkStatus?.forumUserId ?? null;
  const isOwnThread = currentForumUserId != null && authorId != null && currentForumUserId === authorId;

  const { chatBadge } = useActiveCosmetics();
  const CrownIcon = (LucideIcons as any)[chatBadge.icon] || LucideIcons.Crown;

  return (
    <div
      className={`forum-thread-row ${isSticky ? "forum-thread-row-sticky" : ""} ${!isOpen ? "opacity-75" : ""}`}
    >
      {/* Avatar */}
      <div className="hidden shrink-0 sm:block">
        {authorAvatar ? (
          <img
            src={authorAvatar}
            alt={authorName}
            className="h-9 w-9 rounded-full border border-[var(--forum-border)] object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10 text-xs font-medium text-orange-400">
            {authorName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Title + Author */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isSticky && <Pin className="h-3 w-3 shrink-0 text-[var(--forum-accent)]" />}
          {!isOpen && <Lock className="h-3 w-3 shrink-0 text-[var(--forum-text-dim)]" />}
          <Link
            href={withBasePath(`/forum/thread/${threadId}`)}
            className="forum-thread-title truncate"
          >
            {title}
          </Link>
        </div>
        <div className="forum-thread-meta mt-0.5 flex items-center gap-1 flex-wrap">
          <span>{authorName}</span>
          {isOwnThread && chatBadge.enabled && (
            <CrownIcon className="h-3 w-3 shrink-0" style={{ color: chatBadge.color }} />
          )}
          <span className="mx-0.5">·</span>
          <span>{formatTimeAgo(postDate)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="hidden shrink-0 items-center gap-4 text-xs text-[var(--forum-text-dim)] sm:flex">
        <span className="flex items-center gap-1" title="Replies">
          <MessageSquare className="h-3.5 w-3.5" />
          {replyCount.toLocaleString()}
        </span>
        <span className="flex items-center gap-1" title="Views">
          <Eye className="h-3.5 w-3.5" />
          {viewCount.toLocaleString()}
        </span>
      </div>

      {/* Last post */}
      <div className="hidden shrink-0 text-right md:block" style={{ minWidth: "100px" }}>
        <div className="text-xs text-[var(--forum-text-muted)]">{formatTimeAgo(lastPostDate)}</div>
        <div className="text-xs text-[var(--forum-text-dim)]">by {lastPostUsername}</div>
      </div>
    </div>
  );
}
