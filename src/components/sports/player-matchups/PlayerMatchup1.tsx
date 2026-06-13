"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { getPlayerPhotoUrl } from "~/lib/sports/photos";

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

export default function PlayerMatchup1({
  playerA,
  playerB,
  className,
}: PlayerMatchup1Props) {
  const fallbackPhoto = "/images/sportyblocks/player-1.png";

  const colorA = playerA.teamColor ?? "#3b82f6";
  const colorB = playerB.teamColor ?? "#ef4444";

  // Combine and de-duplicate stat keys to compare
  const statKeys = Array.from(
    new Set([
      ...Object.keys(playerA.ratings),
      ...Object.keys(playerB.ratings),
    ])
  ).filter((k) => k !== "overall" && k !== "form" && k !== "injuredUntil").slice(0, 5);

  if (statKeys.length === 0) {
    // Fallback comparison keys
    statKeys.push("offense", "defense", "stamina", "speed");
  }

  return (
    <FacetCard
      depth={2}
      interactive="hover"
      className={cn(
        "mx-auto w-full max-w-[550px] p-6 rounded-3xl border border-border/40 bg-card/90 shadow-xl overflow-hidden",
        className
      )}
    >
      {/* Title / Header */}
      <div className="mb-6 text-center">
        <h3 className="text-base font-extrabold tracking-wider uppercase text-muted-foreground">
          Head to Head Comparison
        </h3>
      </div>

      <div className="grid grid-cols-[1fr_120px_1fr] gap-4 items-center mb-8">
        {/* Player A Details */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div
              className="w-20 h-20 rounded-full border border-border/30 overflow-hidden shadow-md flex items-center justify-center p-1"
              style={{
                background: `linear-gradient(135deg, ${colorA}dd, ${colorA}44)`,
              }}
            >
              <img
                src={getPlayerPhotoUrl(playerA)}
                alt={`${playerA.firstName} ${playerA.lastName}`}
                className="w-full h-full object-contain rounded-full drop-shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallbackPhoto;
                }}
              />
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-xs font-black text-white shadow-md"
              style={{ backgroundColor: colorA }}
            >
              {playerA.overallRating}
            </div>
          </div>
          <h4 className="text-sm font-extrabold text-foreground leading-tight">
            {playerA.firstName} {playerA.lastName}
          </h4>
          <span className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
            {playerA.position}
          </span>
        </div>

        {/* VS Indicator */}
        <div className="flex flex-col items-center justify-center">
          <span className="text-xl font-black text-muted-foreground/30 dark:text-muted-foreground/20 uppercase tracking-widest">
            VS
          </span>
        </div>

        {/* Player B Details */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div
              className="w-20 h-20 rounded-full border border-border/30 overflow-hidden shadow-md flex items-center justify-center p-1"
              style={{
                background: `linear-gradient(135deg, ${colorB}dd, ${colorB}44)`,
              }}
            >
              <img
                src={getPlayerPhotoUrl(playerB)}
                alt={`${playerB.firstName} ${playerB.lastName}`}
                className="w-full h-full object-contain rounded-full drop-shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallbackPhoto;
                }}
              />
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-xs font-black text-white shadow-md"
              style={{ backgroundColor: colorB }}
            >
              {playerB.overallRating}
            </div>
          </div>
          <h4 className="text-sm font-extrabold text-foreground leading-tight">
            {playerB.firstName} {playerB.lastName}
          </h4>
          <span className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
            {playerB.position}
          </span>
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
              <div className="flex justify-between items-center text-xs font-extrabold uppercase text-foreground/80">
                <span className={cn(isAHigher && "font-black")} style={{ color: isAHigher ? colorA : undefined }}>
                  {valA}
                </span>
                <span className="text-[10px] tracking-wider text-muted-foreground font-bold">
                  {key}
                </span>
                <span className={cn(isBHigher && "font-black")} style={{ color: isBHigher ? colorB : undefined }}>
                  {valB}
                </span>
              </div>
              <div className="grid grid-cols-[1fr_8px_1fr] gap-x-2 items-center h-2">
                {/* Left Bar (Player A) */}
                <div className="flex justify-end h-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${valA}%`,
                      backgroundColor: isAHigher ? colorA : "#94a3b8",
                      opacity: isAHigher ? 1 : 0.4,
                    }}
                  />
                </div>

                <div className="h-2 w-2 rounded-full bg-border/40 shrink-0" />

                {/* Right Bar (Player B) */}
                <div className="flex h-full bg-muted rounded-full overflow-hidden">
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
