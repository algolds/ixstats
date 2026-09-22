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
    <FacetCard
      depth={2}
      className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/75 p-6 shadow-xl backdrop-blur-2xl md:p-8 space-y-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-background/60 text-foreground shadow-xs">
            <Trophy className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-foreground">
              {title}
            </h3>
            <p className="text-xs font-semibold text-muted-foreground">
              {isSoccer
                ? "Completed transfers and signings."
                : "Round-by-round draft selections."}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-bold text-foreground w-fit"
        >
          {picks.length} Selections
        </Badge>
      </div>

      <DraftPicksView
        picks={picks}
        isSoccer={isSoccer}
        onTeamClick={onTeamClick}
      />
    </FacetCard>
  );
}

export default LeagueDraftTab;
