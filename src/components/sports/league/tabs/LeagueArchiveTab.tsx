"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import React, { useState } from "react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { withBasePath } from "~/lib/base-path";
import { Trophy, Medal, Activity, Calendar } from "iconoir-react";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { Card } from "~/components/ui/card";

interface LeagueArchiveTabProps {
  leagueId: string;
  sportPreset?: string;
}

export function LeagueArchiveTab({ leagueId }: LeagueArchiveTabProps) {
  const { focusOrganization } = useSportsFocus();
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | null>(null);

  const { data: archive, isLoading: isArchiveLoading } = api.sports.getLeagueArchive.useQuery({
    leagueId,
  });

  const { data: records, isLoading: isRecordsLoading } = api.sports.getAllTimeRecords.useQuery({
    leagueId,
  });

  const completedSeasons = archive?.filter((s) => s.status === "completed") ?? [];

  // Default to the latest completed season if none selected
  const activeSeasonData =
    selectedSeasonNumber !== null
      ? archive?.find((s) => s.seasonNumber === selectedSeasonNumber)
      : (completedSeasons[0] ?? archive?.[0]);

  if (isArchiveLoading || isRecordsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="rounded-card h-44 w-full" />
        <Skeleton className="rounded-card h-64 w-full" />
      </div>
    );
  }

  if (!archive || archive.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Trophy />}
          title="No historical archive yet"
          message="Finish the active season to record its champion."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Roll of Honor & Trophy Cabinet */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="text-yellow size-5" aria-hidden />
            <h3 className="text-headline text-label">Roll of honor & trophy cabinet</h3>
          </div>
          <span className="text-footnote text-label-secondary tabular-nums">
            {completedSeasons.length} Completed{" "}
            {completedSeasons.length === 1 ? "Season" : "Seasons"}
          </span>
        </div>

        {completedSeasons.length > 0 ? (
          <RadioCardGroup
            aria-label="Season"
            value={activeSeasonData ? String(activeSeasonData.seasonNumber) : null}
            onValueChange={(v) => setSelectedSeasonNumber(Number(v))}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {completedSeasons.map((season) => {
              return (
                <RadioCard
                  key={season.seasonId}
                  value={String(season.seasonNumber)}
                  indicator={false}
                  className="group rounded-card flex-col items-stretch justify-between gap-0 overflow-hidden p-4"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="warning">Season {season.seasonNumber}</Badge>
                    <span className="text-footnote text-label-secondary tabular-nums">
                      {season.totalMatches} Matches · {season.totalGoals} Goals
                    </span>
                  </div>

                  {season.champion ? (
                    <div className="mt-4 flex items-center gap-3">
                      <div className="border-separator bg-surface-secondary rounded-row flex size-12 shrink-0 items-center justify-center overflow-hidden border p-1">
                        {season.champion.logo ? (
                          <img
                            src={withBasePath(season.champion.logo)}
                            alt={season.champion.teamName}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div
                            className="rounded-control text-footnote flex h-full w-full items-center justify-center font-semibold text-white"
                            style={{ backgroundColor: season.champion.color || "#3b82f6" }}
                          >
                            {season.champion.shortName ||
                              season.champion.teamName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-caption text-yellow">Champion</span>
                        <p className="text-headline text-label truncate group-hover:underline">
                          {season.champion.teamName}
                        </p>
                        {season.runnerUp && (
                          <p className="text-footnote text-label-secondary truncate">
                            Runner-up: {season.runnerUp.teamName}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-footnote text-label-secondary mt-4">
                      Season in progress
                    </div>
                  )}
                </RadioCard>
              );
            })}
          </RadioCardGroup>
        ) : (
          <Card padding="lg" className="text-footnote text-label-secondary text-center">
            No completed seasons yet. The title will be engraved here upon season finish.
          </Card>
        )}
      </section>

      {/* 2. Historical Standings Time-Travel */}
      {activeSeasonData && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="text-label-secondary size-5" aria-hidden />
              <h3 className="text-headline text-label">
                Season {activeSeasonData.seasonNumber} Final Standings
              </h3>
            </div>
            <span className="text-footnote text-tint font-medium">
              {activeSeasonData.status === "completed" ? "Final Result" : "Current Progress"}
            </span>
          </div>

          <Card padding="md" className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-3">Pos</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead className="text-center">P</TableHead>
                    <TableHead className="text-center">W</TableHead>
                    <TableHead className="text-center">D</TableHead>
                    <TableHead className="text-center">L</TableHead>
                    <TableHead className="text-right">GF</TableHead>
                    <TableHead className="text-right">GA</TableHead>
                    <TableHead className="pr-3 text-right">PTS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSeasonData.standings.map((row) => (
                    <TableRow
                      key={row.teamId}
                      onClick={() => focusOrganization(row.teamId)}
                      className="hover:bg-fill-4 cursor-pointer transition-colors"
                    >
                      <TableCell className="text-label-secondary pl-3">
                        {row.position === 1 ? (
                          <span className="bg-yellow/15 text-footnote text-yellow flex size-6 items-center justify-center rounded-full font-semibold">
                            1
                          </span>
                        ) : (
                          row.position
                        )}
                      </TableCell>
                      <TableCell className="text-label">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: row.color || "#3b82f6" }}
                          />
                          <span className="truncate">{row.teamName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-label-secondary text-center">
                        {row.played}
                      </TableCell>
                      <TableCell className="text-label text-center">{row.wins}</TableCell>
                      <TableCell className="text-label-secondary text-center">
                        {row.draws}
                      </TableCell>
                      <TableCell className="text-label-secondary text-center">
                        {row.losses}
                      </TableCell>
                      <TableCell className="text-label-secondary text-right">
                        {row.pointsFor}
                      </TableCell>
                      <TableCell className="text-label-secondary text-right">
                        {row.pointsAgainst}
                      </TableCell>
                      <TableCell className="text-label pr-3 text-right">{row.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </section>
      )}

      {/* 3. All-Time Record Book */}
      {records && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="text-label-secondary size-5" aria-hidden />
            <h3 className="text-headline text-label">All-Time Competition Records</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Top Champions Leaderboard */}
            <Card padding="md" className="space-y-3">
              <div className="border-separator flex items-center justify-between border-b pb-2">
                <h4 className="text-subhead text-label-secondary">Championship leaderboard</h4>
                <Trophy className="text-yellow size-4" aria-hidden />
              </div>

              {records.topChampions.length > 0 ? (
                <FacetListSection variant="plain" aria-label="Championship leaderboard">
                  {records.topChampions.map((team, idx) => (
                    <FacetRow
                      key={team.teamId}
                      onClick={() => focusOrganization(team.teamId)}
                      leading={
                        <span className="flex items-center gap-2">
                          <span className="text-footnote text-label-secondary font-semibold tabular-nums">
                            #{idx + 1}
                          </span>
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: team.color || "#3b82f6" }}
                          />
                        </span>
                      }
                      title={
                        <span className="text-footnote block truncate font-semibold">
                          {team.teamName}
                        </span>
                      }
                      trailing={
                        <Badge variant="warning" className="tabular-nums">
                          {team.titles} {team.titles === 1 ? "Title" : "Titles"}
                        </Badge>
                      }
                    />
                  ))}
                </FacetListSection>
              ) : (
                <p className="text-footnote text-label-secondary py-2">No champions crowned yet.</p>
              )}
            </Card>

            {/* Highest Scoring Match Fact Card */}
            <Card padding="md" className="flex flex-col justify-between">
              <div className="border-separator flex items-center justify-between border-b pb-2">
                <h4 className="text-subhead text-label-secondary">Highest-scoring fixture</h4>
                <Medal className="text-tint size-4" aria-hidden />
              </div>

              {records.highestScoringMatch ? (
                <div className="my-auto space-y-2 py-3 text-center">
                  <span className="text-caption text-tint">
                    Season {records.highestScoringMatch.seasonNumber} Record
                  </span>
                  <div className="text-title-1 text-label flex items-center justify-center gap-3 tabular-nums">
                    <span>{records.highestScoringMatch.homeName}</span>
                    <span className="text-tint">
                      {records.highestScoringMatch.homeScore} -{" "}
                      {records.highestScoringMatch.awayScore}
                    </span>
                    <span>{records.highestScoringMatch.awayName}</span>
                  </div>
                  <p className="text-footnote text-label-secondary tabular-nums">
                    {records.highestScoringMatch.totalGoals} Total Goals Scored
                  </p>
                </div>
              ) : (
                <p className="text-footnote text-label-secondary py-6 text-center">
                  Historical match records will emerge as seasons conclude.
                </p>
              )}

              <div className="border-separator text-footnote text-label-secondary border-t pt-2">
                Canonical archive verified by IxStates Sports Engine
              </div>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
