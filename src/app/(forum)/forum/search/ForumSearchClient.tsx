"use client";
// Forum search results page.

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ChatBubble as MessageSquare, Page as FileText } from "iconoir-react";
import { ForumLayout } from "~/components/forum/shared/ForumLayout";
import { ForumPagination } from "~/components/forum/reader/Pagination";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { timeAgo } from "~/lib/format/compact";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";

const formatTimeAgo = (unixTimestamp: number) => timeAgo(unixTimestamp * 1000);

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
      <h1 className="text-large-title text-label mb-4">Search forums</h1>

      <div className="mb-4 flex gap-2">
        <SearchField
          containerClassName="flex-1"
          value={query}
          onValueChange={setQuery}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search threads and posts..."
          aria-label="Search forums"
        />
        <Button onClick={handleSearch}>Search</Button>
      </div>

      <SegmentedControl
        size="sm"
        aria-label="Result type"
        className="mb-4"
        value={type ?? "all"}
        onValueChange={(next) => {
          setType(next === "all" ? undefined : next);
          setPage(1);
        }}
        options={[
          { value: "all", label: "All" },
          { value: "thread", label: "Threads" },
          { value: "post", label: "Posts" },
        ]}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="rounded-row h-16 w-full" />
          ))}
        </div>
      ) : searchQuery.length >= 2 ? (
        <FacetList>
          <FacetListSection>
            {(data?.results ?? []).map((result, idx) => (
              <FacetRow
                key={`${result.type}-${result.id}-${idx}`}
                href={withBasePath(
                  result.type === "thread" && result.thread
                    ? `/forum/thread/${result.thread.threadId}`
                    : result.post
                      ? `/forum/thread/${result.post.threadId}#post-${result.post.postId}`
                      : "#"
                )}
                leading={
                  result.type === "thread" ? (
                    <MessageSquare className="text-tint size-4" />
                  ) : (
                    <FileText className="text-label-secondary size-4" />
                  )
                }
                title={result.thread?.title ?? "Post"}
                subtitle={
                  <>
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
                  </>
                }
              />
            ))}
          </FacetListSection>

          {(data?.results ?? []).length === 0 && (
            <EmptyState
              compact
              icon={<Search />}
              title="No results"
              message={<>No results found for &ldquo;{searchQuery}&rdquo;</>}
            />
          )}
        </FacetList>
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
