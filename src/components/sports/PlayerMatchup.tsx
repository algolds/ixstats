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
  ratings: Record<string, number | undefined>;
}

export interface PlayerMatchupProps {
  playerA: MatchupPlayer;
  playerB: MatchupPlayer;
  className?: string;
}

export function PlayerMatchup({ playerA, playerB, className }: PlayerMatchupProps) {
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

      {/* Comparison Sliders / Bars */}
      <div className="space-y-4">
        {statKeys.map((key) => {
          const valA = Number(playerA.ratings[key] ?? 50);
          const valB = Number(playerB.ratings[key] ?? 50);
          const total = valA + valB;
          const pctA = total > 0 ? (valA / total) * 100 : 50;

          return (
            <div key={key} className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span
                  className={cn(
                    "tabular-nums",
                    valA > valB ? "text-foreground font-bold" : "text-muted-foreground"
                  )}
                >
                  {valA}
                </span>
                <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  {key}
                </span>
                <span
                  className={cn(
                    "tabular-nums",
                    valB > valA ? "text-foreground font-bold" : "text-muted-foreground"
                  )}
                >
                  {valB}
                </span>
              </div>

              {/* Progress Bar with Split */}
              <div className="bg-muted/40 relative flex h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${pctA}%`,
                    backgroundColor: colorA,
                  }}
                />
                <div
                  className="h-full flex-1 transition-all duration-500"
                  style={{
                    backgroundColor: colorB,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </FacetCard>
  );
}

export default PlayerMatchup;
