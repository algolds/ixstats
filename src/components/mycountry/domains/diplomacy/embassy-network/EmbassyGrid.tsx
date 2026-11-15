"use client";

import React from "react";
import { Card } from "~/components/ui/card";
import { EmbassyCard, type EmbassySummary } from "./EmbassyCard";

interface EmbassyGridProps {
  embassies: EmbassySummary[];
  /** Whether the current user owns this country */
  isOwner: boolean;
  /** Callback when an embassy card is clicked */
  onEmbassyClick: (embassyId: string) => void;
}

export const EmbassyGrid = React.memo(function EmbassyGrid({
  embassies,
  isOwner,
  onEmbassyClick,
}: EmbassyGridProps) {
  return (
    <Card content="data" padding="none">
      <div className="divide-separator/60 grid grid-cols-1 divide-y md:grid-cols-2 md:[&>*:nth-child(even)]:border-l md:[&>*:nth-child(even)]:border-separator/60">
        {embassies.map((embassy) => (
          <EmbassyCard
            key={embassy.id}
            embassy={embassy}
            isOwner={isOwner}
            onClick={() => {
              if (isOwner) {
                onEmbassyClick(embassy.id);
              }
            }}
          />
        ))}
      </div>
    </Card>
  );
});
