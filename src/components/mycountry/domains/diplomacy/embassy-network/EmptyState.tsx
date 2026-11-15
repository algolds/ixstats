"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { City as Building2 } from "iconoir-react";
import { Card } from "~/components/ui/card";
import { EmptyState as FacetEmptyState } from "~/components/ui/empty-state";

interface EmptyStateProps {
  /** Whether the current user owns this country */
  isOwner: boolean;
  /** Optional callback when establish embassy button is clicked */
  onEstablishEmbassy?: () => void;
}

export function EmptyState({ isOwner, onEstablishEmbassy }: EmptyStateProps) {
  return (
    <Card className="rounded-card">
      <FacetEmptyState
        icon={<Building2 />}
        title="No embassies yet"
        message="Establish an embassy with another country to earn synergies and diplomatic bonuses."
        action={
          isOwner ? (
            <Button onClick={onEstablishEmbassy}>
              <Building2 className="h-4 w-4" />
              Establish first embassy
            </Button>
          ) : undefined
        }
      />
    </Card>
  );
}
