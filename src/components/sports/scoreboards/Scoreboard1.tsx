"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";

export interface TeamInfo {
  id: string;
  name: string;
  city?: string | null;
  color?: string;
  logo?: string | null;
}

interface Scoreboard1Props {
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  homeScore?: number | null;
  awayScore?: number | null;
  title?: string;
  status?: string;
  date?: string;
  onTeamClick?: (teamId: string) => void;
  className?: string;
}

export default function Scoreboard1({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  title = "Matchup",
  status = "scheduled",
  date,
  onTeamClick,
  className,
}: Scoreboard1Props) {
  const isCompleted = status === "completed";
  const homeColor = homeTeam.color ?? "#3b82f6";
  const awayColor = awayTeam.color ?? "#ef4444";

  return (
    <FacetCard
      depth={2}
      interactive="hover"
      className={cn("mx-auto w-full max-w-[360px] rounded-3xl border border-border/40 bg-card/90 shadow-xl overflow-hidden", className)}
    >
      <div className="p-6">
        <div className="flex flex-col gap-4">
          {/* Home Team */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onTeamClick?.(homeTeam.id)}
              className="flex items-center gap-3 min-w-0 flex-1 text-left hover:underline cursor-pointer group"
            >
              <div className="aspect-square w-9 shrink-0 rounded-full border border-border/40 bg-background p-1 flex items-center justify-center shadow-sm">
                {homeTeam.logo ? (
                  <img
                    src={homeTeam.logo}
                    alt={homeTeam.name}
                    className="h-full w-full object-contain rounded-full"
                  />
                ) : (
                  <svg
                    viewBox="0 0 420 420"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-full w-full transition-transform group-hover:scale-110"
                    style={{ color: homeColor }}
                  >
                    <path
                      d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </div>
              <div className="min-w-0 text-foreground">
                <div className="truncate text-sm font-extrabold">{homeTeam.name}</div>
                {homeTeam.city && (
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold leading-none mt-0.5">
                    {homeTeam.city}
                  </div>
                )}
              </div>
            </button>
            {isCompleted && (
              <span className="text-lg font-black text-foreground shrink-0 tabular-nums">
                {homeScore ?? 0}
              </span>
            )}
          </div>

          {/* VS Divider */}
          <div className="flex items-center gap-2">
            <div className="h-[1px] flex-1 bg-border/40"></div>
            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">
              VS
            </div>
            <div className="h-[1px] flex-1 bg-border/40"></div>
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onTeamClick?.(awayTeam.id)}
              className="flex items-center gap-3 min-w-0 flex-1 text-left hover:underline cursor-pointer group"
            >
              <div className="aspect-square w-9 shrink-0 rounded-full border border-border/40 bg-background p-1 flex items-center justify-center shadow-sm">
                {awayTeam.logo ? (
                  <img
                    src={awayTeam.logo}
                    alt={awayTeam.name}
                    className="h-full w-full object-contain rounded-full"
                  />
                ) : (
                  <svg
                    viewBox="0 0 420 420"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-full w-full transition-transform group-hover:scale-110"
                    style={{ color: awayColor }}
                  >
                    <path
                      d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </div>
              <div className="min-w-0 text-foreground">
                <div className="truncate text-sm font-extrabold">{awayTeam.name}</div>
                {awayTeam.city && (
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold leading-none mt-0.5">
                    {awayTeam.city}
                  </div>
                )}
              </div>
            </button>
            {isCompleted && (
              <span className="text-lg font-black text-foreground shrink-0 tabular-nums">
                {awayScore ?? 0}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex justify-between gap-2 px-6 py-3 text-[10px] font-bold text-muted-foreground bg-muted/30 dark:bg-slate-950/20 border-t border-border/20">
        <div className="truncate uppercase tracking-wider">{title}</div>
        {date && <span className="tabular-nums">{date}</span>}
      </div>
    </FacetCard>
  );
}
