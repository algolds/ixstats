"use client";

import React from "react";
import { Trophy } from "iconoir-react";
export * from "./LeagueControlDeck";

export interface ReigningChampionWidgetProps {
  championName: string;
  seasonNumber: number;
}

export function ReigningChampionWidget({
  championName,
  seasonNumber,
}: ReigningChampionWidgetProps) {
  return (
    <div className="facet-hierarchy-child flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 shadow-sm backdrop-blur-md">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/20 shadow-sm">
        <Trophy className="h-5 w-5 text-amber-400" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
          Reigning Champion
        </span>
        <h5 className="text-foreground text-sm font-bold truncate">{championName}</h5>
        <p className="text-muted-foreground text-xs font-medium">Season {seasonNumber} Champions</p>
      </div>
    </div>
  );
}
