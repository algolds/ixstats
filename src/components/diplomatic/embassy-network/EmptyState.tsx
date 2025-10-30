"use client";

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Building2 } from "lucide-react";

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
    <Card>
      <CardContent className="py-12">
        <div className="space-y-4 text-center">
          <Building2 className="text-muted-foreground mx-auto h-16 w-16" />
          <div>
            <h3 className="mb-2 text-lg font-semibold">No Embassies Yet</h3>
            <p className="text-muted-foreground mx-auto max-w-md text-sm">
              Establish embassies with other countries to unlock atomic synergies and diplomatic
              bonuses.
            </p>
          </div>
          {isOwner && (
            <Button onClick={onEstablishEmbassy}>
              <Building2 className="mr-2 h-4 w-4" />
              Establish First Embassy
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
