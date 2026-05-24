// src/app/(forum)/forum/search/page.tsx
// Forum search results page.

"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, MessageSquare, FileText } from "lucide-react";
import { ForumLayout } from "~/components/forum/shared/ForumLayout";
import { ForumPagination } from "~/components/forum/reader/Pagination";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";

function formatTimeAgo(unixTimestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - unixTimestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixTimestamp * 1000).toLocaleDateString();
}

export default function ForumSearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [type, setType] = useState<"thread" | "post" | undefined>(undefined);

  const { data, isLoading } = api.forum.searchForum.useQuery(
    { query: searchQuery, type, page },
    { staleTime: 30_000, enabled: searchQuery.length >= 2 }
  );

  const handleSearch = () => {
    if (query.trim().length >= 2) {
      setSearchQuery(query.trim());
      setPage(1);
    }
  };

  return (
    <ForumLayout>
      <h1 className="mb-4 text-xl font-semibold text-[var(--forum-text)]">Search Forums</h1>

      {/* Search input */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--forum-text-dim)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search threads and posts..."
            className="w-full rounded-lg border border-[var(--forum-border)] bg-[var(--forum-surface)] py-2 pr-3 pl-9 text-sm text-[var(--forum-text)] outline-none placeholder:text-[var(--forum-text-dim)] focus:border-[var(--forum-accent)]"
          />
        </div>
        <button onClick={handleSearch} className="forum-composer-submit">
          Search
        </button>
      </div>

      {/* Type filter */}
      <div className="mb-4 flex gap-2">
        {[
          { key: undefined, label: "All" },
          { key: "thread" as const, label: "Threads" },
          { key: "post" as const, label: "Posts" },
        ].map((opt) => (
          <button
            key={opt.label}
            onClick={() => {
              setType(opt.key);
              setPage(1);
            }}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              type === opt.key
                ? "bg-orange-500/15 text-orange-400"
                : "text-[var(--forum-text-dim)] hover:text-[var(--forum-text-muted)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="forum-skeleton h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : searchQuery.length >= 2 ? (
        <div className="space-y-2">
          {(data?.results ?? []).map((result, idx) => (
            <Link
              key={`${result.type}-${result.id}-${idx}`}
              href={withBasePath(
                result.type === "thread" && result.thread
                  ? `/forum/thread/${result.thread.threadId}`
                  : result.post
                    ? `/forum/thread/${result.post.threadId}#post-${result.post.postId}`
                    : "#"
              )}
              className="glass-forum-child group flex items-start gap-3 p-3"
            >
              <div className="mt-0.5 shrink-0">
                {result.type === "thread" ? (
                  <MessageSquare className="h-4 w-4 text-[var(--forum-accent)]" />
                ) : (
                  <FileText className="h-4 w-4 text-[var(--forum-text-dim)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--forum-text)] group-hover:text-[var(--forum-accent)]">
                  {result.thread?.title ?? "Post"}
                </div>
                <div className="mt-0.5 text-xs text-[var(--forum-text-dim)]">
                  {result.thread && (
                    <>
                      by {result.thread.authorName} · {result.thread.replyCount} replies ·{" "}
                      {formatTimeAgo(result.thread.postDate)}
                    </>
                  )}
                  {result.post && (
                    <>
                      by {result.post.authorName} · {formatTimeAgo(result.post.postDate)}
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}

          {(data?.results ?? []).length === 0 && (
            <div className="py-8 text-center text-sm text-[var(--forum-text-dim)]">
              No results found for &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>
      ) : null}

      {data?.pagination && data.pagination.last_page > 1 && (
        <ForumPagination
          currentPage={data.pagination.current_page}
          lastPage={data.pagination.last_page}
          onPageChange={setPage}
        />
      )}
    </ForumLayout>
  );
}
