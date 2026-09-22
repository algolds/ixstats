"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import {
  Clock,
  Cloud,
  WhiteFlag as Flag,
  MapPin,
  Flash as Zap,
  SunLight,
  Rain,
  FireFlame as Flame,
  Trophy,
} from "iconoir-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { CircuitMap } from "~/components/sports/surfaces";
import { FacetCard } from "~/components/ui/facet-container";

interface RaceResultsProps {
  races: Array<{
    id: string;
    raceNumber: number;
    circuitName: string;
    status: string;
    grid?: Array<{
      driverId: string;
      driverName?: string;
      position: number;
    }>;
    results?: Array<{
      driverId: string;
      driverName?: string;
      finishPosition: number;
      points: number;
      fastestLap?: boolean;
    }>;
    weather?: string;
  }>;
  className?: string;
}

function WeatherBadge({ weather }: { weather: string }) {
  const w = weather.toLowerCase();
  let Icon = Cloud;
  let colorClass = "text-muted-foreground";

  if (w.includes("dry") || w.includes("sun")) {
    Icon = SunLight;
    colorClass = "text-amber-400";
  } else if (w.includes("wet") || w.includes("rain")) {
    Icon = Rain;
    colorClass = "text-cyan-400";
  } else if (w.includes("hot")) {
    Icon = Flame;
    colorClass = "text-red-400";
  }

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-bold uppercase", colorClass)}>
      <Icon className="h-3.5 w-3.5" />
      <span>{weather}</span>
    </span>
  );
}

function DriverStandingsTable({ races }: { races: RaceResultsProps["races"] }) {
  const driverTotals = new Map<string, { driverName: string; points: number }>();

  for (const race of races) {
    if (race.status !== "completed" || !race.results) continue;
    for (const r of race.results) {
      const existing = driverTotals.get(r.driverId);
      if (existing) {
        existing.points += r.points;
      } else {
        driverTotals.set(r.driverId, {
          driverName: r.driverName ?? r.driverId,
          points: r.points,
        });
      }
    }
  }

  const sorted = Array.from(driverTotals.entries())
    .map(([driverId, data]) => ({ driverId, ...data }))
    .sort((a, b) => b.points - a.points);

  if (sorted.length === 0) return null;

  return (
    <FacetCard depth={2} className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/75 p-6 shadow-xl backdrop-blur-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-border/20 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/50 bg-background/60 shadow-xs">
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <h4 className="text-sm font-black uppercase tracking-wider text-foreground">
            Driver World Championship Standings
          </h4>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="decoration-border/60 cursor-help underline decoration-dotted">
                    #
                  </span>
                </TooltipTrigger>
                <TooltipContent>Rank / Position</TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead>Driver</TableHead>
            <TableHead className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="decoration-border/60 cursor-help font-bold underline decoration-dotted">
                    Pts
                  </span>
                </TooltipTrigger>
                <TooltipContent>Championship Points</TooltipContent>
              </Tooltip>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((d, i) => (
            <TableRow key={d.driverId} className="active:scale-[0.99] transition-transform">
              <TableCell className="font-bold">
                {i === 0 ? (
                  <Badge className="border-amber-500/40 bg-amber-500/20 px-1.5 py-0 text-xs font-black text-amber-400">
                    P1
                  </Badge>
                ) : (
                  `P${i + 1}`
                )}
              </TableCell>
              <TableCell className="font-medium text-foreground">{d.driverName}</TableCell>
              <TableCell className="text-center font-bold text-foreground">{d.points}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </FacetCard>
  );
}

export function RaceResults({ races, className }: RaceResultsProps) {
  if (!races || races.length === 0) {
    return null;
  }

  const sortedRaces = [...races].sort((a, b) => a.raceNumber - b.raceNumber);

  return (
    <div className={cn("space-y-6", className)}>
      <DriverStandingsTable races={races} />

      <div className="space-y-6">
        {sortedRaces.map((race) => (
          <FacetCard
            key={race.id}
            depth={2}
            className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/75 p-6 shadow-xl backdrop-blur-2xl md:p-8 space-y-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-background/60 shadow-xs">
                  <MapPin className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-foreground">
                    Round {race.raceNumber}: {race.circuitName}
                  </h3>
                  <p className="text-xs font-semibold text-muted-foreground">
                    Grand Prix venue layout and official session timing.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {race.weather && <WeatherBadge weather={race.weather} />}
                <Badge
                  variant={
                    race.status === "completed"
                      ? "secondary"
                      : race.status === "upcoming"
                        ? "outline"
                        : "default"
                  }
                  className="text-xs font-bold uppercase"
                >
                  {race.status === "qualifying_complete" ? "Qualifying Complete" : race.status}
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <CircuitMap circuitName={race.circuitName} className="mb-4" />

              {race.grid && race.grid.length > 0 && (
                <div className="rounded-2xl border border-border/30 bg-background/50 p-4">
                  <h4 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                    <Flag className="h-3.5 w-3.5 text-foreground" />
                    Starting Grid Positions
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Pos</TableHead>
                        <TableHead>Driver</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {race.grid
                        .sort((a, b) => a.position - b.position)
                        .map((g) => (
                          <TableRow key={g.driverId}>
                            <TableCell className="font-bold text-muted-foreground">P{g.position}</TableCell>
                            <TableCell className="font-medium text-foreground">{g.driverName ?? g.driverId}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {race.results && race.results.length > 0 && (
                <div className="rounded-2xl border border-border/30 bg-background/50 p-4">
                  <h4 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    Official Grand Prix Classification
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Pos</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead className="text-center w-24">Points</TableHead>
                        <TableHead className="text-right">Honors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {race.results
                        .sort((a, b) => a.finishPosition - b.finishPosition)
                        .map((r) => (
                          <TableRow key={r.driverId}>
                            <TableCell className="font-bold">
                              {r.finishPosition === 1 ? (
                                <Badge className="border-amber-500/40 bg-amber-500/20 px-2 py-0 text-xs font-black text-amber-400">
                                  P1
                                </Badge>
                              ) : (
                                `P${r.finishPosition}`
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">{r.driverName ?? r.driverId}</TableCell>
                            <TableCell className="text-center font-bold text-foreground">{r.points}</TableCell>
                            <TableCell className="text-right">
                              {r.fastestLap && (
                                <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-bold">
                                  Fastest Lap
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </FacetCard>
        ))}
      </div>
    </div>
  );
}

export default RaceResults;
