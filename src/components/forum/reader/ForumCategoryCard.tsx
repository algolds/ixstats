"use client";
// src/components/forum/reader/ForumCategoryCard.tsx
// Renders a forum category/sub-forum card on the forum index page.

import Link from "next/link";
import { ChatBubble as MessageSquare, Clock } from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { timeAgo } from "~/lib/format/compact";
import { Card } from "~/components/ui/card";

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

const formatTimeAgo = (unixTimestamp: number) => timeAgo(unixTimestamp * 1000);

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
      <section className="mb-6">
        <div className="mb-2 px-4">
          <h2 className="text-headline text-label">{title}</h2>
          {description && (
            <p className="text-footnote text-label-secondary mt-0.5">{description}</p>
          )}
        </div>
        <Card className="divide-separator divide-y overflow-hidden">{children}</Card>
      </section>
    );
  }

  return (
    <Link
      href={withBasePath(`/forum/${nodeId}`)}
      className="forum-category-card group flex items-center gap-4"
    >
      {/* Icon */}
      <div className="bg-tint-fill text-tint rounded-control flex size-10 shrink-0 items-center justify-center">
        <MessageSquare className="h-5 w-5" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <h3 className="text-headline text-label group-hover:text-tint transition-colors">
          {title}
        </h3>
        {description && (
          <p className="text-footnote text-label-secondary mt-0.5 truncate">{description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="hidden shrink-0 text-right tabular-nums sm:block">
        <div className="text-footnote text-label-secondary">
          {threadCount.toLocaleString()} threads
        </div>
        <div className="text-footnote text-label-secondary">
          {messageCount.toLocaleString()} posts
        </div>
      </div>

      {/* Last post */}
      {lastPostDate && (
        <div className="hidden shrink-0 text-right md:block" style={{ minWidth: "140px" }}>
          {lastThreadTitle && lastThreadId && (
            <div
              className="text-footnote text-label-secondary truncate"
              style={{ maxWidth: "140px" }}
            >
              {lastThreadTitle}
            </div>
          )}
          <div className="text-footnote text-label-secondary flex items-center justify-end gap-1">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(lastPostDate)}
            {lastPostUsername && <span>by {lastPostUsername}</span>}
          </div>
        </div>
      )}
    </Link>
  );
}
