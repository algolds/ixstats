"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

/**
 * Lists all active blurb prompts with response counts.
 * Used on the /blurbs page.
 */
export function BlurbPromptList() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.blurbs.getActivePrompts.useInfiniteQuery(
      { limit: 12 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );

  const prompts = data?.pages.flatMap((p) => p.prompts) ?? [];

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="py-12 text-center text-sm text-[var(--wikios-text-dim)]">
          Loading prompts...
        </div>
      )}

      {!isLoading && prompts.length === 0 && (
        <div className="py-12 text-center text-sm text-[var(--wikios-text-dim)]">
          No active prompts yet. Check back soon!
        </div>
      )}

      <div className="grid gap-3">
        {prompts.map((prompt) => (
          <Link
            key={prompt.id}
            href={withBasePath(`/blurbs/${prompt.slug}`)}
            className="facet-hierarchy-child block rounded-xl border border-white/10 p-4 transition-colors hover:border-white/20 sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-[var(--wikios-text)] sm:text-base">
                  {prompt.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-[var(--wikios-text-muted)]">
                  {prompt.question}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs">
                {prompt._count.responses} {prompt._count.responses === 1 ? "response" : "responses"}
              </Badge>
            </div>
            {prompt.publishedAt && (
              <p className="mt-2 text-xs text-[var(--wikios-text-dim)]">
                {new Date(prompt.publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </Link>
        ))}
      </div>

      {hasNextPage && (
        <div className="pt-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
