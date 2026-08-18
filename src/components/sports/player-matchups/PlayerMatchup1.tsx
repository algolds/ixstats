"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { getPlayerPhotoUrl } from "~/lib/sports/photos";
import { PositionTooltip } from "~/components/sports/PositionTooltip";

export interface MatchupPlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  imageUrl?: string | null;
  overallRating: number;
  teamColor: string;
  teamLogo?: string | null;
  ratings: Record<string, number>;
}

interface PlayerMatchup1Props {
  playerA: MatchupPlayer;
  playerB: MatchupPlayer;
  className?: string;
}

export default function PlayerMatchup1({ playerA, playerB, className }: PlayerMatchup1Props) {
  const fallbackPhoto = "/images/sportyblocks/player-1.png";

  const colorA = playerA.teamColor ?? "#3b82f6";
  const colorB = playerB.teamColor ?? "#ef4444";

  // Combine and de-duplicate stat keys to compare
  const statKeys = Array.from(
    new Set([...Object.keys(playerA.ratings), ...Object.keys(playerB.ratings)])
  )
    .filter((k) => k !== "overall" && k !== "form" && k !== "injuredUntil")
    .slice(0, 5);

  if (statKeys.length === 0) {
    // Fallback comparison keys
    statKeys.push("offense", "defense", "stamina", "speed");
  }

  return (
    <FacetCard
      depth={2}
      interactive="hover"
      className={cn(
        "border-border/40 bg-card/90 mx-auto w-full max-w-[550px] overflow-hidden rounded-3xl border p-6 shadow-xl",
        className
      )}
    >
      {/* Title / Header */}
      <div className="mb-6 text-center">
        <h3 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
          Head to Head Comparison
        </h3>
      </div>

      <div className="mb-8 grid grid-cols-[1fr_120px_1fr] items-center gap-4">
        {/* Player A Details */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div
              className="border-border/30 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border p-1 shadow-md"
              style={{
                background: `linear-gradient(135deg, ${colorA}dd, ${colorA}44)`,
              }}
            >
              <img
                src={getPlayerPhotoUrl(playerA)}
                alt={`${playerA.firstName} ${playerA.lastName}`}
                className="h-full w-full rounded-full object-contain drop-shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallbackPhoto;
                }}
              />
            </div>
            <div
              className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-xs font-bold text-white tabular-nums shadow-md"
              style={{ backgroundColor: colorA }}
            >
              {playerA.overallRating}
            </div>
          </div>
          <h4 className="text-foreground text-sm leading-tight font-semibold">
            {playerA.firstName} {playerA.lastName}
          </h4>
          <PositionTooltip position={playerA.position}>
            <span className="text-muted-foreground mt-1 cursor-help text-[10px] font-semibold tracking-wider uppercase decoration-dotted hover:underline">
              {playerA.position}
            </span>
          </PositionTooltip>
        </div>

        {/* VS Indicator */}
        <div className="flex flex-col items-center justify-center">
          <span className="text-muted-foreground/30 dark:text-muted-foreground/20 text-xl font-bold tracking-widest uppercase">
            VS
          </span>
        </div>

        {/* Player B Details */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div
              className="border-border/30 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border p-1 shadow-md"
              style={{
                background: `linear-gradient(135deg, ${colorB}dd, ${colorB}44)`,
              }}
            >
              <img
                src={getPlayerPhotoUrl(playerB)}
                alt={`${playerB.firstName} ${playerB.lastName}`}
                className="h-full w-full rounded-full object-contain drop-shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallbackPhoto;
                }}
              />
            </div>
            <div
              className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-xs font-bold text-white tabular-nums shadow-md"
              style={{ backgroundColor: colorB }}
            >
              {playerB.overallRating}
            </div>
          </div>
          <h4 className="text-foreground text-sm leading-tight font-semibold">
            {playerB.firstName} {playerB.lastName}
          </h4>
          <PositionTooltip position={playerB.position}>
            <span className="text-muted-foreground mt-1 cursor-help text-[10px] font-semibold tracking-wider uppercase decoration-dotted hover:underline">
              {playerB.position}
            </span>
          </PositionTooltip>
        </div>
      </div>

      {/* Attributes Comparison */}
      <div className="space-y-4">
        {statKeys.map((key) => {
          const valA = playerA.ratings[key] ?? 50;
          const valB = playerB.ratings[key] ?? 50;

          const isAHigher = valA > valB;
          const isBHigher = valB > valA;

          return (
            <div key={key} className="space-y-1">
              <div className="text-foreground/80 flex items-center justify-between text-xs font-bold uppercase tabular-nums">
                <span
                  className={cn(isAHigher && "font-bold")}
                  style={{ color: isAHigher ? colorA : undefined }}
                >
                  {valA}
                </span>
                <span className="text-muted-foreground text-[10px] font-medium tracking-wider">
                  {key}
                </span>
                <span
                  className={cn(isBHigher && "font-bold")}
                  style={{ color: isBHigher ? colorB : undefined }}
                >
                  {valB}
                </span>
              </div>
              <div className="grid h-2 grid-cols-[1fr_8px_1fr] items-center gap-x-2">
                {/* Left Bar (Player A) */}
                <div className="bg-muted flex h-full justify-end overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${valA}%`,
                      backgroundColor: isAHigher ? colorA : "#94a3b8",
                      opacity: isAHigher ? 1 : 0.4,
                    }}
                  />
                </div>

                <div className="bg-border/40 h-2 w-2 shrink-0 rounded-full" />

                {/* Right Bar (Player B) */}
                <div className="bg-muted flex h-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${valB}%`,
                      backgroundColor: isBHigher ? colorB : "#94a3b8",
                      opacity: isBHigher ? 1 : 0.4,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </FacetCard>
  );
}
