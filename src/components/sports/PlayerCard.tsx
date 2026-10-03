"use client";

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
            {team?.logo ? (
              <img
                src={withBasePath(team.logo)}
                alt={team.name}
                className="h-full w-full rounded-full object-contain"
              />
            ) : (
              <svg
                viewBox="0 0 420 420"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-full w-full"
                style={{ color: teamColor }}
              >
                <path
                  d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                  fill="currentColor"
                />
              </svg>
            )}
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
