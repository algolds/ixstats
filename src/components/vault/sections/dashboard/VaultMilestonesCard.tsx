"use client";

import React from "react";
import { Trophy, Award } from "lucide-react";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";

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
  const totalScore = (myAchievements || []).reduce(
    (acc, ach) => acc + (ach.points || 0),
    0
  );

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
      reward: "50 IxC",
    },
    {
      title: "Credit Stash",
      target: "Reach 5,000 IxC",
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
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-2xl transition-all duration-300 border-t-white/20 dark:bg-black/60 dark:border-white/12 dark:border-t-white/25 hover:border-amber-500/30 hover:shadow-amber-500/10"
      )}
    >
      <TextureOverlay texture="dots" opacity={0.03} />

      <div className="relative z-10 mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm backdrop-blur-md">
            <Trophy className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
            Milestones & Rank
          </span>
        </div>
        <span className="flex items-center gap-1 font-mono text-xs font-bold text-amber-400">
          <Award className="h-3.5 w-3.5" /> {myRank} ({totalScore} pts)
        </span>
      </div>

      <div className="space-y-3.5">
        {milestones.map((m, idx) => {
          const progress = Math.min(100, Math.round((m.current / m.max) * 100));
          const isComplete = progress >= 100;

          return (
            <div
              key={idx}
              className="space-y-1.5 rounded-2xl border border-white/5 bg-white/5 p-3 backdrop-blur-md transition-all hover:bg-white/10"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white tracking-tight">{m.title}</span>
                <span className="font-mono text-[10px] font-semibold text-slate-400">
                  {m.current.toLocaleString()} / {m.max.toLocaleString()}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/5 p-0.5 backdrop-blur-md">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isComplete
                      ? "bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                      : "bg-gradient-to-r from-purple-500 to-indigo-400"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{m.target}</span>
                <span className="font-semibold text-amber-400">{m.reward}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
