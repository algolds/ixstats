"use client";

import React from "react";
import { Trophy, Trophy as Award } from "iconoir-react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

export interface VaultMilestonesCardProps {
  myAchievements?: Array<{ points?: number }>;
  leaderboard?: Array<{ countryId?: string }>;
  userCountryId?: string;
  totalCards: number;
  creditsBalance: number;
}

export function VaultMilestonesCard({
  myAchievements,
  leaderboard,
  userCountryId,
  totalCards,
  creditsBalance,
}: VaultMilestonesCardProps) {
  const totalScore = (myAchievements || []).reduce((acc, ach) => acc + (ach.points || 0), 0);

  let myRank = "Unranked";
  if (leaderboard && userCountryId) {
    const idx = leaderboard.findIndex((item) => item.countryId === userCountryId);
    if (idx !== -1) {
      myRank = `#${idx + 1}`;
    }
  }

  const milestones = [
    {
      title: "Novice Collector",
      target: "Collect 10 cards",
      current: totalCards,
      max: 10,
      reward: (
        <span className="inline-flex items-center gap-0.5">
          +50 <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
        </span>
      ),
    },
    {
      title: "Credit Stash",
      target: (
        <span className="inline-flex items-center gap-0.5">
          Reach 5,000 <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
        </span>
      ),
      current: creditsBalance,
      max: 5000,
      reward: "Bronze Badge",
    },
    {
      title: "Master Deck",
      target: "Collect 50 cards",
      current: totalCards,
      max: 50,
      reward: "Special Pack",
    },
  ];

  return (
    <FacetCard padding="lg" className="overflow-hidden">
      <div className="border-separator mb-4 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-row bg-tint-fill text-tint shadow-card flex h-8 w-8 items-center justify-center border font-medium">
            <Trophy className="text-yellow h-4.5 w-4.5" />
          </div>
          <span className="text-label-secondary text-eyebrow">Milestones & Rank</span>
        </div>
        <span className="text-footnote text-yellow flex items-center gap-1 font-semibold tabular-nums">
          <Award className="h-3.5 w-3.5" /> {myRank} ({totalScore} pts)
        </span>
      </div>

      <div className="space-y-4">
        {milestones.map((m, idx) => {
          const progress = Math.min(100, Math.round((m.current / m.max) * 100));
          const isComplete = progress >= 100;

          return (
            <div
              key={idx}
              className="border-separator bg-fill-4 hover:bg-fill-3 rounded-card space-y-2 border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            >
              <div className="text-footnote flex items-center justify-between">
                <span className="text-label font-semibold">{m.title}</span>
                <span className="text-label-secondary text-footnote font-semibold tabular-nums">
                  {m.current.toLocaleString()} / {m.max.toLocaleString()}
                </span>
              </div>
              <div className="border-separator bg-fill-3 h-2 w-full overflow-hidden rounded-full border p-0.5">
                <div
                  className={cn(
                    "ease-out-facet h-full rounded-full transition-[width] duration-500",
                    isComplete ? "bg-yellow" : "bg-indigo"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-label-secondary text-footnote flex items-center justify-between">
                <span>{m.target}</span>
                <span className="text-yellow font-semibold">{m.reward}</span>
              </div>
            </div>
          );
        })}
      </div>
    </FacetCard>
  );
}
