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
import { MapPin, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { useState } from "react";
import { MatchCommentary } from "~/components/sports/MatchCommentary";
import MatchSchedule1 from "~/components/sports/match-schedules/MatchSchedule1";
import { Virtuoso } from "react-virtuoso";

interface ScheduleViewProps {
  matches: Array<{
    id: string;
    matchDay: number;
    homeTeamName?: string;
    awayTeamName?: string;
    homeTeamId?: string;
    awayTeamId?: string;
    homeScore?: number;
    awayScore?: number;
    status: string;
    homeColor?: string;
    awayColor?: string;
    homeTeam?: { logo?: string | null; wikiSlug?: string | null };
    awayTeam?: { logo?: string | null; wikiSlug?: string | null };
  }>;
  archetype?: string;
  onTeamClick?: (teamId: string) => void;
  onMatchClick?: (matchId: string) => void;
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

export function ScheduleView({
  matches,
  archetype,
  onTeamClick,
  onMatchClick,
  className,
}: ScheduleViewProps) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Record<number, boolean>>({});

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

  // Default to expanding the first matchday that has scheduled (not completed) matches
  const activeDay =
    sortedDays.find((day) => matchDays.get(day)!.some((m) => m.status === "scheduled")) ??
    sortedDays[0];

  const renderMatchDayItem = (_index: number, day: number) => {
    const dayMatches = matchDays.get(day)!;
    const isCollapsed = collapsedDays[day] ?? day !== activeDay;

    const mappedMatches = dayMatches.map((m: any) => ({
      id: m.id,
      homeTeam: {
        id: m.homeTeamId ?? m.homeTeam?.id ?? "",
        name: m.homeTeamName ?? m.homeTeam?.name ?? "TBD",
        color: m.homeColor ?? m.homeTeam?.color ?? "#3b82f6",
        logo: m.homeTeam?.logo,
        wikiSlug: m.homeTeam?.wikiSlug,
      },
      awayTeam: {
        id: m.awayTeamId ?? m.awayTeam?.id ?? "",
        name: m.awayTeamName ?? m.awayTeam?.name ?? "TBD",
        color: m.awayColor ?? m.awayTeam?.color ?? "#ef4444",
        logo: m.awayTeam?.logo,
        wikiSlug: m.awayTeam?.wikiSlug,
      },
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      status: m.status,
    }));

    const completedCount = dayMatches.filter((m) => m.status === "completed").length;

    return (
      <div className="border-border/40 bg-card/60 mb-3 overflow-hidden rounded-2xl border shadow-sm backdrop-blur-md transition">
        <button
          onClick={() => setCollapsedDays((prev) => ({ ...prev, [day]: !isCollapsed }))}
          className="bg-muted/20 hover:bg-muted/30 focus-visible:ring-ring flex w-full cursor-pointer items-center justify-between p-4 text-sm font-bold transition-colors outline-none select-none focus-visible:ring-1"
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-cyan-400" />
            <span className="text-foreground">Match Day {day}</span>
            <span className="text-muted-foreground bg-muted border-border/20 rounded-full border px-2 py-0.5 text-[10px] font-bold">
              {completedCount}/{dayMatches.length} Completed
            </span>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
            <span>{isCollapsed ? "Expand" : "Collapse"}</span>
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </div>
        </button>

        {!isCollapsed && (
          <div className="border-border/10 border-t bg-transparent p-4">
            <MatchSchedule1
              matchday={day}
              matches={mappedMatches}
              title=""
              onTeamClick={onTeamClick}
              expandedMatchId={expandedMatchId}
              onMatchClick={(matchId) => {
                if (onMatchClick) {
                  onMatchClick(matchId);
                } else {
                  setExpandedMatchId(expandedMatchId === matchId ? null : matchId);
                }
              }}
              renderMatchExtension={(match) => (
                <div className="mt-1 px-1">
                  <MatchCommentary matchId={match.id} />
                </div>
              )}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      <Virtuoso useWindowScroll data={sortedDays} overscan={4} itemContent={renderMatchDayItem} />
    </div>
  );
}
