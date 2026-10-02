"use client";

import React, { useState, useMemo } from "react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { TableCell, TableHead, TableRow } from "~/components/ui/table";
import { Search } from "iconoir-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { SPORTS_ABBREVIATIONS } from "~/lib/sports/presets";
import { TableVirtuoso } from "react-virtuoso";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";
import type { Prisma } from "@prisma/client";
import { Button } from "~/components/ui/button";

export interface DraftPick {
  id: string;
  round: number;
  pickNumber: number;
  team: {
    id: string;
    name: string;
    color?: string | null;
    logo?: string | null;
  };
  player?: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    ratings?: Prisma.JsonValue;
  } | null;
}

interface DraftPicksViewProps {
  picks: DraftPick[];
  isSoccer?: boolean;
  onTeamClick?: (teamId: string) => void;
  className?: string;
}

const TableComponents = {
  Table: (props: React.ComponentProps<"table">) => (
    <table
      {...props}
      data-slot="table"
      className={cn(
        "text-footnote sm:text-body w-full min-w-full caption-bottom border-collapse",
        props.className
      )}
    />
  ),
  TableHead: React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"thead">>(
    (props, ref) => (
      <thead
        ref={ref}
        {...props}
        data-slot="table-header"
        className={cn("bg-surface-secondary sticky top-0 z-10 [&_tr]:border-b", props.className)}
      />
    )
  ),
  TableBody: React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"tbody">>(
    (props, ref) => (
      <tbody
        ref={ref}
        {...props}
        data-slot="table-body"
        className={cn("[&_tr:last-child]:border-0", props.className)}
      />
    )
  ),
  TableRow: (props: React.ComponentProps<"tr">) => (
    <tr
      {...props}
      data-slot="table-row"
      className={cn(
        "hover:bg-fill-3 data-[state=selected]:bg-fill-3 border-b transition-colors",
        props.className
      )}
    />
  ),
};

export function DraftPicksView({
  picks,
  isSoccer: _isSoccer = false,
  onTeamClick,
  className,
}: DraftPicksViewProps) {
  const { focusAthlete } = useSportsFocus();
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
    if (rating >= 80) return "bg-green/10 text-green border-green/30";
    if (rating >= 70) return "bg-blue/10 text-blue border-blue/30";
    if (rating >= 60) return "bg-yellow/10 text-yellow border-yellow/30";
    return "bg-fill-3 text-label-secondary border-separator";
  };

  const getPlayerOverall = (ratings: Prisma.JsonValue | undefined): number => {
    if (!ratings || typeof ratings !== "object" || Array.isArray(ratings)) return 50;
    const rec = ratings as Record<string, Prisma.JsonValue>;
    if (typeof rec.overall === "number") return rec.overall;
    const values = Object.values(rec).filter((v): v is number => typeof v === "number");
    if (values.length === 0) return 50;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  if (!picks || picks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-label-secondary">No draft picks or signings recorded for this season.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative max-w-xs flex-1">
          <Search className="text-label-secondary absolute top-3 left-3 h-4 w-4" />
          <Input
            placeholder="Search players, teams..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Round Filter */}
        {rounds.length > 1 && (
          <SegmentedControl
            size="sm"
            aria-label="Round"
            value={String(selectedRound)}
            onValueChange={(value) => setSelectedRound(value === "all" ? "all" : Number(value))}
            options={[
              { value: "all", label: "All Rounds" },
              ...rounds.map((round) => ({ value: String(round), label: `Round ${round}` })),
            ]}
          />
        )}
      </div>

      <div className="border-separator rounded-row overflow-hidden border">
        <TableVirtuoso
          style={{ height: "600px" }}
          data={filteredPicks}
          components={TableComponents}
          // oxlint-disable-next-line
          fixedHeaderContent={() => (
            <TableRow className="bg-fill-3">
              <TableHead className="w-16 text-center">Pick</TableHead>
              <TableHead className="w-20 text-center">Round</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="w-24 text-center">Position</TableHead>
              <TableHead className="w-24 text-center">Overall</TableHead>
            </TableRow>
          )}
          // oxlint-disable-next-line
          itemContent={(_index, pick) => {
            const overall = pick.player ? getPlayerOverall(pick.player.ratings) : 50;

            return (
              <>
                <TableCell className="text-label-secondary w-16 text-center font-semibold tabular-nums">
                  #{pick.pickNumber}
                </TableCell>
                <TableCell className="text-label-secondary w-20 text-center">
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
                      style={{ backgroundColor: pick.team.color ?? "var(--color-text-muted)" }}
                    />
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => onTeamClick?.(pick.team.id)}
                      className="text-label h-auto px-0 font-medium"
                    >
                      {pick.team.name}
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  {pick.player ? (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => pick.player?.id && focusAthlete(pick.player.id)}
                      className="text-label hover:text-tint h-auto px-0 font-medium"
                    >
                      {pick.player.firstName} {pick.player.lastName}
                    </Button>
                  ) : (
                    <span className="text-label-secondary">Skipped / No Pick</span>
                  )}
                </TableCell>
                <TableCell className="w-24 text-center">
                  {pick.player && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="default" className="cursor-help font-semibold">
                          {pick.player.position}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {SPORTS_ABBREVIATIONS[pick.player.position] ?? pick.player.position}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell className="w-24 text-center">
                  {pick.player && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={cn("cursor-help font-semibold", getRatingBadgeClass(overall))}
                        >
                          {overall}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>Overall Rating</TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
              </>
            );
          }}
        />
      </div>
    </div>
  );
}
