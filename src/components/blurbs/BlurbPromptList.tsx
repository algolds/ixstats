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
        <div className="text-center py-12 text-zinc-500 text-sm">
          Loading prompts...
        </div>
      )}

      {!isLoading && prompts.length === 0 && (
        <div className="text-center py-12 text-zinc-500 text-sm">
          No active prompts yet. Check back soon!
        </div>
      )}

      <div className="grid gap-3">
        {prompts.map((prompt) => (
          <Link
            key={prompt.id}
            href={withBasePath(`/blurbs/${prompt.slug}`)}
            className="glass-hierarchy-child block rounded-xl border border-white/10 p-4 sm:p-5 transition-colors hover:border-white/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-zinc-100 text-sm sm:text-base truncate">
                  {prompt.title}
                </h3>
                <p className="text-zinc-400 text-sm mt-1 line-clamp-2">
                  {prompt.question}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs">
                {prompt._count.responses}{" "}
                {prompt._count.responses === 1 ? "response" : "responses"}
              </Badge>
            </div>
            {prompt.publishedAt && (
              <p className="text-zinc-600 text-xs mt-2">
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
        <div className="text-center pt-2">
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
