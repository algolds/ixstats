"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Trophy } from "iconoir-react";
import { DraftPicksView, type DraftPick } from "~/components/sports/league/DraftPicksView";

export interface LeagueDraftTabProps {
  picks: DraftPick[];
  sportPreset: string;
  onTeamClick?: (teamId: string) => void;
}

export function LeagueDraftTab({ picks, sportPreset, onTeamClick }: LeagueDraftTabProps) {
  const isSoccer = sportPreset === "soccer";
  const title = isSoccer ? "Transfers" : "Draft Board";

  return (
    <FacetCard className="relative space-y-6 overflow-hidden p-6 md:p-8">
      <div className="border-separator flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-row border-separator bg-surface-secondary text-label shadow-card flex h-9 w-9 items-center justify-center border">
            <Trophy className="text-yellow h-5 w-5" />
          </div>
          <div>
            <h3 className="text-headline text-label">{title}</h3>
            <p className="text-footnote text-label-secondary font-semibold">
              {isSoccer ? "Completed transfers and signings." : "Round-by-round draft selections."}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-separator bg-fill-4 text-footnote text-label w-fit px-2.5 py-1 font-semibold"
        >
          {picks.length} Selections
        </Badge>
      </div>

      <DraftPicksView picks={picks} isSoccer={isSoccer} onTeamClick={onTeamClick} />
    </FacetCard>
  );
}

export default LeagueDraftTab;
