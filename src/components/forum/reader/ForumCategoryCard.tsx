// src/components/forum/reader/ForumCategoryCard.tsx
// Renders a forum category/sub-forum card on the forum index page.

"use client";

import Link from "next/link";
import { MessageSquare, Clock } from "lucide-react";
import { withBasePath } from "~/lib/base-path";

interface ForumCategoryCardProps {
  nodeId: number;
  title: string;
  description: string;
  threadCount: number;
  messageCount: number;
  lastPostDate: number | null;
  lastPostUsername: string | null;
  lastThreadTitle: string | null;
  lastThreadId: number | null;
  isCategory?: boolean;
  children?: React.ReactNode;
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

export function ForumCategoryCard({
  nodeId,
  title,
  description,
  threadCount,
  messageCount,
  lastPostDate,
  lastPostUsername,
  lastThreadTitle,
  lastThreadId,
  isCategory,
  children,
}: ForumCategoryCardProps) {
  if (isCategory) {
    return (
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-[var(--forum-accent)]" />
          <h2 className="text-xs font-semibold tracking-widest text-[var(--forum-accent)] uppercase">
            {title}
          </h2>
        </div>
        {description && (
          <p className="mb-3 ml-6 text-xs text-[var(--forum-text-dim)]">{description}</p>
        )}
        <div className="glass-forum-parent space-y-0.5 overflow-hidden p-1">{children}</div>
      </div>
    );
  }

  return (
    <Link
      href={withBasePath(`/forum/${nodeId}`)}
      className="glass-forum-child forum-category-card group flex items-center gap-4"
    >
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 transition-colors group-hover:bg-orange-500/20">
        <MessageSquare className="h-5 w-5" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium text-[var(--forum-text)] transition-colors group-hover:text-[var(--forum-accent)]">
          {title}
        </h3>
        {description && (
          <p className="mt-0.5 truncate text-xs text-[var(--forum-text-dim)]">{description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-xs text-[var(--forum-text-muted)]">
          {threadCount.toLocaleString()} threads
        </div>
        <div className="text-xs text-[var(--forum-text-dim)]">
          {messageCount.toLocaleString()} posts
        </div>
      </div>

      {/* Last post */}
      {lastPostDate && (
        <div className="hidden shrink-0 text-right md:block" style={{ minWidth: "140px" }}>
          {lastThreadTitle && lastThreadId && (
            <div
              className="truncate text-xs text-[var(--forum-text-muted)]"
              style={{ maxWidth: "140px" }}
            >
              {lastThreadTitle}
            </div>
          )}
          <div className="flex items-center justify-end gap-1 text-xs text-[var(--forum-text-dim)]">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(lastPostDate)}
            {lastPostUsername && <span>by {lastPostUsername}</span>}
          </div>
        </div>
      )}
    </Link>
  );
}
