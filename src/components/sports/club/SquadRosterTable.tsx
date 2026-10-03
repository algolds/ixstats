"use client";

import React, { useState, useMemo } from "react";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";
import { getPlayerPhotoUrl } from "~/lib/sports/photos";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { RosterPlayerItem } from "./sections/ClubRosterSection";

export interface SquadRosterTableProps {
  players: RosterPlayerItem[];
  sportPreset?: string;
  onListPlayer?: (player: RosterPlayerItem) => void;
  className?: string;
}

type SortField = "number" | "name" | "position" | "age" | "overall";

function attributeBadgeClass(value: number): string {
  if (value >= 90) return "bg-yellow/20 text-yellow border-yellow/40";
  if (value >= 80) return "bg-green/20 text-green border-green/40";
  if (value >= 70) return "bg-blue/20 text-blue border-blue/40";
  return "bg-fill-3 text-label-secondary border-separator";
}

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
    <div
      className={cn(
        "rounded-card border-separator bg-surface shadow-card overflow-x-auto border",
        className
      )}
    >
      <table className="text-footnote w-full border-collapse text-left">
        {/* Table Header */}
        <thead>
          <tr className="border-separator bg-fill-4 text-eyebrow text-label-secondary border-b select-none">
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
                <th className="px-3 py-3 text-center">GP</th>
                <th className="px-3 py-3 text-center">G</th>
                <th className="px-3 py-3 text-center">A</th>
                <th className="px-3 py-3 text-center">PTS</th>
              </>
            ) : isFootball ? (
              <>
                <th className="px-3 py-3 text-center">GP</th>
                <th className="px-3 py-3 text-center">Pass</th>
                <th className="px-3 py-3 text-center">Rush</th>
                <th className="px-3 py-3 text-center">TD</th>
              </>
            ) : (
              <>
                <th className="px-3 py-3 text-center">Apps</th>
                <th className="px-3 py-3 text-center">G</th>
                <th className="px-3 py-3 text-center">A</th>
              </>
            )}

            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-separator divide-y">
          {sortedPlayers.map((player) => {
            const ratings = (player.ratings as Record<string, number> | null) ?? {};
            const overall = ratings.overall ?? 50;

            return (
              <tr
                key={player.id}
                onClick={() => focusAthlete(player.id)}
                className="group hover:bg-fill-4 cursor-pointer transition-colors"
              >
                {/* Number */}
                <td className="text-label-secondary px-3 py-3 text-center font-medium tabular-nums">
                  {player.number ?? "—"}
                </td>

                {/* Athlete Name & Thumbnail */}
                <td className="px-4 py-3">
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
                </td>

                {/* Position */}
                <td className="px-3 py-3 text-center">
                  <Badge variant="default">{player.position}</Badge>
                </td>

                {/* Age */}
                <td className="text-label-secondary px-3 py-3 text-center font-medium">
                  {player.age}
                </td>

                {/* Overall Rating */}
                <td className="px-3 py-3 text-center">
                  <Badge
                    variant="outline"
                    className={cn("tabular-nums", attributeBadgeClass(overall))}
                  >
                    {overall}
                  </Badge>
                </td>

                {/* Sport-Adaptive Stat Values */}
                {isHockey ? (
                  <>
                    <td className="text-label-secondary px-3 py-3 text-center font-medium tabular-nums">
                      {ratings.gamesPlayed ?? 0}
                    </td>
                    <td className="text-label px-3 py-3 text-center font-medium tabular-nums">
                      {ratings.goals ?? 0}
                    </td>
                    <td className="text-label px-3 py-3 text-center font-medium tabular-nums">
                      {ratings.assists ?? 0}
                    </td>
                    <td className="text-teal px-3 py-3 text-center font-medium tabular-nums">
                      {(ratings.goals ?? 0) + (ratings.assists ?? 0)}
                    </td>
                  </>
                ) : isFootball ? (
                  <>
                    <td className="text-label-secondary px-3 py-3 text-center font-medium tabular-nums">
                      {ratings.gamesPlayed ?? 0}
                    </td>
                    <td className="text-label px-3 py-3 text-center font-medium tabular-nums">
                      {ratings.passYards ?? 0}
                    </td>
                    <td className="text-label px-3 py-3 text-center font-medium tabular-nums">
                      {ratings.rushYards ?? 0}
                    </td>
                    <td className="text-yellow px-3 py-3 text-center font-medium tabular-nums">
                      {ratings.touchdowns ?? 0}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="text-label-secondary px-3 py-3 text-center font-medium tabular-nums">
                      {ratings.appearances ?? 0}
                    </td>
                    <td className="text-label px-3 py-3 text-center font-medium tabular-nums">
                      {ratings.goals ?? 0}
                    </td>
                    <td className="text-label px-3 py-3 text-center font-medium tabular-nums">
                      {ratings.assists ?? 0}
                    </td>
                  </>
                )}

                {/* Actions */}
                <td className="px-4 py-3 text-right">
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default SquadRosterTable;

/** A sortable column header: the `<th>` carries `aria-sort`, a button inside toggles it. */
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
    <th aria-sort={active ? (sortAsc ? "ascending" : "descending") : "none"} className={className}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSort(field)}
        className={cn(
          "text-eyebrow h-auto px-1 py-0.5",
          active ? "text-label" : "text-label-secondary hover:text-label"
        )}
      >
        {children}
      </Button>
    </th>
  );
}
