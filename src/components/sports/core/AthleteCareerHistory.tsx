"use client";

import React from "react";
import { Trophy } from "iconoir-react";
import { api } from "~/trpc/react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";

/** Compact season-by-season career log shown in the athlete focus view (plan 321 Step 3). */
export function AthleteCareerHistory({ athleteId }: { athleteId: string }) {
  const { data, isLoading } = api.sports.getAthleteCareerHistory.useQuery({ athleteId });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;

  const seasons = data?.seasons ?? [];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Eyebrow>Career</Eyebrow>
        {data && seasons.length > 0 && (
          <span className="text-muted-foreground text-xs font-semibold tabular-nums">
            {data.totals.goals} goals · {data.totals.assists} assists
          </span>
        )}
      </div>

      {seasons.length === 0 ? (
        <p className="text-muted-foreground text-xs">No recorded seasons yet.</p>
      ) : (
        <div className="border-border/30 overflow-hidden rounded-xl border">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Season</th>
                <th
                  className="px-2 py-1.5 text-right font-medium"
                  title="Matches with a shot, goal or assist"
                >
                  Matches
                </th>
                <th className="px-2 py-1.5 text-right font-medium">Goals</th>
                <th className="px-3 py-1.5 text-right font-medium">Assists</th>
              </tr>
            </thead>
            <tbody className="divide-border/20 divide-y">
              {seasons.map((season) => (
                <tr key={season.seasonId}>
                  <td className="text-foreground px-3 py-1.5 font-semibold">
                    Season {season.seasonNumber}
                    {season.awards.map((award) => (
                      <span
                        key={award}
                        className="text-muted-foreground flex items-center gap-1 font-medium"
                      >
                        <Trophy className="h-3 w-3" />
                        {award}
                      </span>
                    ))}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{season.matches}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{season.goals}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{season.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
