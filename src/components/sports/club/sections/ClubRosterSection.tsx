"use client";

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { PlayerCard } from "~/components/sports/PlayerCard";
import { PlayerTrainingButton } from "~/components/sports/club/PlayerTrainingButton";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";
import { SquadRosterTable } from "~/components/sports/club/SquadRosterTable";
import type { PlayerRatings } from "~/lib/sports/types";
import { cn } from "~/lib/utils";

const CAREER_STAGE_STYLES: Record<string, { label: string; className: string }> = {
  rookie: { label: "Rookie", className: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  developing: {
    label: "Developing",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  prime: { label: "Prime", className: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  plateau: {
    label: "Plateau",
    className: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  },
  declining: {
    label: "Declining",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
  },
  retired: { label: "Retired", className: "border-muted-foreground/30 bg-muted text-muted-foreground" },
};

export interface RosterPlayerItem {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  number?: number | null;
  age: number;
  careerStage: string;
  imageUrl?: string | null;
  ratings?: PlayerRatings | Record<string, unknown> | null;
}

export interface RosterCoachItem {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  age: number;
  careerStage: string;
  ratings?: Record<string, number> | null;
}

export interface ClubRosterSectionProps {
  team: {
    id: string;
    name: string;
    color?: string | null;
    logo?: string | null;
    sportPreset?: string | null;
    players?: RosterPlayerItem[];
    coaches?: RosterCoachItem[];
  };
  sportPresetAttributes?: string[];
  onListPlayer: (player: RosterPlayerItem) => void;
  onTrained: () => void;
}

export function ClubRosterSection({
  team,
  sportPresetAttributes,
  onListPlayer,
  onTrained,
}: ClubRosterSectionProps) {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const teamColor = team.color ?? undefined;
  const players = team.players ?? [];
  const coaches = team.coaches ?? [];
  const { focusAthlete } = useSportsFocus();

  return (
    <div className="space-y-8">
      {/* Active Roster */}
      <div>
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/20 pb-4">
          <div>
            <h3 className="text-foreground text-lg font-bold">Active Roster</h3>
            <p className="text-muted-foreground text-xs font-semibold">
              {players.length} Athletes Registered
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-border/40 bg-muted/20 p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "px-3 py-1 rounded-lg transition cursor-pointer",
                viewMode === "table"
                  ? "bg-card text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Squad Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={cn(
                "px-3 py-1 rounded-lg transition cursor-pointer",
                viewMode === "cards"
                  ? "bg-card text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Card Grid
            </button>
          </div>
        </div>

        {players.length === 0 ? (
          <Card className="facet-hierarchy-child rounded-2xl border border-border/40 p-8 text-center backdrop-blur-md">
            <CardContent className="py-6">
              <p className="text-muted-foreground text-xs font-semibold">No athletes currently on the active roster.</p>
            </CardContent>
          </Card>
        ) : viewMode === "table" ? (
          <SquadRosterTable
            players={players}
            sportPreset={team.sportPreset ?? "soccer"}
            onListPlayer={onListPlayer}
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {players.map((player) => {
              const ratings = (player.ratings as Record<string, number> | undefined) ?? {};
              return (
                <div key={player.id} className="flex flex-col items-center gap-3">
                  <div
                    onClick={() => focusAthlete(player.id)}
                    className="cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <PlayerCard
                      player={player as Parameters<typeof PlayerCard>[0]["player"]}
                      team={{ name: team.name, color: teamColor, logo: team.logo }}
                    />
                  </div>
                  <div className="relative z-10 flex w-[320px] gap-2 px-2">
                    <Button
                      size="sm"
                      variant="outline"
                      data-cuelume-press="subtle"
                      className="border-border/50 bg-card/60 text-foreground hover:bg-muted/40 h-8 flex-1 text-xs font-semibold rounded-xl active:scale-[0.98] cursor-pointer"
                      onClick={() => onListPlayer(player)}
                    >
                      Manage Listing
                    </Button>
                    {sportPresetAttributes && (
                      <div className="relative">
                        <PlayerTrainingButton
                          playerId={player.id}
                          playerName={`${player.firstName} ${player.lastName}`}
                          teamId={team.id}
                          attributes={sportPresetAttributes}
                          currentRatings={ratings}
                          onTrained={onTrained}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* Coaching Staff */}
      {coaches.length > 0 && (
        <div className="border-border/30 border-t pt-6">
          <h3 className="text-foreground mb-4 text-base font-bold">Coaching Staff</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((coach) => {
              const stageStyle = CAREER_STAGE_STYLES[coach.careerStage] ?? CAREER_STAGE_STYLES.prime;
              return (
                <Card key={coach.id} className="facet-hierarchy-child bg-card/45 border-border/40 rounded-2xl backdrop-blur-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-foreground text-sm font-bold">
                          {coach.firstName} {coach.lastName}
                        </h4>
                        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                          {coach.role} • Age {coach.age}
                        </p>
                      </div>
                      <Badge variant="outline" className={stageStyle?.className}>
                        {stageStyle?.label ?? coach.careerStage}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ClubRosterSection;
