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
        <div className="text-body text-label-secondary py-12 text-center">Loading prompts...</div>
      )}

      {!isLoading && prompts.length === 0 && (
        <div className="text-body text-label-secondary py-12 text-center">
          No active prompts yet. Check back soon!
        </div>
      )}

      <div className="grid gap-3">
        {prompts.map((prompt) => (
          <Link
            key={prompt.id}
            href={withBasePath(`/blurbs/${prompt.slug}`)}
            className="bg-surface rounded-card border-separator hover:border-separator-opaque block border p-4 transition-colors sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-headline text-label truncate">{prompt.title}</h3>
                <p className="text-body text-label-secondary mt-1 line-clamp-2">
                  {prompt.question}
                </p>
              </div>
              <Badge variant="neutral" className="shrink-0 tabular-nums">
                {prompt._count.responses} {prompt._count.responses === 1 ? "response" : "responses"}
              </Badge>
            </div>
            {prompt.publishedAt && (
              <p className="text-footnote text-label-secondary mt-2">
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
