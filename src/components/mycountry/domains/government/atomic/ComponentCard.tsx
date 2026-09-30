"use client";

/**
 * Component Card (Government Domain)
 *
 * Backed by shared AtomicCard primitive.
 */

import React from "react";
import type { AtomicGovernmentComponent } from "~/lib/government/atomic-data";
import { ComponentType } from "~/lib/enums";
import { AtomicCard } from "~/components/shared/atomic-picker";

export interface InteractionInfo {
  type: ComponentType;
  name: string;
  score: number;
}

export interface ComponentCardProps {
  component: AtomicGovernmentComponent;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  isReadOnly?: boolean;
  canSelectMore?: boolean;
  synergisticWith?: InteractionInfo[];
  conflictingWith?: InteractionInfo[];
}

export const ComponentCard = React.memo<ComponentCardProps>(function ComponentCard({
  component,
  isSelected,
  onSelect,
  onDeselect,
  isReadOnly = false,
  canSelectMore = true,
  synergisticWith = [],
  conflictingWith = [],
}) {
  return (
    <AtomicCard
      component={component}
      isSelected={isSelected}
      onSelect={onSelect}
      onDeselect={onDeselect}
      isReadOnly={isReadOnly}
      canSelectMore={canSelectMore}
      synergisticWith={synergisticWith}
      conflictingWith={conflictingWith}
    />
  );
});
