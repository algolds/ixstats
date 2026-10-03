"use client";

import React from "react";
import { Trophy, Trophy as Award } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Card } from "~/components/ui/card";

interface VaultMilestonesCardProps {
  myAchievements?: Array<{ points?: number }>;
  leaderboard?: Array<{ countryId?: string }>;
  userCountryId?: string;
}

export function VaultMilestonesCard({
  myAchievements,
  leaderboard,
  userCountryId,
}: VaultMilestonesCardProps) {
  const totalScore = (myAchievements || []).reduce((acc, ach) => acc + (ach.points || 0), 0);

  let myRank = "Unranked";
  if (leaderboard && userCountryId) {
    const idx = leaderboard.findIndex((item) => item.countryId === userCountryId);
    if (idx !== -1) {
      myRank = `#${idx + 1}`;
    }
  }

  return (
    <Card padding="lg" className="overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-row bg-tint-fill text-tint shadow-card flex h-8 w-8 items-center justify-center border font-medium">
            <Trophy aria-hidden className="text-yellow h-4.5 w-4.5" />
          </div>
          <span className="text-label-secondary text-eyebrow">Achievements & rank</span>
        </div>
        <span className="text-footnote text-yellow-ink flex items-center gap-1 font-semibold">
          <Award aria-hidden className="h-3.5 w-3.5" />
          <span className={cn(myRank !== "Unranked" && "tabular-nums")}>{myRank}</span>
          <span>
            (<span className="tabular-nums">{totalScore}</span> pts)
          </span>
        </span>
      </div>
    </Card>
  );
}
