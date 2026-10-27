"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { LorewardsSection } from "./LorewardsSection";
import { wikiUserHref } from "./format";

/** The all-time standings by total Loreward score. */
export function Standings() {
  const { data, isLoading, isError } = api.lorewards.getStandings.useQuery({ limit: 10 });

  return (
    <LorewardsSection title="Standings">
      {isLoading && <Skeleton className="h-40" />}
      {isError && (
        <p className="text-label-secondary text-callout">
          The standings are unavailable right now.
        </p>
      )}
      {data && data.length === 0 && (
        <p className="text-label-secondary text-callout">Nobody has scored yet.</p>
      )}
      {data && data.length > 0 && (
        <ol className="divide-separator divide-y">
          {data.map((player) => (
            <li key={player.username} className="flex items-center gap-3 py-2">
              <span className="text-label-secondary w-6 shrink-0 text-right tabular-nums">
                {player.rank}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={wikiUserHref(player.username)}
                  className="text-label text-headline block truncate hover:underline"
                >
                  {player.username}
                </Link>
                <span className="text-label-secondary text-footnote tabular-nums">
                  {player.dailyWins} daily, {player.weeklyWins} weekly, {player.monthlyWins} monthly
                  {player.currentStreak > 0 && `, ${player.currentStreak} day streak`}
                </span>
              </div>
              <span className="text-label text-footnote shrink-0 font-medium tabular-nums">
                {player.totalScore.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </LorewardsSection>
  );
}
