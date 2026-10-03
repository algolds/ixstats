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
    <div className="bg-surface-secondary border-separator rounded-card border-yellow/30 bg-yellow/10 shadow-card flex items-center gap-3 border p-4">
      <div className="rounded-row border-yellow/40 bg-yellow/20 shadow-card flex h-10 w-10 shrink-0 items-center justify-center border">
        <Trophy className="text-yellow h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-eyebrow text-yellow block">Reigning champion</span>
        <h5 className="text-label text-headline truncate">{championName}</h5>
        <p className="text-label-secondary text-footnote font-medium">
          Season {seasonNumber} Champions
        </p>
      </div>
    </div>
  );
}
