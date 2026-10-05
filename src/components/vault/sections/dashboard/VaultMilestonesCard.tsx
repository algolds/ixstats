"use client";

import React from "react";
import { Trophy, Trophy as Award } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Card, CardTitle } from "~/components/ui/card";

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
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <CardTitle icon={<Trophy />} className="whitespace-nowrap">
          Achievements &amp; rank
        </CardTitle>
        <span className="text-footnote text-yellow-ink flex items-center gap-1 font-semibold whitespace-nowrap">
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
