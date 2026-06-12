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
import { MapPin } from "lucide-react";

interface ScheduleViewProps {
  matches: Array<{
    id: string;
    matchDay: number;
    homeTeamName?: string;
    awayTeamName?: string;
    homeScore?: number;
    awayScore?: number;
    status: string;
  }>;
  archetype?: string;
  className?: string;
}

interface RaceViewProps {
  races: Array<{
    id: string;
    raceNumber: number;
    circuitName: string;
    status: string;
  }>;
  className?: string;
}

function RaceCalendarView({ races, className }: RaceViewProps) {
  return (
    <Card className={cn("facet-hierarchy-child", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Race Calendar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Circuit</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {races.map((race) => (
              <TableRow key={race.id}>
                <TableCell className="font-medium">{race.raceNumber}</TableCell>
                <TableCell>{race.circuitName}</TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant={
                      race.status === "completed"
                        ? "secondary"
                        : race.status === "upcoming"
                          ? "outline"
                          : "default"
                    }
                  >
                    {race.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ScheduleView({ matches, archetype, className }: ScheduleViewProps) {
  if (archetype === "circuit") {
    const races = matches.map((m) => ({
      id: m.id,
      raceNumber: m.matchDay,
      circuitName: m.homeTeamName ?? "Unknown Circuit",
      status: m.status,
    }));
    return <RaceCalendarView races={races} className={className} />;
  }

  const matchDays = new Map<number, typeof matches>();
  for (const m of matches) {
    const day = m.matchDay;
    if (!matchDays.has(day)) matchDays.set(day, []);
    matchDays.get(day)!.push(m);
  }

  const sortedDays = Array.from(matchDays.keys()).sort((a, b) => a - b);

  return (
    <div className={cn("space-y-4", className)}>
      {sortedDays.map((day) => {
        const dayMatches = matchDays.get(day)!;
        return (
          <Card key={day} className="facet-hierarchy-child">
            <CardHeader>
              <CardTitle className="text-lg">Match Day {day}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {dayMatches.map((match) => {
                  const isCompleted = match.status === "completed";
                  const homeWon =
                    isCompleted &&
                    match.homeScore != null &&
                    match.awayScore != null &&
                    match.homeScore > match.awayScore;
                  const awayWon =
                    isCompleted &&
                    match.homeScore != null &&
                    match.awayScore != null &&
                    match.awayScore > match.homeScore;

                  return (
                    <div
                      key={match.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="flex-1 text-right">
                        <span
                          className={cn(
                            "font-medium",
                            homeWon && "text-foreground font-bold",
                            isCompleted && !homeWon && !awayWon && "text-foreground",
                          )}
                        >
                          {match.homeTeamName ?? "TBD"}
                        </span>
                      </div>
                      <div className="mx-4 flex items-center gap-1">
                        {isCompleted ? (
                          <span className="rounded bg-accent px-3 py-1 text-sm font-bold tabular-nums">
                            {match.homeScore ?? "-"} - {match.awayScore ?? "-"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground rounded border px-3 py-1 text-sm">
                            vs
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <span
                          className={cn(
                            "font-medium",
                            awayWon && "text-foreground font-bold",
                            isCompleted && !homeWon && !awayWon && "text-foreground",
                          )}
                        >
                          {match.awayTeamName ?? "TBD"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
