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
  let colorClass = "text-label-secondary";

  if (w.includes("dry") || w.includes("sun")) {
    Icon = SunLight;
    colorClass = "text-yellow";
  } else if (w.includes("wet") || w.includes("rain")) {
    Icon = Rain;
    colorClass = "text-teal";
  } else if (w.includes("hot")) {
    Icon = Flame;
    colorClass = "text-red";
  }

  return (
    <span className={cn("text-eyebrow inline-flex items-center gap-1", colorClass)}>
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
    <FacetCard padding="lg" className="space-y-4 overflow-hidden">
      <div className="border-separator flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-row border-separator bg-surface-secondary shadow-card flex h-8 w-8 items-center justify-center border">
            <Zap className="text-yellow h-4 w-4" />
          </div>
          <h4 className="text-headline text-label">Driver World Championship Standings</h4>
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
                  <span className="decoration-border/60 cursor-help font-semibold underline decoration-dotted">
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
            <TableRow key={d.driverId} className="transition-transform active:scale-[0.99]">
              <TableCell className="font-semibold">
                {i === 0 ? (
                  <Badge className="border-yellow/40 bg-yellow/20 text-footnote text-yellow px-1.5 py-0 font-semibold">
                    P1
                  </Badge>
                ) : (
                  `P${i + 1}`
                )}
              </TableCell>
              <TableCell className="text-label font-medium">{d.driverName}</TableCell>
              <TableCell className="text-label text-center font-semibold">{d.points}</TableCell>
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
          <FacetCard key={race.id} className="relative space-y-6 overflow-hidden p-6 md:p-8">
            <div className="border-separator flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-row border-separator bg-surface-secondary shadow-card flex h-9 w-9 items-center justify-center border">
                  <MapPin className="text-teal h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-headline text-label">
                    Round {race.raceNumber}: {race.circuitName}
                  </h3>
                  <p className="text-footnote text-label-secondary font-semibold">
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
                  className="text-eyebrow"
                >
                  {race.status === "qualifying_complete" ? "Qualifying Complete" : race.status}
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <CircuitMap circuitName={race.circuitName} className="mb-4" />

              {race.grid && race.grid.length > 0 && (
                <div className="rounded-card border-separator bg-surface-secondary border p-4">
                  <h4 className="text-label-secondary text-eyebrow mb-3 flex items-center gap-2">
                    <Flag className="text-label h-3.5 w-3.5" />
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
                            <TableCell className="text-label-secondary font-semibold">
                              P{g.position}
                            </TableCell>
                            <TableCell className="text-label font-medium">
                              {g.driverName ?? g.driverId}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {race.results && race.results.length > 0 && (
                <div className="rounded-card border-separator bg-surface-secondary border p-4">
                  <h4 className="text-label-secondary text-eyebrow mb-3 flex items-center gap-2">
                    <Clock className="text-yellow h-3.5 w-3.5" />
                    Official Grand Prix Classification
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Pos</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead className="w-24 text-center">Points</TableHead>
                        <TableHead className="text-right">Honors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {race.results
                        .sort((a, b) => a.finishPosition - b.finishPosition)
                        .map((r) => (
                          <TableRow key={r.driverId}>
                            <TableCell className="font-semibold">
                              {r.finishPosition === 1 ? (
                                <Badge className="border-yellow/40 bg-yellow/20 text-footnote text-yellow px-2 py-0 font-semibold">
                                  P1
                                </Badge>
                              ) : (
                                `P${r.finishPosition}`
                              )}
                            </TableCell>
                            <TableCell className="text-label font-medium">
                              {r.driverName ?? r.driverId}
                            </TableCell>
                            <TableCell className="text-label text-center font-semibold">
                              {r.points}
                            </TableCell>
                            <TableCell className="text-right">
                              {r.fastestLap && (
                                <Badge
                                  variant="outline"
                                  className="border-indigo/30 bg-indigo/10 text-indigo text-footnote font-semibold"
                                >
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
