"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import React, { useState, useMemo } from "react";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";
import { getPlayerPhotoUrl } from "~/lib/sports/photos";
import { attributeBadgeClass } from "~/components/sports/rating";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { RosterPlayerItem } from "./sections/ClubRosterSection";

interface SquadRosterTableProps {
  players: RosterPlayerItem[];
  sportPreset?: string;
  onListPlayer?: (player: RosterPlayerItem) => void;
  className?: string;
}

type SortField = "number" | "name" | "position" | "age" | "overall";

export function SquadRosterTable({
  players,
  sportPreset = "soccer",
  onListPlayer,
  className,
}: SquadRosterTableProps) {
  const { focusAthlete } = useSportsFocus();
  const [sortField, setSortField] = useState<SortField>("overall");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;

      switch (sortField) {
        case "number":
          valA = a.number ?? 999;
          valB = b.number ?? 999;
          break;
        case "name":
          valA = `${a.lastName} ${a.firstName}`.toLowerCase();
          valB = `${b.lastName} ${b.firstName}`.toLowerCase();
          break;
        case "position":
          valA = a.position;
          valB = b.position;
          break;
        case "age":
          valA = a.age;
          valB = b.age;
          break;
        case "overall":
        default:
          valA = (a.ratings as Record<string, number> | null)?.overall ?? 50;
          valB = (b.ratings as Record<string, number> | null)?.overall ?? 50;
          break;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [players, sortField, sortAsc]);

  const isHockey = sportPreset === "hockey";
  const isFootball = sportPreset === "football";

  return (
    <>
      <Table containerClassName={className}>
        {/* Table Header */}
        <TableHeader>
          <TableRow>
            <SortableTh
              field="number"
              sortField={sortField}
              sortAsc={sortAsc}
              onSort={handleSort}
              className="w-12 px-3 py-3 text-center"
            >
              #
            </SortableTh>
            <SortableTh
              field="name"
              sortField={sortField}
              sortAsc={sortAsc}
              onSort={handleSort}
              className="min-w-[200px] px-4 py-3"
            >
              Athlete
            </SortableTh>
            <SortableTh
              field="position"
              sortField={sortField}
              sortAsc={sortAsc}
              onSort={handleSort}
              className="px-3 py-3 text-center"
            >
              Pos
            </SortableTh>
            <SortableTh
              field="age"
              sortField={sortField}
              sortAsc={sortAsc}
              onSort={handleSort}
              className="px-3 py-3 text-center"
            >
              Age
            </SortableTh>
            <SortableTh
              field="overall"
              sortField={sortField}
              sortAsc={sortAsc}
              onSort={handleSort}
              className="px-3 py-3 text-center"
            >
              OVR
            </SortableTh>

            {/* Sport-Adaptive Columns */}
            {isHockey ? (
              <>
                <TableHead className="text-center">GP</TableHead>
                <TableHead className="text-center">G</TableHead>
                <TableHead className="text-center">A</TableHead>
                <TableHead className="text-center">PTS</TableHead>
              </>
            ) : isFootball ? (
              <>
                <TableHead className="text-center">GP</TableHead>
                <TableHead className="text-center">Pass</TableHead>
                <TableHead className="text-center">Rush</TableHead>
                <TableHead className="text-center">TD</TableHead>
              </>
            ) : (
              <>
                <TableHead className="text-center">Apps</TableHead>
                <TableHead className="text-center">G</TableHead>
                <TableHead className="text-center">A</TableHead>
              </>
            )}

            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>

        {/* Table Body */}
        <TableBody>
          {sortedPlayers.map((player) => {
            const ratings = (player.ratings as Record<string, number> | null) ?? {};
            const overall = ratings.overall;

            return (
              <TableRow
                key={player.id}
                onClick={() => focusAthlete(player.id)}
                className="group hover:bg-fill-4 cursor-pointer transition-colors"
              >
                {/* Number */}
                <TableCell className="text-label-secondary text-center">
                  {player.number ?? "–"}
                </TableCell>

                {/* Athlete Name & Thumbnail */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="rounded-row border-separator bg-fill-3 h-8 w-8 shrink-0 overflow-hidden border">
                      <img
                        src={getPlayerPhotoUrl(player)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-headline text-label group-hover:text-tint truncate transition-colors">
                        {player.firstName} {player.lastName}
                      </p>
                      <p className="text-footnote text-label-secondary capitalize">
                        {player.careerStage}
                      </p>
                    </div>
                  </div>
                </TableCell>

                {/* Position */}
                <TableCell className="text-center">
                  <Badge variant="default">{player.position}</Badge>
                </TableCell>

                {/* Age */}
                <TableCell className="text-label-secondary text-center">{player.age}</TableCell>

                {/* Overall Rating */}
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className={cn("tabular-nums", attributeBadgeClass(overall))}
                  >
                    {overall ?? <span aria-label="Not recorded">–</span>}
                  </Badge>
                </TableCell>

                {/* Sport-Adaptive Stat Values */}
                {isHockey ? (
                  <>
                    <TableCell className="text-label-secondary text-center">
                      {ratings.gamesPlayed ?? 0}
                    </TableCell>
                    <TableCell className="text-label text-center">{ratings.goals ?? 0}</TableCell>
                    <TableCell className="text-label text-center">{ratings.assists ?? 0}</TableCell>
                    <TableCell className="text-teal text-center">
                      {(ratings.goals ?? 0) + (ratings.assists ?? 0)}
                    </TableCell>
                  </>
                ) : isFootball ? (
                  <>
                    <TableCell className="text-label-secondary text-center">
                      {ratings.gamesPlayed ?? 0}
                    </TableCell>
                    <TableCell className="text-label text-center">
                      {ratings.passYards ?? 0}
                    </TableCell>
                    <TableCell className="text-label text-center">
                      {ratings.rushYards ?? 0}
                    </TableCell>
                    <TableCell className="text-yellow text-center">
                      {ratings.touchdowns ?? 0}
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-label-secondary text-center">
                      {ratings.appearances ?? 0}
                    </TableCell>
                    <TableCell className="text-label text-center">{ratings.goals ?? 0}</TableCell>
                    <TableCell className="text-label text-center">{ratings.assists ?? 0}</TableCell>
                  </>
                )}

                {/* Actions */}
                <TableCell className="text-right">
                  <div
                    className="flex items-center justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onListPlayer && (
                      <Button size="sm" variant="ghost" onClick={() => onListPlayer(player)}>
                        Listing
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => focusAthlete(player.id)}>
                      Focus
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}

/** A sortable column header: the `<TableHead>` carries `aria-sort`, a button inside toggles it. */
function SortableTh({
  field,
  sortField,
  sortAsc,
  onSort,
  className,
  children,
}: {
  field: SortField;
  sortField: SortField;
  sortAsc: boolean;
  onSort: (field: SortField) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const active = sortField === field;
  return (
    <TableHead
      aria-sort={active ? (sortAsc ? "ascending" : "descending") : "none"}
      className={className}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSort(field)}
        className={cn(
          "text-footnote -mx-1 h-auto px-1 py-0.5",
          active ? "text-label" : "text-label-secondary hover:text-label"
        )}
      >
        {children}
      </Button>
    </TableHead>
  );
}
