"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { TeamCrest } from "./TeamCrest";

interface TeamInfo {
  id: string;
  name: string;
  city?: string | null;
  color?: string;
  logo?: string | null;
}

interface ScoreboardProps {
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

function TeamRow({
  team,
  color,
  score,
  showScore,
  onTeamClick,
}: {
  team: TeamInfo;
  color: string;
  score?: number | null;
  showScore: boolean;
  onTeamClick?: (teamId: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        onClick={() => onTeamClick?.(team.id)}
        className="group h-auto min-w-0 flex-1 justify-start gap-3 p-0 text-left font-normal whitespace-normal hover:bg-transparent hover:underline"
      >
        <div className="border-separator bg-background shadow-card flex aspect-square w-9 shrink-0 items-center justify-center rounded-full border p-1">
          <TeamCrest
            src={team.logo}
            alt={team.name}
            color={color}
            shieldClassName="h-full w-full transition-transform"
          />
        </div>
        <div className="text-label min-w-0">
          <div className="text-headline truncate">{team.name}</div>
          {team.city && (
            <div className="text-label-secondary text-eyebrow mt-0.5 leading-none">{team.city}</div>
          )}
        </div>
      </Button>
      {showScore && (
        <span className="text-label text-title-3 shrink-0 tabular-nums">{score ?? 0}</span>
      )}
    </div>
  );
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
          <TeamRow
            team={homeTeam}
            color={homeColor}
            score={homeScore}
            showScore={isCompleted}
            onTeamClick={onTeamClick}
          />

          <div className="flex items-center gap-2">
            <div className="bg-border/40 h-[1px] flex-1"></div>
            <span className="text-label-tertiary text-eyebrow flex items-center gap-1">
              <span>{title}</span>
            </span>
            <div className="bg-border/40 h-[1px] flex-1"></div>
          </div>

          <TeamRow
            team={awayTeam}
            color={awayColor}
            score={awayScore}
            showScore={isCompleted}
            onTeamClick={onTeamClick}
          />
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
