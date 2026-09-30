"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { City as Building2 } from "iconoir-react";

/**
 * Props for EmptyState component
 */
interface EmptyStateProps {
  /** Whether the current user owns this country */
  isOwner: boolean;
  /** Optional callback when establish embassy button is clicked */
  onEstablishEmbassy?: () => void;
}

/**
 * EmptyState Component
 *
 * Displays an empty state when a country has no embassies established.
 * Shows a Building2 icon, messaging, and an optional action button for owners.
 *
 * Features:
 * - Centered layout with icon and messaging
 * - Conditional "Establish First Embassy" button for owners
 * - Calls onEstablishEmbassy callback when button is clicked
 *
 * @example
 * ```tsx
 * // For owners
 * <EmptyState
 *   isOwner={true}
 *   onEstablishEmbassy={() => router.push('/diplomatic/embassies/create')}
 * />
 *
 * // For non-owners (no button)
 * <EmptyState isOwner={false} />
 * ```
 */
export const EmptyState = React.memo(function EmptyState({
  isOwner,
  onEstablishEmbassy,
}: EmptyStateProps) {
  return (
    <FacetCard depth={1} className="rounded-2xl px-6 py-12">
      <div className="space-y-4 text-center">
        <Building2 className="text-muted-foreground mx-auto h-8 w-8" />
        <div>
          <h3 className="text-foreground mb-1 text-base font-semibold">No embassies yet</h3>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            Establish embassies with other countries to unlock atomic synergies and diplomatic
            bonuses.
          </p>
        </div>
        {isOwner && (
          <Button onClick={onEstablishEmbassy}>
            <Building2 className="h-4 w-4" />
            Establish First Embassy
          </Button>
        )}
      </div>
    </FacetCard>
  );
});
