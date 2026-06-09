"use client";

import React from "react";
import { TabsContent } from "~/components/ui/tabs";
import { TextureCard, TextureCardContent } from "~/components/ui/texture-card";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

interface LeaderboardTabProps {
  leaderboard: Array<{
    countryId: string;
    countryName: string;
    achievementCount: number;
    rareAchievements: number;
    totalPoints: number;
  }> | undefined;
}

export function LeaderboardTab({ leaderboard }: LeaderboardTabProps) {
  return (
    <TabsContent value="leaderboard">
      <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
        <TextureCardContent className="p-6">
          <div className="mb-4">
            <h3 className="text-foreground text-lg font-bold">Global Achievement Leaderboard</h3>
            <p className="text-muted-foreground text-xs">
              Top nations ranked by achievement points
            </p>
          </div>

          {leaderboard && leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.countryId}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-4 backdrop-blur-md transition-all duration-300",
                    index < 3
                      ? "border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent dark:from-amber-500/5 dark:to-transparent"
                      : "border-border/50 bg-card/45 dark:border-white/5 dark:bg-black/20"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-8 text-center text-2xl font-black",
                        index === 0
                          ? "text-amber-500"
                          : index === 1
                            ? "text-slate-400"
                            : index === 2
                              ? "text-amber-700 dark:text-amber-600"
                              : "text-muted-foreground"
                      )}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-foreground font-bold">{entry.countryName}</div>
                      <div className="text-muted-foreground text-xs">
                        {entry.achievementCount} achievements • {entry.rareAchievements} rare+
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="text-amber-550 h-5 w-5 animate-pulse fill-amber-500/20" />
                    <span className="text-foreground text-xl font-black">
                      {entry.totalPoints} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground py-12 text-center text-sm">
              No leaderboard data available
            </div>
          )}
        </TextureCardContent>
      </TextureCard>
    </TabsContent>
  );
}
