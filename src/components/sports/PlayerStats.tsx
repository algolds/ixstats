"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { getPlayerPhotoUrl } from "~/lib/sports/photos";
import { PositionTooltip } from "~/components/sports/PositionTooltip";
import type { PlayerRatings } from "~/lib/sports/types";

export interface PlayerStatsProps {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    number?: number | null;
    age: number;
    careerStage: string;
    imageUrl?: string | null;
    ratings?: PlayerRatings | Record<string, number | undefined> | null;
    isActive?: boolean;
  };
  team?: {
    name: string;
    color?: string;
    logo?: string | null;
  } | null;
  className?: string;
}

// Generate consistent mock credentials deterministically based on player ID
function getDeterministicPlayerBio(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const cities = [
    "Portland, OR",
    "Austin, TX",
    "London, UK",
    "Berlin, DE",
    "Paris, FR",
    "Tokyo, JP",
    "Sydney, AU",
    "Toronto, CA",
  ];
  const nationalities = [
    "United States",
    "Canada",
    "United Kingdom",
    "Germany",
    "France",
    "Japan",
    "Australia",
    "Brazil",
  ];

  const hometown = cities[hash % cities.length] ?? "Metropolis";
  const nationality = nationalities[(hash >> 2) % nationalities.length] ?? "Global";

  // Height: 5'9" to 6'6"
  const heightFt = 5 + (hash % 2);
  const heightIn = heightFt === 5 ? 9 + (hash % 3) : hash % 7;
  const height = `${heightFt}'${heightIn}"`;

  const weight = 165 + (hash % 56);
  const expSeasons = Math.max(1, (hash % 6) + 1);
  const experience = expSeasons === 1 ? "Rookie" : `${expSeasons}th Season`;

  return { hometown, nationality, height, weight, experience };
}

export function PlayerStats({ player, team, className }: PlayerStatsProps) {
  const teamColor = team?.color ?? "#3b82f6";
  const overallRating = player.ratings?.overall ?? 50;
  const bio = getDeterministicPlayerBio(player.id);

  const metrics = [
    { label: "From", value: bio.hometown },
    { label: "Experience", value: bio.experience },
    { label: "Nationality", value: bio.nationality },
  ];

  // Map ratings from the JSON block, filtering out metadata
  const ratings = (player.ratings ?? {}) as Record<string, number | undefined>;
  const statsKeys = Object.keys(ratings)
    .filter((k) => k !== "overall" && k !== "form" && k !== "injuredUntil")
    .slice(0, 6);

  const statistics: Array<{ label: string; value: number | string }> = statsKeys.map((key) => ({
    label: key.toUpperCase(),
    value: ratings[key] ?? 50,
  }));

  if (statistics.length === 0) {
    statistics.push(
      { label: "OVERALL", value: overallRating },
      { label: "AGE", value: player.age },
      { label: "SHIRT #", value: player.number ?? "--" },
      { label: "HEIGHT", value: bio.height },
      { label: "WEIGHT", value: `${bio.weight} lbs` },
      { label: "STATUS", value: player.isActive ? "Active" : "Inactive" }
    );
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
      {/* Header Info */}
      <div className="mb-6 flex items-start gap-4">
        <div className="relative">
          <div
            className="border-border/30 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border p-1 shadow-md"
            style={{
              background: `linear-gradient(135deg, ${teamColor}dd, ${teamColor}44)`,
            }}
          >
            <img
              src={getPlayerPhotoUrl(player)}
              alt={`${player.firstName} ${player.lastName}`}
              className="h-full w-full rounded-full object-contain drop-shadow-md"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/images/sportyblocks/player-1.png";
              }}
            />
          </div>
          <div
            className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-xs font-bold text-white tabular-nums shadow-md"
            style={{ backgroundColor: teamColor }}
          >
            {overallRating}
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-foreground text-xl font-bold tracking-tight">
            {player.firstName} {player.lastName}
          </h3>
          <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
            {team?.name && <span>{team.name}</span>}
            {team?.name && <span>•</span>}
            <PositionTooltip position={player.position}>
              <span className="text-foreground cursor-help font-bold underline decoration-dotted">
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

          <div className="mt-3 flex flex-wrap gap-2">
            {metrics.map((m, idx) => (
              <span
                key={idx}
                className="bg-muted/60 border-border/40 text-muted-foreground rounded-md border px-2 py-0.5 text-[10px] font-medium"
              >
                <strong className="text-foreground">{m.label}:</strong> {m.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Attributes / Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {statistics.map((stat, idx) => (
          <div
            key={idx}
            className="bg-muted/30 border-border/30 rounded-2xl border p-3 text-center transition-colors hover:bg-muted/50"
          >
            <span className="text-muted-foreground block text-[10px] font-semibold tracking-wider uppercase">
              {stat.label}
            </span>
            <span className="text-foreground text-lg font-bold tabular-nums">{stat.value}</span>
          </div>
        ))}
      </div>
    </FacetCard>
  );
}

export default PlayerStats;
