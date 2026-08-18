"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";

import { getPlayerPhotoUrl } from "~/lib/sports/photos";
import { withBasePath } from "~/lib/base-path";
import { PositionTooltip } from "~/components/sports/PositionTooltip";

interface PlayerCard1Props {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    number?: number | null;
    age?: number;
    careerStage?: string;
    imageUrl?: string | null;
    ratings?: Record<string, any> | null;
  };
  team?: {
    name: string;
    color?: string;
    logo?: string | null;
  } | null;
  statistics?: Array<{ label: string; value: number | string }>;
  className?: string;
}

export default function PlayerCard1({ player, team, statistics, className }: PlayerCard1Props) {
  const teamColor = team?.color ?? "#3b82f6";
  const overallRating = player.ratings?.overall ?? 50;

  // Dynamic background gradient based on team color
  const gradientStyle = {
    background: `linear-gradient(135deg, ${teamColor}dd, ${teamColor}44)`,
  };

  const defaultStats = statistics ?? [
    { label: "Wins", value: player.ratings?.wins ?? 0 },
    { label: "Losses", value: player.ratings?.losses ?? 0 },
    { label: "Overall", value: overallRating },
  ];

  const playerPhoto = getPlayerPhotoUrl(player);

  return (
    <FacetCard
      depth={2}
      interactive="hover"
      className={cn("mx-auto w-[340px] rounded-3xl p-1", className)}
    >
      <div className="bg-card/95 border-border/40 rounded-[22px] border p-3.5 backdrop-blur-md">
        <div className="relative overflow-hidden pb-3">
          <div className="overflow-hidden [filter:url('#rounded')]">
            <div
              className="border-border/30 relative flex h-[320px] items-end justify-center rounded-2xl border"
              style={gradientStyle}
            >
              {/* Big Name Background Overlay */}
              <div className="pointer-events-none absolute inset-x-0 top-6 -z-10 text-center text-7xl/none font-extrabold tracking-tighter text-white uppercase italic opacity-25 mix-blend-overlay select-none">
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
            className="absolute start-1/2 bottom-0 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-2xl border border-white/20 text-2xl/none font-black tracking-tighter text-white shadow-lg"
            style={{ backgroundColor: teamColor }}
          >
            {player.number ?? overallRating}
          </div>

          {/* Top-Left Crest */}
          <div className="border-border/40 bg-card absolute start-0 top-0 aspect-square w-[64px] -translate-x-1/3 -translate-y-1/3 rounded-full border p-1 shadow-md">
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

          {/* Top-Right Badge */}
          <div className="border-border/40 bg-card absolute end-0 top-0 flex aspect-square w-[44px] translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full border shadow-md">
            <span className="text-sm font-black" style={{ color: teamColor }}>
              {overallRating}
            </span>
          </div>
        </div>

        <div className="pt-3 pb-1 text-center">
          <h2 className="text-foreground mt-0! truncate text-lg font-extrabold tracking-tight">
            {player.firstName} {player.lastName}
          </h2>
          <div className="text-muted-foreground mt-0.5 flex items-center justify-center gap-1 text-xs font-semibold capitalize">
            <PositionTooltip position={player.position}>
              <span className="cursor-help decoration-dotted hover:underline">
                {player.position}
              </span>
            </PositionTooltip>
            {player.careerStage && (
              <>
                <span>•</span>
                <span>{player.careerStage}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="divide-border/30 text-foreground bg-muted/30 border-border/20 mx-auto mt-1 grid grid-cols-3 divide-x rounded-b-3xl border-t py-3 dark:bg-secondary/40">
        {defaultStats.map((statistic) => (
          <div key={statistic.label} className="px-3 text-center">
            <div className="mb-0.5 text-xs font-bold tabular-nums">{statistic.value}</div>
            <div className="text-muted-foreground text-[10px] leading-none font-bold uppercase">
              {statistic.label}
            </div>
          </div>
        ))}
      </div>
    </FacetCard>
  );
}
