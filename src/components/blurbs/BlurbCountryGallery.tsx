"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";

/**
 * Shows all blurb responses for a specific country.
 * Renders as a card gallery with prompt context.
 */
export function BlurbCountryGallery({ countryId }: { countryId: string }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.blurbs.getResponsesForCountry.useInfiniteQuery(
      { countryId, limit: 12 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );

  const responses = data?.pages.flatMap((p) => p.responses) ?? [];

  if (isLoading) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        Loading blurbs...
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        No blurbs yet for this country.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {responses.map((r) => (
        <Link
          key={r.id}
          href={withBasePath(`/blurbs/${r.prompt.slug}`)}
          className="glass-hierarchy-child block rounded-xl border border-white/10 p-4 transition-colors hover:border-white/20"
        >
          <p className="text-xs font-medium text-zinc-500 mb-1">
            {r.prompt.title}
          </p>
          <p className="text-zinc-300 text-sm whitespace-pre-wrap line-clamp-4">
            {r.content}
          </p>
          {r.prompt.question && (
            <p className="text-zinc-600 text-xs mt-2 italic">
              &ldquo;{r.prompt.question}&rdquo;
            </p>
          )}
          <p className="text-zinc-600 text-xs mt-1">
            {new Date(r.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </Link>
      ))}

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
