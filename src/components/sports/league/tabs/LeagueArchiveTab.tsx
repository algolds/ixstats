"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { Trophy, Sparks as Sparkles, Activity, Shield, Calendar } from "iconoir-react";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";

export interface LeagueArchiveTabProps {
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
      : completedSeasons[0] ?? archive?.[0];

  if (isArchiveLoading || isRecordsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-44 w-full animate-pulse rounded-3xl bg-muted/20" />
        <div className="h-64 w-full animate-pulse rounded-3xl bg-muted/20" />
      </div>
    );
  }

  if (!archive || archive.length === 0) {
    return (
      <FacetCard depth={2} className="rounded-3xl border border-border/40 bg-card/60 p-12 text-center backdrop-blur-xl">
        <Trophy className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h3 className="mt-3 text-lg font-bold text-foreground">No Historical Archive Yet</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Complete the active season to crown a champion and begin the historical roll-of-honor.
        </p>
      </FacetCard>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Roll of Honor & Trophy Cabinet */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold text-foreground">Roll of Honor & Trophy Cabinet</h3>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {completedSeasons.length} Completed {completedSeasons.length === 1 ? "Season" : "Seasons"}
          </span>
        </div>

        {completedSeasons.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completedSeasons.map((season) => {
              const isSelected = activeSeasonData?.seasonNumber === season.seasonNumber;
              return (
                <button
                  key={season.seasonId}
                  onClick={() => setSelectedSeasonNumber(season.seasonNumber)}
                  className={cn(
                    "group facet-hierarchy-child relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98]",
                    isSelected
                      ? "border-amber-500/50 bg-amber-500/10 shadow-md"
                      : "border-border/40 bg-card/60 hover:border-border hover:bg-muted/30"
                  )}
                  data-cuelume-press="subtle"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-amber-400">
                      Season {season.seasonNumber}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {season.totalMatches} Matches · {season.totalGoals} Goals
                    </span>
                  </div>

                  {season.champion ? (
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40 p-1 shadow-md">
                        {season.champion.logo ? (
                          <img
                            src={withBasePath(season.champion.logo)}
                            alt={season.champion.teamName}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center rounded-lg text-xs font-bold text-white"
                            style={{ backgroundColor: season.champion.color || "#3b82f6" }}
                          >
                            {season.champion.shortName || season.champion.teamName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Champion
                        </span>
                        <p className="truncate text-sm font-extrabold text-foreground group-hover:underline">
                          {season.champion.teamName}
                        </p>
                        {season.runnerUp && (
                          <p className="truncate text-[10px] text-muted-foreground">
                            Runner-up: {season.runnerUp.teamName}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 text-xs italic text-muted-foreground">Season in progress</div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/30 bg-card/40 p-6 text-center text-xs text-muted-foreground">
            No completed seasons yet. The title will be engraved here upon season finish.
          </div>
        )}
      </section>

      {/* 2. Historical Standings Time-Travel */}
      {activeSeasonData && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-cyan-400" />
              <h3 className="text-base font-bold text-foreground">
                Season {activeSeasonData.seasonNumber} Final Standings
              </h3>
            </div>
            <span className="text-xs font-bold text-cyan-400">
              {activeSeasonData.status === "completed" ? "Final Result" : "Current Progress"}
            </span>
          </div>

          <FacetCard depth={2} className="overflow-hidden rounded-3xl border border-border/40 bg-card/90 p-4 shadow-xl backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pl-3">Pos</th>
                    <th className="py-2.5">Club</th>
                    <th className="py-2.5 text-center">P</th>
                    <th className="py-2.5 text-center">W</th>
                    <th className="py-2.5 text-center">D</th>
                    <th className="py-2.5 text-center">L</th>
                    <th className="py-2.5 text-right">GF</th>
                    <th className="py-2.5 text-right">GA</th>
                    <th className="py-2.5 text-right pr-3">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {activeSeasonData.standings.map((row) => (
                    <tr
                      key={row.teamId}
                      onClick={() => focusOrganization(row.teamId)}
                      className="cursor-pointer transition-colors hover:bg-muted/30 active:scale-[0.99]"
                      data-cuelume-press="subtle"
                    >
                      <td className="py-3 pl-3 font-mono font-bold text-muted-foreground">
                        {row.position === 1 ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-black text-amber-400">
                            1
                          </span>
                        ) : (
                          row.position
                        )}
                      </td>
                      <td className="py-3 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: row.color || "#3b82f6" }}
                          />
                          <span className="truncate">{row.teamName}</span>
                        </div>
                      </td>
                      <td className="py-3 text-center font-mono tabular-nums text-muted-foreground">{row.played}</td>
                      <td className="py-3 text-center font-mono tabular-nums text-foreground">{row.wins}</td>
                      <td className="py-3 text-center font-mono tabular-nums text-muted-foreground">{row.draws}</td>
                      <td className="py-3 text-center font-mono tabular-nums text-muted-foreground">{row.losses}</td>
                      <td className="py-3 text-right font-mono tabular-nums text-muted-foreground">{row.pointsFor}</td>
                      <td className="py-3 text-right font-mono tabular-nums text-muted-foreground">{row.pointsAgainst}</td>
                      <td className="py-3 pr-3 text-right font-mono text-sm font-black text-foreground tabular-nums">
                        {row.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FacetCard>
        </section>
      )}

      {/* 3. All-Time Record Book */}
      {records && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-foreground">All-Time Competition Records</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Top Champions Leaderboard */}
            <div className="facet-hierarchy-child space-y-3 rounded-2xl border border-border/40 bg-card/60 p-4 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-border/20 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Championship Leaderboard
                </span>
                <Trophy className="h-4 w-4 text-amber-400" />
              </div>

              {records.topChampions.length > 0 ? (
                <div className="space-y-2">
                  {records.topChampions.map((team, idx) => (
                    <div
                      key={team.teamId}
                      onClick={() => focusOrganization(team.teamId)}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-border/20 bg-muted/20 p-2.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs font-bold text-muted-foreground">
                          #{idx + 1}
                        </span>
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: team.color || "#3b82f6" }}
                        />
                        <span className="truncate text-xs font-bold text-foreground">
                          {team.teamName}
                        </span>
                      </div>
                      <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-black text-amber-400">
                        {team.titles} {team.titles === 1 ? "Title" : "Titles"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground py-2">No champions crowned yet.</p>
              )}
            </div>

            {/* Highest Scoring Match Fact Card */}
            <div className="facet-hierarchy-child flex flex-col justify-between rounded-2xl border border-border/40 bg-card/60 p-4 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-border/20 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Highest-Scoring Fixture
                </span>
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </div>

              {records.highestScoringMatch ? (
                <div className="my-auto space-y-2 py-3 text-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                    Season {records.highestScoringMatch.seasonNumber} Record
                  </span>
                  <div className="flex items-center justify-center gap-3 font-mono text-2xl font-black text-foreground">
                    <span>{records.highestScoringMatch.homeName}</span>
                    <span className="text-cyan-400">{records.highestScoringMatch.homeScore} - {records.highestScoringMatch.awayScore}</span>
                    <span>{records.highestScoringMatch.awayName}</span>
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {records.highestScoringMatch.totalGoals} Total Goals Scored
                  </p>
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground py-6 text-center">
                  Historical match records will emerge as seasons conclude.
                </p>
              )}

              <div className="border-t border-border/20 pt-2 text-[10px] font-semibold text-muted-foreground">
                Canonical archive verified by IxStates Sports Engine
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
