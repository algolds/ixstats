"use client";

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { PlayerCard } from "~/components/sports/PlayerCard";
import { PlayerTrainingButton } from "~/components/sports/club/PlayerTrainingButton";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";
import { SquadRosterTable } from "~/components/sports/club/SquadRosterTable";
import type { PlayerRatings } from "~/lib/sports/types";
import { Card } from "~/components/ui/card";

const CAREER_STAGE_STYLES: Record<string, { label: string; className: string }> = {
  rookie: { label: "Rookie", className: "border-blue/30 bg-blue/10 text-blue" },
  developing: {
    label: "Developing",
    className: "border-green/30 bg-green/10 text-green",
  },
  prime: { label: "Prime", className: "border-yellow/30 bg-yellow/10 text-yellow" },
  plateau: {
    label: "Plateau",
    className: "border-separator bg-fill-3 text-label-secondary",
  },
  declining: {
    label: "Declining",
    className: "border-red/30 bg-red/10 text-red",
  },
  retired: {
    label: "Retired",
    className: "border-muted-foreground/30 bg-fill-3 text-label-secondary",
  },
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

interface RosterCoachItem {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  age: number;
  careerStage: string;
  ratings?: Record<string, number> | null;
}

interface ClubRosterSectionProps {
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
        <div className="border-separator mb-4 flex flex-col justify-between gap-3 border-b pb-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-label text-title-3">Active roster</h3>
            <p className="text-label-secondary text-footnote tabular-nums">
              {players.length} Athletes Registered
            </p>
          </div>

          {/* View Mode Toggle */}
          <SegmentedControl
            size="sm"
            aria-label="Roster view"
            value={viewMode}
            onValueChange={setViewMode}
            options={[
              { value: "table", label: "Squad table" },
              { value: "cards", label: "Card grid" },
            ]}
          />
        </div>

        {players.length === 0 ? (
          <Card>
            <EmptyState compact title="No athletes currently on the active roster." />
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
                  <button
                    type="button"
                    onClick={() => focusAthlete(player.id)}
                    aria-label={`Open ${player.firstName} ${player.lastName}`}
                    className="focus-visible:outline-tint rounded-card duration-fast ease-out-facet cursor-pointer transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]"
                  >
                    <PlayerCard
                      player={player as Parameters<typeof PlayerCard>[0]["player"]}
                      team={{ name: team.name, color: teamColor, logo: team.logo }}
                    />
                  </button>
                  <div className="relative z-10 flex w-[320px] gap-2 px-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => onListPlayer(player)}
                    >
                      Manage listing
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
        <div className="border-separator border-t pt-6">
          <h3 className="text-label text-headline mb-4">Coaching staff</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((coach) => {
              const stageStyle =
                CAREER_STAGE_STYLES[coach.careerStage] ?? CAREER_STAGE_STYLES.prime;
              return (
                <Card key={coach.id} padding="md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-label text-headline">
                        {coach.firstName} {coach.lastName}
                      </h4>
                      <p className="text-label-secondary text-footnote">
                        {coach.role} • Age {coach.age}
                      </p>
                    </div>
                    <Badge variant="outline" className={stageStyle?.className}>
                      {stageStyle?.label ?? coach.careerStage}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
