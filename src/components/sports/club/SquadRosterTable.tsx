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
  if (value >= 90) return "bg-amber-400/20 text-amber-500 dark:text-amber-400 border-amber-400/40";
  if (value >= 80) return "bg-emerald-400/20 text-emerald-500 dark:text-emerald-400 border-emerald-400/40";
  if (value >= 70) return "bg-blue-400/20 text-blue-500 dark:text-blue-400 border-blue-400/40";
  return "bg-muted/60 text-muted-foreground border-border/40";
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
          valA = ((a.ratings as Record<string, number> | null)?.overall) ?? 50;
          valB = ((b.ratings as Record<string, number> | null)?.overall) ?? 50;
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
    <div className={cn("overflow-x-auto rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl shadow-lg", className)}>
      <table className="w-full text-left text-xs border-collapse">
        {/* Table Header */}
        <thead>
          <tr className="border-b border-border/30 bg-muted/30 text-[11px] font-black uppercase tracking-wider text-muted-foreground select-none">
            <th
              onClick={() => handleSort("number")}
              className="py-3 px-3 text-center w-12 cursor-pointer hover:text-foreground transition"
            >
              #
            </th>
            <th
              onClick={() => handleSort("name")}
              className="py-3 px-4 cursor-pointer hover:text-foreground transition min-w-[200px]"
            >
              Athlete
            </th>
            <th
              onClick={() => handleSort("position")}
              className="py-3 px-3 text-center cursor-pointer hover:text-foreground transition"
            >
              Pos
            </th>
            <th
              onClick={() => handleSort("age")}
              className="py-3 px-3 text-center cursor-pointer hover:text-foreground transition"
            >
              Age
            </th>
            <th
              onClick={() => handleSort("overall")}
              className="py-3 px-3 text-center cursor-pointer hover:text-foreground transition"
            >
              OVR
            </th>

            {/* Sport-Adaptive Columns */}
            {isHockey ? (
              <>
                <th className="py-3 px-3 text-center">GP</th>
                <th className="py-3 px-3 text-center">G</th>
                <th className="py-3 px-3 text-center">A</th>
                <th className="py-3 px-3 text-center">PTS</th>
              </>
            ) : isFootball ? (
              <>
                <th className="py-3 px-3 text-center">GP</th>
                <th className="py-3 px-3 text-center">Pass</th>
                <th className="py-3 px-3 text-center">Rush</th>
                <th className="py-3 px-3 text-center">TD</th>
              </>
            ) : (
              <>
                <th className="py-3 px-3 text-center">Apps</th>
                <th className="py-3 px-3 text-center">G</th>
                <th className="py-3 px-3 text-center">A</th>
              </>
            )}

            <th className="py-3 px-4 text-right">Action</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-border/20">
          {sortedPlayers.map((player) => {
            const ratings = (player.ratings as Record<string, number> | null) ?? {};
            const overall = ratings.overall ?? 50;

            return (
              <tr
                key={player.id}
                onClick={() => focusAthlete(player.id)}
                data-cuelume-press="subtle"
                className="group transition-colors hover:bg-muted/30 cursor-pointer active:scale-[0.99]"
              >
                {/* Number */}
                <td className="py-3 px-3 text-center font-mono font-bold text-muted-foreground">
                  {player.number ?? "—"}
                </td>

                {/* Athlete Name & Thumbnail */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl overflow-hidden border border-border/40 bg-muted/40 shrink-0">
                      <img
                        src={getPlayerPhotoUrl(player)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {player.firstName} {player.lastName}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {player.careerStage}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Position */}
                <td className="py-3 px-3 text-center">
                  <Badge variant="outline" className="text-[10px] font-bold border-border/50">
                    {player.position}
                  </Badge>
                </td>

                {/* Age */}
                <td className="py-3 px-3 text-center font-medium text-muted-foreground">
                  {player.age}
                </td>

                {/* Overall Rating */}
                <td className="py-3 px-3 text-center">
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-black px-2 py-0.5", attributeBadgeClass(overall))}
                  >
                    {overall}
                  </Badge>
                </td>

                {/* Sport-Adaptive Stat Values */}
                {isHockey ? (
                  <>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-muted-foreground">
                      {ratings.gamesPlayed ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-foreground">
                      {ratings.goals ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-foreground">
                      {ratings.assists ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-cyan-400">
                      {(ratings.goals ?? 0) + (ratings.assists ?? 0)}
                    </td>
                  </>
                ) : isFootball ? (
                  <>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-muted-foreground">
                      {ratings.gamesPlayed ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-foreground">
                      {ratings.passYards ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-foreground">
                      {ratings.rushYards ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-amber-400">
                      {ratings.touchdowns ?? 0}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-muted-foreground">
                      {ratings.appearances ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-foreground">
                      {ratings.goals ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-foreground">
                      {ratings.assists ?? 0}
                    </td>
                  </>
                )}

                {/* Actions */}
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {onListPlayer && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onListPlayer(player)}
                        className="h-7 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Listing
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => focusAthlete(player.id)}
                      className="h-7 px-2.5 text-[10px] font-bold border-border/40 bg-card hover:bg-muted/40 cursor-pointer"
                    >
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
