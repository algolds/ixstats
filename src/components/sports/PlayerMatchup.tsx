"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { getPlayerPhotoUrl } from "~/lib/sports/photos";
import { PositionTooltip } from "~/components/sports/PositionTooltip";
import { Card } from "~/components/ui/card";

interface MatchupPlayer {
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

interface PlayerMatchupProps {
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
    <Card padding="lg" className={cn("mx-auto w-full max-w-[550px] overflow-hidden", className)}>
      {/* Title / Header */}
      <div className="mb-6 text-center">
        <h3 className="text-label-secondary text-headline">Head to head comparison</h3>
      </div>

      <div className="mb-8 grid grid-cols-[1fr_120px_1fr] items-center gap-4">
        {/* Player A Details */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div
              className="border-separator shadow-card flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border p-1"
              style={{ backgroundColor: `${colorA}66` }}
            >
              <img
                src={getPlayerPhotoUrl(playerA)}
                alt={`${playerA.firstName} ${playerA.lastName}`}
                className="h-full w-full rounded-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallbackPhoto;
                }}
              />
            </div>
            <div
              className="border-separator text-footnote shadow-card absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border font-semibold text-white tabular-nums"
              style={{ backgroundColor: colorA }}
            >
              {playerA.overallRating}
            </div>
          </div>
          <h4 className="text-label text-headline leading-tight">
            {playerA.firstName} {playerA.lastName}
          </h4>
          <PositionTooltip position={playerA.position}>
            <span className="text-label-secondary text-footnote mt-1 cursor-help decoration-dotted hover:underline">
              {playerA.position}
            </span>
          </PositionTooltip>
        </div>

        {/* VS Indicator */}
        <div className="flex flex-col items-center justify-center">
          <span className="text-label-tertiary text-title-2">VS</span>
        </div>

        {/* Player B Details */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div
              className="border-separator shadow-card flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border p-1"
              style={{ backgroundColor: `${colorB}66` }}
            >
              <img
                src={getPlayerPhotoUrl(playerB)}
                alt={`${playerB.firstName} ${playerB.lastName}`}
                className="h-full w-full rounded-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallbackPhoto;
                }}
              />
            </div>
            <div
              className="border-separator text-footnote shadow-card absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border font-semibold text-white tabular-nums"
              style={{ backgroundColor: colorB }}
            >
              {playerB.overallRating}
            </div>
          </div>
          <h4 className="text-label text-headline leading-tight">
            {playerB.firstName} {playerB.lastName}
          </h4>
          <PositionTooltip position={playerB.position}>
            <span className="text-label-secondary text-footnote mt-1 cursor-help decoration-dotted hover:underline">
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
            <div key={key} className="space-y-2">
              <div className="text-footnote flex justify-between font-semibold">
                <span
                  className={cn(
                    "tabular-nums",
                    valA > valB ? "text-label font-semibold" : "text-label-secondary"
                  )}
                >
                  {valA}
                </span>
                <span className="text-label-secondary text-eyebrow">{key}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    valB > valA ? "text-label font-semibold" : "text-label-secondary"
                  )}
                >
                  {valB}
                </span>
              </div>

              {/* Progress Bar with Split */}
              <div className="bg-fill-3 relative flex h-2 w-full overflow-hidden rounded-full">
                <div
                  className="ease-out-facet h-full transition-[width] duration-500"
                  style={{
                    width: `${pctA}%`,
                    backgroundColor: colorA,
                  }}
                />
                <div
                  className="ease-out-facet h-full flex-1 transition-[width] duration-500"
                  style={{
                    backgroundColor: colorB,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
