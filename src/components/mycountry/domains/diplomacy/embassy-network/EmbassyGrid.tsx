"use client";

import React from "react";
import { EmbassyCard, type EmbassySummary } from "./EmbassyCard";

/**
 * Props for EmbassyGrid component
 */
interface EmbassyGridProps {
  embassies: EmbassySummary[];
  /** Whether the current user owns this country */
  isOwner: boolean;
  /** Callback when an embassy card is clicked */
  onEmbassyClick: (embassyId: string) => void;
}

/**
 * EmbassyGrid Component
 *
 * Grid layout wrapper for displaying multiple embassy cards in a responsive
 * grid (1 column on mobile, 2 columns on desktop).
 *
 * Features:
 * - Responsive grid layout
 * - Renders EmbassyCard components for each embassy
 * - Passes through click handlers to individual cards
 *
 * @example
 * ```tsx
 * <EmbassyGrid
 *   embassies={embassies}
 *   isOwner={true}
 *   onEmbassyClick={(id) => setSelectedEmbassyId(id)}
 * />
 * ```
 */
export const EmbassyGrid = React.memo(function EmbassyGrid({
  embassies,
  isOwner,
  onEmbassyClick,
}: EmbassyGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
  );
});
