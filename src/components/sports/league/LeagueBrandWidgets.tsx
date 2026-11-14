"use client";

import React from "react";
import { Trophy } from "iconoir-react";
import { CardTitle } from "~/components/ui/card";
import { LensCard } from "~/components/ui/lens-card";
export * from "./LeagueControlDeck";

interface ReigningChampionWidgetProps {
  championName: string;
  seasonNumber: number;
}

export function ReigningChampionWidget({
  championName,
  seasonNumber,
}: ReigningChampionWidgetProps) {
  return (
    <LensCard padding="md" className="space-y-2">
      <CardTitle icon={<Trophy />}>Reigning champion</CardTitle>
      <div>
        <p className="text-label text-title-3 truncate">{championName}</p>
        <p className="text-label-secondary text-footnote">Season {seasonNumber}</p>
      </div>
    </LensCard>
  );
}
