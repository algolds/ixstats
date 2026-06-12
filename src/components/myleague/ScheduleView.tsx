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
import {
  MapPin,
  ChevronDown,
  ChevronUp,
  Trophy,
  AlertTriangle,
  Activity,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { api } from "~/trpc/react";
import MatchSchedule1 from "~/components/sports/match-schedules/MatchSchedule1";

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
  }>;
  archetype?: string;
  onTeamClick?: (teamId: string) => void;
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

function MatchCommentary({ matchId }: { matchId: string }) {
  const { data: match, isLoading, error } = api.sports.getMatchDetails.useQuery({ matchId });

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-xs">
        <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />
        Retrieving match event timeline...
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="text-destructive py-4 text-center text-xs">
        Failed to load match commentary: {error?.message ?? "Match details not found"}
      </div>
    );
  }

  const evaluation = (match as any).evaluation as Record<string, any> | null;
  const trace = (match as any).trace as Array<Record<string, any>> | null;

  return (
    <div className="border-border/40 bg-accent/10 mt-2 space-y-3 rounded-lg border p-3 text-left">
      {evaluation && (
        <div className="border-border/40 grid grid-cols-2 gap-3 border-b pb-2 text-[11px] md:grid-cols-4">
          <div>
            <span className="text-muted-foreground block text-[9px] font-semibold tracking-wider uppercase">
              Win Prob
            </span>
            <span className="font-mono font-medium">
              {Math.round((evaluation.winProbability ?? 0.5) * 100)}% Home
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[9px] font-semibold tracking-wider uppercase">
              Dominance
            </span>
            <span className="font-mono font-medium">
              {Math.round((evaluation.dominance ?? 0.5) * 100)}% Possession
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[9px] font-semibold tracking-wider uppercase">
              Tempo
            </span>
            <span className="font-mono font-medium">
              {(evaluation.tempo ?? 1.0).toFixed(1)}x Speed
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[9px] font-semibold tracking-wider uppercase">
              Volatility
            </span>
            <span className="font-mono font-medium">
              {(evaluation.volatility ?? 0.5).toFixed(1)} Upset Index
            </span>
          </div>
        </div>
      )}

      <div>
        <p className="text-muted-foreground mb-2 text-[10px] font-bold tracking-wider uppercase">
          Chronological Match Trace
        </p>
        {trace && trace.length > 0 ? (
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {trace.map((step, idx) => {
              let Icon = Activity;
              let iconColor = "text-slate-500";
              if (step.type === "goal") {
                Icon = Trophy;
                iconColor = "text-amber-500";
              } else if (step.type === "card") {
                Icon = AlertTriangle;
                iconColor = "text-rose-500";
              } else if (step.type === "tactic_shift") {
                Icon = TrendingUp;
                iconColor = "text-blue-500";
              }

              return (
                <div
                  key={idx}
                  className="hover:bg-accent/20 flex items-start gap-2 rounded p-1 text-xs leading-relaxed transition-colors"
                >
                  <span className="text-muted-foreground min-w-[20px] shrink-0 text-right font-mono font-bold">
                    {step.t}'
                  </span>
                  <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconColor)} />
                  <span className="text-foreground/80">{step.description}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs italic">
            No key events recorded for this match.
          </p>
        )}
      </div>
    </div>
  );
}

export function ScheduleView({ matches, archetype, onTeamClick, className }: ScheduleViewProps) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

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
        const mappedMatches = dayMatches.map((m: any) => ({
          id: m.id,
          homeTeam: {
            id: m.homeTeamId ?? m.homeTeam?.id ?? "",
            name: m.homeTeamName ?? m.homeTeam?.name ?? "TBD",
            color: m.homeColor ?? m.homeTeam?.color ?? "#3b82f6",
            logo: m.homeTeam?.logo,
          },
          awayTeam: {
            id: m.awayTeamId ?? m.awayTeam?.id ?? "",
            name: m.awayTeamName ?? m.awayTeam?.name ?? "TBD",
            color: m.awayColor ?? m.awayTeam?.color ?? "#ef4444",
            logo: m.awayTeam?.logo,
          },
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          status: m.status,
        }));

        return (
          <MatchSchedule1
            key={day}
            matchday={day}
            matches={mappedMatches}
            title={`Match Day ${day}`}
            onTeamClick={onTeamClick}
            expandedMatchId={expandedMatchId}
            onMatchClick={(matchId) => {
              setExpandedMatchId(expandedMatchId === matchId ? null : matchId);
            }}
            renderMatchExtension={(match) => (
              <div className="mt-1 px-1">
                <MatchCommentary matchId={match.id} />
              </div>
            )}
          />
        );
      })}
    </div>
  );
}
