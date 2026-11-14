"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import React from "react";
import { Trophy } from "iconoir-react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";

/** Compact season-by-season career log shown in the athlete focus view (plan 321 Step 3). */
export function AthleteCareerHistory({ athleteId }: { athleteId: string }) {
  const { data, isLoading } = api.sports.getAthleteCareerHistory.useQuery({ athleteId });

  if (isLoading) return <Skeleton className="rounded-card h-24 w-full" />;

  const seasons = data?.seasons ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-headline text-label">Career</h4>
        {data && seasons.length > 0 && (
          <span className="text-label-secondary text-footnote tabular-nums">
            {data.totals.goals} goals · {data.totals.assists} assists
          </span>
        )}
      </div>

      {seasons.length === 0 ? (
        <p className="text-label-secondary text-footnote">No recorded seasons yet.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Season</TableHead>
                <TableHead className="text-right" title="Matches with a shot, goal or assist">
                  Matches
                </TableHead>
                <TableHead className="text-right">Goals</TableHead>
                <TableHead className="text-right">Assists</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasons.map((season) => (
                <TableRow key={season.seasonId}>
                  <TableCell className="text-label">
                    Season {season.seasonNumber}
                    {season.awards.map((award) => (
                      <span
                        key={award}
                        className="text-label-secondary flex items-center gap-1 font-medium"
                      >
                        <Trophy className="h-3 w-3" />
                        {award}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell className="text-right">{season.matches}</TableCell>
                  <TableCell className="text-right">{season.goals}</TableCell>
                  <TableCell className="text-right">{season.assists}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
