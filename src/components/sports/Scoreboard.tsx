"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

export interface TeamInfo {
  id: string;
  name: string;
  city?: string | null;
  color?: string;
  logo?: string | null;
}

export interface ScoreboardProps {
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

export function Scoreboard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  title = "Matchup",
  status = "scheduled",
  date,
  onTeamClick,
  className,
}: ScoreboardProps) {
  const isCompleted = status === "completed";
  const homeColor = homeTeam.color ?? "#3b82f6";
  const awayColor = awayTeam.color ?? "#ef4444";

  return (
    <Card
      className={cn(
        "border-separator bg-surface rounded-sheet shadow-card mx-auto w-full max-w-[360px] overflow-hidden border",
        className
      )}
    >
      <div className="p-6">
        <div className="flex flex-col gap-4">
          {/* Home Team */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => onTeamClick?.(homeTeam.id)}
              className="group h-auto min-w-0 flex-1 justify-start gap-3 p-0 text-left font-normal whitespace-normal hover:bg-transparent hover:underline"
            >
              <div className="border-separator bg-background shadow-card flex aspect-square w-9 shrink-0 items-center justify-center rounded-full border p-1">
                {homeTeam.logo ? (
                  <img
                    src={homeTeam.logo}
                    alt={homeTeam.name}
                    className="h-full w-full rounded-full object-contain"
                  />
                ) : (
                  <svg
                    viewBox="0 0 420 420"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-full w-full transition-transform"
                    style={{ color: homeColor }}
                  >
                    <path
                      d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </div>
              <div className="text-label min-w-0">
                <div className="text-headline truncate">{homeTeam.name}</div>
                {homeTeam.city && (
                  <div className="text-label-secondary text-eyebrow mt-0.5 leading-none">
                    {homeTeam.city}
                  </div>
                )}
              </div>
            </Button>
            {isCompleted && (
              <span className="text-label text-title-3 shrink-0 tabular-nums">
                {homeScore ?? 0}
              </span>
            )}
          </div>

          {/* VS Divider with Title */}
          <div className="flex items-center gap-2">
            <div className="bg-border/40 h-[1px] flex-1"></div>
            <span className="text-label-tertiary text-eyebrow flex items-center gap-1">
              <span>{title}</span>
            </span>
            <div className="bg-border/40 h-[1px] flex-1"></div>
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => onTeamClick?.(awayTeam.id)}
              className="group h-auto min-w-0 flex-1 justify-start gap-3 p-0 text-left font-normal whitespace-normal hover:bg-transparent hover:underline"
            >
              <div className="border-separator bg-background shadow-card flex aspect-square w-9 shrink-0 items-center justify-center rounded-full border p-1">
                {awayTeam.logo ? (
                  <img
                    src={awayTeam.logo}
                    alt={awayTeam.name}
                    className="h-full w-full rounded-full object-contain"
                  />
                ) : (
                  <svg
                    viewBox="0 0 420 420"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-full w-full transition-transform"
                    style={{ color: awayColor }}
                  >
                    <path
                      d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </div>
              <div className="text-label min-w-0">
                <div className="text-headline truncate">{awayTeam.name}</div>
                {awayTeam.city && (
                  <div className="text-label-secondary text-eyebrow mt-0.5 leading-none">
                    {awayTeam.city}
                  </div>
                )}
              </div>
            </Button>
            {isCompleted && (
              <span className="text-label text-title-3 shrink-0 tabular-nums">
                {awayScore ?? 0}
              </span>
            )}
          </div>
        </div>

        {date && (
          <div className="text-label-secondary border-separator text-footnote mt-4 border-t pt-3 text-center">
            {date}
          </div>
        )}
      </div>
    </Card>
  );
}

export default Scoreboard;
