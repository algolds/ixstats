"use client";

import React from "react";
import { EmbassyCard } from "./EmbassyCard";

/**
 * Embassy data with calculated synergies
 */
interface EmbassyWithSynergies {
  id: string;
  name: string;
  hostCountry: string;
  hostCountryFlag?: string | null;
  guestCountry: string;
  guestCountryFlag?: string | null;
  status: string;
  strength: number;
  totalSynergyScore: number;
  economicBonus: number;
  diplomaticBonus: number;
  culturalBonus: number;
  synergies: Array<{
    category: string;
    matchScore: number;
    sharedComponents: string[];
    benefits: {
      economic: number;
      diplomatic: number;
      cultural: number;
    };
  }>;
}

/**
 * Props for EmbassyGrid component
 */
interface EmbassyGridProps {
  /** Array of embassies with calculated synergies */
  embassies: EmbassyWithSynergies[];
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
 *   embassies={embassiesWithSynergies}
 *   isOwner={true}
 *   onEmbassyClick={(id) => setShowSharedData(id)}
 * />
 * ```
 */
export const EmbassyGrid = React.memo(function EmbassyGrid({
  embassies,
  isOwner,
  onEmbassyClick
}: EmbassyGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
