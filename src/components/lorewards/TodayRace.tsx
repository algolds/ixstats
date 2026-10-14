"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { LorewardsSection } from "./LorewardsSection";
import { wikiPageHref, wikiUserHref } from "./format";

/** The top ten of today's UTC race, scored live by the WikiOS engine. */
export function TodayRace() {
  const { data, isLoading, isError } = api.lorewards.getTodayRace.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  return (
    <LorewardsSection
      title="Today's race"
      content="feed"
      action={
        data && (
          <span className="text-label-secondary text-footnote tabular-nums">
            {data.date} UTC, {data.editCount.toLocaleString()} edits scored
          </span>
        )
      }
    >
      {isLoading && <Skeleton className="h-32" />}
      {isError && (
        <p className="text-label-secondary text-callout">Today's race is unavailable right now.</p>
      )}
      {data && data.entries.length === 0 && (
        <p className="text-label-secondary text-callout">No scoring edits yet today.</p>
      )}
      {data && data.entries.length > 0 && (
        <ol className="divide-separator divide-y">
          {data.entries.map((entry) => (
            <li key={entry.user} className="flex items-center gap-3 py-2">
              <span className="text-label-secondary w-6 shrink-0 text-right tabular-nums">
                {entry.rank}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={wikiPageHref(entry.page)}
                  className="text-label text-headline block truncate hover:underline"
                >
                  {entry.page}
                </Link>
                <Link
                  href={wikiUserHref(entry.user)}
                  className="text-label-secondary text-footnote hover:underline"
                >
                  {entry.user}
                </Link>
              </div>
              <span className="text-success-ink text-footnote shrink-0 font-medium tabular-nums">
                {entry.score.toLocaleString()} pts
              </span>
            </li>
          ))}
        </ol>
      )}
    </LorewardsSection>
  );
}
