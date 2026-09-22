"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { getSportTheme } from "~/lib/sports/theming";
import { getPlayerPhotoUrl } from "~/lib/sports/photos";
import { PositionTooltip } from "~/components/sports/PositionTooltip";
import { User, Activity, Trophy, Calendar, Star, Shield } from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import Link from "next/link";
import { cn } from "~/lib/utils";

export interface AthleteDetailSheetProps {
  athleteId: string | null;
  isOpen: boolean;
  onClose: () => void;
  sportPreset?: string;
}

export function AthleteDetailSheet({
  athleteId,
  isOpen,
  onClose,
  sportPreset,
}: AthleteDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "career">("profile");

  const { data: athlete, isLoading } = api.sports.getPlayer.useQuery(
    { id: athleteId ?? "" },
    { enabled: !!athleteId && isOpen }
  );

  const { data: valuationData } = api.sports.getPlayerValuation.useQuery(
    { playerId: athleteId ?? "" },
    { enabled: !!athleteId && isOpen }
  );

  const { data: careerData } = api.sports.getAthleteCareerHistory.useQuery(
    { athleteId: athleteId ?? "" },
    { enabled: !!athleteId && isOpen }
  );

  const sportTheme = getSportTheme(sportPreset || athlete?.team?.league?.sportPreset);
  const ratings = (athlete?.ratings as Record<string, number> | null) ?? {};
  const overall = ratings.overall ?? 50;

  // Filter out meta keys to display specific sport skills
  const attributeKeys = Object.keys(ratings).filter(
    (k) => !["overall", "wins", "losses", "draws", "form", "morale"].includes(k)
  );

  const playerPhoto = athlete ? getPlayerPhotoUrl(athlete) : null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md border-border/40 bg-card/95 backdrop-blur-2xl p-6 overflow-y-auto"
      >
        {isLoading ? (
          <div className="space-y-6 pt-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-2xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-3/4 rounded-lg" />
                <Skeleton className="h-4 w-1/2 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        ) : !athlete ? (
          <div className="py-12 text-center text-muted-foreground">
            <User className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-semibold">Athlete not found</p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Header: Photo & Identity */}
            <div className="flex items-start gap-4">
              <div
                className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/50 shadow-md"
                style={{
                  backgroundColor: athlete.team?.color ? `${athlete.team.color}25` : "rgba(255,255,255,0.05)",
                }}
              >
                {playerPhoto ? (
                  <img
                    src={playerPhoto}
                    alt={`${athlete.firstName} ${athlete.lastName}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-muted-foreground/50" />
                )}
                {athlete.number && (
                  <span className="absolute bottom-1 right-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-black text-white backdrop-blur-sm">
                    #{athlete.number}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <PositionTooltip position={athlete.position}>
                    <Badge variant="outline" className="px-2 py-0.5 text-xs font-bold">
                      {athlete.position}
                    </Badge>
                  </PositionTooltip>
                  {athlete.careerStage && (
                    <Badge
                      variant="outline"
                      className="border-border/60 text-xs font-bold uppercase tracking-wider capitalize"
                    >
                      {athlete.careerStage}
                    </Badge>
                  )}
                </div>

                <SheetTitle className="text-foreground mt-1.5 text-xl font-extrabold tracking-tight truncate">
                  {athlete.firstName} {athlete.lastName}
                </SheetTitle>

                {athlete.team && (
                  <Link
                    href={withBasePath(`/myclub/${athlete.team.id}`)}
                    className="text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 text-xs font-semibold hover:underline"
                  >
                    <span
                      className="h-2 w-2 rounded-full inline-block"
                      style={{ backgroundColor: athlete.team.color || "#3b82f6" }}
                    />
                    <span className="truncate">{athlete.team.name}</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Segmented Navigation: Profile vs Career History */}
            <div className="flex gap-2 border-b border-border/20 pb-2">
              <button
                onClick={() => setActiveTab("profile")}
                className={cn(
                  "cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition-colors",
                  activeTab === "profile"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Profile & Ratings
              </button>
              <button
                onClick={() => setActiveTab("career")}
                className={cn(
                  "cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition-colors",
                  activeTab === "career"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Career History
              </button>
            </div>

            {activeTab === "profile" && (
              <div className="space-y-4">
                {/* Overall Rating & Key Stats HUD */}
                <div className="facet-hierarchy-child grid grid-cols-3 gap-3 rounded-2xl border border-border/40 bg-muted/20 p-3.5 backdrop-blur-md text-center">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Overall
                    </span>
                    <p className="mt-0.5 text-2xl font-black text-foreground">{overall}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Age
                    </span>
                    <p className="mt-0.5 text-2xl font-black text-foreground">{athlete.age ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Valuation
                    </span>
                    <p className="mt-0.5 text-lg font-black text-emerald-400">
                      {valuationData?.valuation ? `${valuationData.valuation}c` : "—"}
                    </p>
                  </div>
                </div>

                {/* Rating Attributes Breakdown */}
                {attributeKeys.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-cyan-400" />
                      Attribute Ratings
                    </h4>
                    <div className="facet-hierarchy-child space-y-2.5 rounded-2xl border border-border/40 bg-card/60 p-4 backdrop-blur-md">
                      {attributeKeys.map((key) => {
                        const val = ratings[key] ?? 50;
                        const pct = Math.min(100, Math.max(0, val));
                        return (
                          <div key={key} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="capitalize text-muted-foreground">{key}</span>
                              <span className="font-bold text-foreground">{val}</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor:
                                    val >= 80 ? "rgb(34, 197, 94)" : val >= 65 ? "rgb(59, 130, 246)" : "rgb(234, 179, 8)",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Contract & Lore Details */}
                <div className="facet-hierarchy-child rounded-2xl border border-border/40 bg-card/60 p-4 backdrop-blur-md space-y-2 text-xs font-semibold">
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Contract Remaining</span>
                    <span className="font-bold text-foreground">
                      {(ratings.contractYears as number | undefined) ?? 1} Years
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Annual Wage</span>
                    <span className="font-bold text-foreground">
                      {(ratings.salary as number | undefined)
                        ? `${ratings.salary}c`
                        : valuationData?.valuation
                          ? `${Math.round(valuationData.valuation * 0.1)}c`
                          : "Standard"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-bold text-emerald-400">Active Roster</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "career" && (
              <div className="space-y-4">
                {/* Career Totals Card */}
                {careerData && (
                  <div className="facet-hierarchy-child grid grid-cols-4 gap-2 rounded-2xl border border-border/40 bg-card/60 p-3.5 text-center backdrop-blur-md">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Matches</span>
                      <p className="mt-0.5 text-lg font-black text-foreground">{careerData.careerTotals.appearances}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Goals</span>
                      <p className="mt-0.5 text-lg font-black text-emerald-400">{careerData.careerTotals.goals}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assists</span>
                      <p className="mt-0.5 text-lg font-black text-cyan-400">{careerData.careerTotals.assists}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Shots</span>
                      <p className="mt-0.5 text-lg font-black text-foreground">{careerData.careerTotals.shots}</p>
                    </div>
                  </div>
                )}

                {/* Season-by-Season Breakdown Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-amber-400" />
                    Season-by-Season Log
                  </h4>

                  {careerData && careerData.careerLog.length > 0 ? (
                    <div className="facet-hierarchy-child overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border/20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            <th className="py-2.5 pl-3">Season</th>
                            <th className="py-2.5">Club</th>
                            <th className="py-2.5 text-center">App</th>
                            <th className="py-2.5 text-right">G</th>
                            <th className="py-2.5 text-right pr-3">A</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                          {careerData.careerLog.map((log) => (
                            <tr key={log.seasonId} className="hover:bg-muted/20">
                              <td className="py-2.5 pl-3 font-mono font-bold text-muted-foreground">
                                S{log.seasonNumber}
                              </td>
                              <td className="py-2.5 font-bold text-foreground">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: log.teamColor }}
                                  />
                                  <span className="truncate">{log.teamName}</span>
                                </div>
                              </td>
                              <td className="py-2.5 text-center font-mono tabular-nums text-muted-foreground">
                                {log.appearances}
                              </td>
                              <td className="py-2.5 text-right font-mono font-bold text-emerald-400 tabular-nums">
                                {log.goals}
                              </td>
                              <td className="py-2.5 pr-3 text-right font-mono font-bold text-cyan-400 tabular-nums">
                                {log.assists}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground py-4 text-center">
                      No past season match logs recorded for this athlete yet.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
