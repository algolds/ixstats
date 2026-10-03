"use client";
// Single row in a thread list view.

import Link from "next/link";
import { Pin, Lock, Eye, ChatBubble as MessageSquare } from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import * as IconoirIcons from "iconoir-react";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { timeAgo } from "~/lib/format/compact";

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

const formatTimeAgo = (unixTimestamp: number) => timeAgo(unixTimestamp * 1000);

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
  const isOwnThread =
    currentForumUserId != null && authorId != null && currentForumUserId === authorId;

  const { chatBadge } = useActiveCosmetics();
  const CrownIcon = (IconoirIcons as any)[chatBadge.icon] || IconoirIcons.Crown;

  return (
    <div
      className={`forum-thread-row ${isSticky ? "forum-thread-row-sticky" : ""} ${!isOpen ? "opacity-75" : ""}`}
    >
      <div className="hidden shrink-0 sm:block">
        {authorAvatar ? (
          <img
            src={authorAvatar}
            alt={authorName}
            className="border-separator h-9 w-9 rounded-full border object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="bg-tint-fill text-tint text-footnote flex size-9 items-center justify-center rounded-full font-medium">
            {authorName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isSticky && <Pin className="text-tint h-3 w-3 shrink-0" />}
          {!isOpen && <Lock className="text-label-secondary h-3 w-3 shrink-0" />}
          <Link
            href={withBasePath(`/forum/thread/${threadId}`)}
            className="forum-thread-title truncate"
          >
            {title}
          </Link>
        </div>
        <div className="forum-thread-meta mt-0.5 flex flex-wrap items-center gap-1">
          <span>{authorName}</span>
          {isOwnThread && chatBadge.enabled && (
            <CrownIcon className="h-3 w-3 shrink-0" style={{ color: chatBadge.color }} />
          )}
          <span className="mx-0.5">·</span>
          <span>{formatTimeAgo(postDate)}</span>
        </div>
      </div>

      <div className="text-footnote text-label-secondary hidden shrink-0 items-center gap-4 tabular-nums sm:flex">
        <span className="flex items-center gap-1" title="Replies">
          <MessageSquare className="h-3.5 w-3.5" />
          {replyCount.toLocaleString()}
        </span>
        <span className="flex items-center gap-1" title="Views">
          <Eye className="h-3.5 w-3.5" />
          {viewCount.toLocaleString()}
        </span>
      </div>

      <div className="hidden shrink-0 text-right md:block" style={{ minWidth: "100px" }}>
        <div className="text-footnote text-label-secondary">{formatTimeAgo(lastPostDate)}</div>
        <div className="text-footnote text-label-secondary">by {lastPostUsername}</div>
      </div>
    </div>
  );
}
