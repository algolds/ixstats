"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { getPlayerPhotoUrl } from "~/lib/sports/photos";
import { PositionTooltip } from "~/components/sports/PositionTooltip";

interface PlayerStats1Props {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    number?: number | null;
    age: number;
    careerStage: string;
    imageUrl?: string | null;
    ratings?: Record<string, any> | null;
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

  const hometown = cities[hash % cities.length];
  const nationality = nationalities[(hash >> 2) % nationalities.length];

  // Height: 5'9" to 6'6"
  const heightFt = 5 + (hash % 2);
  const heightIn = heightFt === 5 ? 9 + (hash % 3) : hash % 7;
  const height = `${heightFt}'${heightIn}"`;

  const weight = 165 + (hash % 56);
  const expSeasons = Math.max(1, (hash % 6) + 1);
  const experience = expSeasons === 1 ? "Rookie" : `${expSeasons}th Season`;

  return { hometown, nationality, height, weight, experience };
}

export default function PlayerStats1({ player, team, className }: PlayerStats1Props) {
  const teamColor = team?.color ?? "#3b82f6";
  const overallRating = player.ratings?.overall ?? 50;
  const bio = getDeterministicPlayerBio(player.id);

  const metrics = [
    { label: "From", value: bio.hometown },
    { label: "Experience", value: bio.experience },
    { label: "Nationality", value: bio.nationality },
  ];

  // Map ratings from the JSON block, filtering out metadata
  const ratings = player.ratings ?? {};
  const statsKeys = Object.keys(ratings)
    .filter((k) => k !== "overall" && k !== "form" && k !== "injuredUntil")
    .slice(0, 6);

  const statistics = statsKeys.map((key) => ({
    label: key.toUpperCase(),
    value: ratings[key] ?? 50,
  }));

  if (statistics.length === 0) {
    statistics.push(
      { label: "OVERALL", value: overallRating },
      { label: "AGE", value: player.age },
      { label: "SHIRT #", value: player.number ?? "--" },
      { label: "STAGE", value: player.careerStage.toUpperCase() }
    );
  }

  const fallbackPhoto = "/images/sportyblocks/player-1.png";
  const playerPhoto = getPlayerPhotoUrl(player);

  return (
    <div className={cn("mx-auto w-full px-2", className)}>
      <FacetCard
        depth={2}
        interactive="hover"
        className="border-border/40 bg-card/90 overflow-hidden rounded-3xl border p-1 shadow-xl"
      >
        <div
          className="border-border/10 grid min-h-[300px] gap-y-6 rounded-2xl border px-6 py-6 backdrop-blur-md md:grid-cols-[30%_1fr_auto] md:gap-x-6 md:py-0 md:ps-0 md:pe-5 lg:gap-x-0"
          style={{
            background: `linear-gradient(135deg, ${teamColor}d0, ${teamColor}20)`,
          }}
        >
          {/* Photo container */}
          <div className="relative order-3 -mx-6 -mt-5 -mb-6 h-[280px] overflow-hidden md:order-none md:mx-0 md:mb-0 md:h-auto">
            <div className="relative isolate mt-5 flex h-full overflow-hidden ps-5">
              <svg
                viewBox="0 0 420 420"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute start-1/2 top-6 -z-10 hidden h-auto w-full -translate-x-1/2 text-white/10 md:w-4/5 lg:block lg:w-[260px] xl:h-[360px] xl:w-[360px]"
              >
                <path
                  d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                  fill="currentColor"
                />
              </svg>
              <img
                src={playerPhoto}
                alt={`${player.firstName} ${player.lastName}`}
                className="absolute start-1/2 bottom-0 max-h-[90%] -translate-x-1/2 object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.5)]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallbackPhoto;
                }}
              />
            </div>
          </div>

          {/* Identity details */}
          <div className="order-1 mx-auto flex flex-col justify-center text-white md:order-none md:mx-0 md:py-10">
            <div className="mb-2 flex flex-col items-center text-center md:items-start md:text-left">
              <span className="text-xl font-bold tracking-tight opacity-90">
                {player.firstName}
              </span>
              <span className="text-4xl leading-none font-extrabold tracking-tight uppercase md:text-5xl lg:text-6xl">
                {player.lastName}
              </span>
            </div>

            <div className="mb-4 flex items-center justify-center gap-2 md:justify-start">
              <PositionTooltip position={player.position}>
                <span className="inline-flex rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold tracking-wider uppercase cursor-help hover:bg-white/30 transition-colors">
                  {player.position}
                </span>
              </PositionTooltip>
              <span className="inline-flex items-center gap-x-1 rounded-full bg-black/40 px-3 py-0.5 text-xs font-bold tracking-wider uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                {player.careerStage}
              </span>
              {player.number && (
                <span className="inline-flex rounded-full bg-black/40 px-2 py-0.5 text-xs font-black">
                  #{player.number}
                </span>
              )}
            </div>

            <div className="flex items-center justify-center gap-x-2 md:justify-start">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: teamColor }}></div>
              <div className="text-sm font-bold opacity-90">
                {team?.name ?? "Independent Agent"}
              </div>
            </div>
          </div>

          {/* Biography Credentials */}
          <div className="order-2 flex flex-col justify-center gap-y-2 border-t border-white/10 pt-4 text-white md:border-t-0 md:pt-0">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="grid grid-cols-[80px_1fr] items-center text-xs uppercase md:grid-cols-[100px_1fr]"
              >
                <span className="font-semibold opacity-60">{metric.label}:</span>
                <span className="truncate font-bold">{metric.value}</span>
              </div>
            ))}
            <div className="grid grid-cols-[80px_1fr] items-center text-xs uppercase md:grid-cols-[100px_1fr]">
              <span className="font-semibold opacity-60">Physical:</span>
              <span className="font-bold">
                {bio.height} / {bio.weight} lbs
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Stats Grid */}
        <div className="bg-muted/30 border-border/20 mt-1 rounded-2xl border-t py-6 dark:bg-slate-950/20">
          <div className="divide-border/20 grid grid-cols-2 gap-4 divide-y px-6 md:grid-cols-4 md:divide-x md:divide-y-0 lg:grid-cols-6">
            {statistics.map((statistic) => (
              <div
                key={statistic.label}
                className="flex flex-col items-center justify-center p-2 text-center uppercase first:pt-2 md:first:pt-2"
              >
                <div className="text-foreground text-2xl font-black tabular-nums">
                  {statistic.value}
                </div>
                <div className="text-muted-foreground mt-1 text-[10px] font-bold">
                  {statistic.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </FacetCard>
    </div>
  );
}
