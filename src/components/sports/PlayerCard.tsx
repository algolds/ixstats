"use client";

import { TeamCrest } from "./TeamCrest";
import React from "react";
import { cn } from "~/lib/utils";
import { getPlayerPhotoUrl } from "~/lib/sports/photos";
import { withBasePath } from "~/lib/base-path";
import { PositionTooltip } from "~/components/sports/PositionTooltip";
import type { PlayerRatings } from "~/lib/sports/types";
import { Card } from "~/components/ui/card";

interface PlayerCardProps {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    number?: number | null;
    age?: number;
    careerStage?: string;
    imageUrl?: string | null;
    ratings?: PlayerRatings | Record<string, number | undefined> | null;
  };
  team?: {
    name: string;
    color?: string;
    logo?: string | null;
  } | null;
  statistics?: Array<{ label: string; value: number | string }>;
  className?: string;
}

export function PlayerCard({ player, team, statistics, className }: PlayerCardProps) {
  const teamColor = team?.color ?? "#3b82f6";
  const overallRating = player.ratings?.overall;

  // Dynamic background gradient based on team color
  const gradientStyle = {
    background: `linear-gradient(135deg, ${teamColor}dd, ${teamColor}44)`,
  };

  const defaultStats = statistics ?? [
    { label: "Wins", value: player.ratings?.wins ?? "—" },
    { label: "Losses", value: player.ratings?.losses ?? "—" },
    { label: "Overall", value: overallRating ?? "—" },
  ];

  const playerPhoto = getPlayerPhotoUrl(player);

  return (
    <Card className={cn("rounded-sheet mx-auto w-[340px] p-1", className)}>
      <div className="bg-surface border-separator rounded-card border p-3">
        <div className="relative overflow-hidden pb-3">
          <div className="overflow-hidden [filter:url('#rounded')]">
            <div
              className="border-separator rounded-row relative flex h-[320px] items-end justify-center border"
              style={gradientStyle}
            >
              {/* Big Name Background Overlay */}
              <div className="pointer-events-none absolute inset-x-0 top-6 -z-10 text-center text-7xl/none font-semibold text-white uppercase italic opacity-25 mix-blend-overlay select-none">
                <div>{player.firstName.slice(0, 8)}</div>
                <div>{player.lastName.slice(0, 8)}</div>
              </div>

              {/* Player Image */}
              <img
                src={playerPhoto}
                alt={`${player.firstName} ${player.lastName}`}
                className="absolute bottom-0 h-[85%] max-w-full object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/images/sportyblocks/player-1.png";
                }}
              />
            </div>
          </div>

          {/* Bottom Badge for Number / Overall */}
          <div
            className="rounded-row text-title-1 shadow-card absolute start-1/2 bottom-0 flex h-12 w-12 -translate-x-1/2 items-center justify-center border border-white/30 leading-none text-white tabular-nums"
            style={{ backgroundColor: teamColor }}
          >
            {player.number ?? overallRating ?? "—"}
          </div>

          {/* Top-Left Crest */}
          <div className="border-separator bg-surface shadow-card absolute start-0 top-0 aspect-square w-[64px] -translate-x-1/3 -translate-y-1/3 rounded-full border p-1">
            <TeamCrest
              src={team?.logo && withBasePath(team.logo)}
              alt={team?.name ?? ""}
              color={teamColor}
            />
          </div>
        </div>

        {/* Player Name and Team Details */}
        <div className="pt-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-label text-title-2">
              {player.firstName} {player.lastName}
            </h3>
          </div>
          <div className="text-label-secondary text-eyebrow flex items-center justify-center gap-2">
            {team?.name && <span>{team.name}</span>}
            {team?.name && <span>•</span>}
            <PositionTooltip position={player.position}>
              <span className="text-label cursor-help font-semibold underline decoration-dotted">
                {player.position}
              </span>
            </PositionTooltip>
            {player.careerStage && (
              <>
                <span>•</span>
                <span className="capitalize">{player.careerStage}</span>
              </>
            )}
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="bg-fill-3 border-separator divide-separator rounded-card mt-4 grid grid-cols-3 divide-x border p-3 shadow-inner">
          {defaultStats.map((stat, idx) => (
            <div key={idx} className="px-1 text-center">
              <span className="text-label-secondary text-eyebrow block">{stat.label}</span>
              <span className="text-label text-title-3 tabular-nums">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
