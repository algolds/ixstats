"use client";

import React, { useState, useMemo } from "react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { SPORTS_ABBREVIATIONS } from "~/lib/sports/presets";

interface DraftPick {
  id: string;
  round: number;
  pickNumber: number;
  team: {
    id: string;
    name: string;
    color: string;
  };
  player: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    ratings: any;
  } | null;
}

interface DraftPicksViewProps {
  picks: DraftPick[];
  isSoccer?: boolean;
  onTeamClick?: (teamId: string) => void;
  className?: string;
}

export function DraftPicksView({
  picks,
  // eslint-disable-next-line unused-imports/no-unused-vars
  isSoccer = false,
  onTeamClick,
  className,
}: DraftPicksViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRound, setSelectedRound] = useState<number | "all">("all");

  const rounds = useMemo(() => {
    const rSet = new Set<number>();
    for (const pick of picks) {
      rSet.add(pick.round);
    }
    return Array.from(rSet).sort((a, b) => a - b);
  }, [picks]);

  const filteredPicks = useMemo(() => {
    return picks.filter((pick) => {
      // Round filter
      if (selectedRound !== "all" && pick.round !== selectedRound) {
        return false;
      }

      // Search query filter
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const playerName = pick.player
        ? `${pick.player.firstName} ${pick.player.lastName}`.toLowerCase()
        : "";
      const teamName = pick.team.name.toLowerCase();
      const position = pick.player?.position?.toLowerCase() ?? "";

      return playerName.includes(query) || teamName.includes(query) || position.includes(query);
    });
  }, [picks, selectedRound, searchQuery]);

  const getRatingBadgeClass = (rating: number) => {
    if (rating >= 80) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    if (rating >= 70) return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    if (rating >= 60) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    return "bg-slate-500/10 text-slate-400 border-slate-500/30";
  };

  const getPlayerOverall = (ratings: any): number => {
    if (!ratings) return 50;
    if (typeof ratings.overall === "number") return ratings.overall;
    const values = Object.values(ratings).filter((v) => typeof v === "number") as number[];
    if (values.length === 0) return 50;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  if (!picks || picks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">
          No draft picks or signings recorded for this season.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <Input
            placeholder="Search players, teams..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Round Filter */}
        {rounds.length > 1 && (
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedRound("all")}
              className={cn(
                "rounded-md border px-3 py-1 text-xs font-medium transition-all",
                selectedRound === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:text-foreground border-border"
              )}
            >
              All Rounds
            </button>
            {rounds.map((round) => (
              <button
                key={round}
                onClick={() => setSelectedRound(round)}
                className={cn(
                  "rounded-md border px-3 py-1 text-xs font-medium transition-all",
                  selectedRound === round
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground hover:text-foreground border-border"
                )}
              >
                Round {round}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="facet-surface border-border/40 overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">Pick</TableHead>
              <TableHead className="w-20 text-center">Round</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="w-24 text-center">Position</TableHead>
              <TableHead className="w-24 text-center">Overall</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPicks.map((pick) => {
              const overall = pick.player ? getPlayerOverall(pick.player.ratings) : 50;

              return (
                <TableRow key={pick.id}>
                  <TableCell className="text-muted-foreground text-center font-bold">
                    #{pick.pickNumber}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">R{pick.round}</span>
                      </TooltipTrigger>
                      <TooltipContent>Round {pick.round}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: pick.team.color ?? "#aaa" }}
                      />
                      <button
                        onClick={() => onTeamClick?.(pick.team.id)}
                        className="cursor-pointer text-left font-medium hover:underline"
                      >
                        {pick.team.name}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {pick.player ? (
                      <span className="text-foreground font-semibold">
                        {pick.player.firstName} {pick.player.lastName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Skipped / No Pick</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {pick.player && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="cursor-help font-semibold">
                            {pick.player.position}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {SPORTS_ABBREVIATIONS[pick.player.position] ?? pick.player.position}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {pick.player && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className={cn("cursor-help font-bold", getRatingBadgeClass(overall))}
                          >
                            {overall}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Overall Rating</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
