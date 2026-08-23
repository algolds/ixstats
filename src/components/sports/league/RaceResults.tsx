"use client";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { Clock, Cloud, WhiteFlag as Flag, MapPin, Flash as Zap } from "iconoir-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

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

const WEATHER_ICONS: Record<string, string> = {
  dry: "\u2600\uFE0F",
  wet: "\uD83C\uDF27\uFE0F",
  mixed: "\u26C5",
  hot: "\uD83E\uDD75",
};

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
    <Card className="facet-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Driver Standings
        </CardTitle>
      </CardHeader>
      <CardContent>
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
                  <TooltipContent>Points</TooltipContent>
                </Tooltip>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((d, i) => (
              <TableRow key={d.driverId}>
                <TableCell className="font-medium">{i + 1}</TableCell>
                <TableCell>{d.driverName}</TableCell>
                <TableCell className="text-center font-bold">{d.points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function RaceResults({ races, className }: RaceResultsProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <DriverStandingsTable races={races} />

      {races.map((race) => (
        <Card key={race.id} className="facet-hierarchy-child">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <span className="text-muted-foreground text-sm font-normal">
                  Round {race.raceNumber}
                </span>
                {race.circuitName}
              </CardTitle>
              <Badge
                variant={
                  race.status === "completed"
                    ? "secondary"
                    : race.status === "upcoming"
                      ? "outline"
                      : "default"
                }
              >
                {race.status === "qualifying_complete" ? "Qualifying Complete" : race.status}
              </Badge>
              {race.weather && (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Cloud className="h-3.5 w-3.5" />
                  {WEATHER_ICONS[race.weather] ? (
                    <>
                      {WEATHER_ICONS[race.weather]} {race.weather}
                    </>
                  ) : (
                    race.weather
                  )}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {race.grid && race.grid.length > 0 && (
                <div>
                  <h4 className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-semibold">
                    <Flag className="h-3.5 w-3.5" />
                    Grid
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="decoration-border/60 cursor-help underline decoration-dotted">
                                Pos
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Grid Position</TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead>Driver</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {race.grid
                        .sort((a, b) => a.position - b.position)
                        .map((g) => (
                          <TableRow key={g.driverId}>
                            <TableCell className="font-medium">P{g.position}</TableCell>
                            <TableCell>{g.driverName ?? g.driverId}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {race.results && race.results.length > 0 && (
                <div>
                  <h4 className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-semibold">
                    <Clock className="h-3.5 w-3.5" />
                    Race Results
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="decoration-border/60 cursor-help underline decoration-dotted">
                                Pos
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Finish Position</TooltipContent>
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
                            <TooltipContent>Points Earned</TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead className="w-8 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="decoration-border/60 cursor-help underline decoration-dotted">
                                FL
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Fastest Lap</TooltipContent>
                          </Tooltip>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {race.results
                        .sort((a, b) => a.finishPosition - b.finishPosition)
                        .map((r) => (
                          <TableRow key={r.driverId}>
                            <TableCell className="font-medium">{r.finishPosition}</TableCell>
                            <TableCell>{r.driverName ?? r.driverId}</TableCell>
                            <TableCell className="text-center font-bold">{r.points}</TableCell>
                            <TableCell className="text-center">
                              {r.fastestLap && (
                                <Zap className="inline h-3.5 w-3.5 text-amber-400" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {race.status === "upcoming" && (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  Race has not started yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
