"use client";
// src/app/(forum)/forum/bookmarks/page.tsx
// Forum stashes — shows threads saved via the LoreStash system.

import Link from "next/link";
import {
  Bookmark,
  ChatBubble as MessageSquare,
  Clock,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { ForumLayout } from "~/components/forum/shared/ForumLayout";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";

function formatTimeAgo(date: Date | string): string {
  const d = new Date(date);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function ForumStashesPage() {
  const { data, isLoading, error } = api.forum.getStashedThreads.useQuery(
    { limit: 50 },
    { staleTime: 30_000 }
  );

  const threads = data ?? [];

  return (
    <ForumLayout>
      <div className="mx-auto mb-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--forum-text)]">Stashed Threads</h1>
            <p className="mt-1 text-sm text-[var(--forum-text-dim)]">
              Forum threads you&apos;ve saved for later
            </p>
          </div>
          <Link
            href={withBasePath("/stashes")}
            prefetch={false}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--forum-border)] px-3 py-1.5 text-xs font-medium text-[var(--forum-text-dim)] transition-colors hover:border-[var(--forum-accent-border)] hover:text-[var(--forum-accent)]"
          >
            All Stashes
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="forum-skeleton h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : threads.length > 0 ? (
        <div className="glass-forum-parent overflow-hidden p-1">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={withBasePath(thread.slug)}
              className="glass-forum-child group mb-0.5 flex items-center gap-3 p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[var(--forum-text)] transition-colors group-hover:text-[var(--forum-accent)]">
                  {thread.title}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--forum-text-dim)]">
                  <Clock className="h-3 w-3" />
                  Saved {formatTimeAgo(thread.savedAt)}
                </div>
              </div>
              <Bookmark className="h-4 w-4 shrink-0 fill-[var(--forum-accent)] text-[var(--forum-accent)]" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass-forum-parent p-8 text-center">
          <Bookmark className="mx-auto mb-3 h-10 w-10 text-[var(--forum-accent)] opacity-30" />
          <h2 className="text-sm font-medium text-[var(--forum-text)]">No stashed threads yet</h2>
          <p className="mx-auto mt-2 max-w-md text-xs text-[var(--forum-text-dim)]">
            Click the bookmark icon on any forum post to save the thread to your stash for later.
          </p>
        </div>
      )}
    </ForumLayout>
  );
}
