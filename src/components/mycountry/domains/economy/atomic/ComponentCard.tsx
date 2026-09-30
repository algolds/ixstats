"use client";

/**
 * Component Card (Economy Domain)
 *
 * Backed by shared AtomicCard primitive.
 */

import React from "react";
import type { AtomicEconomicComponent } from "~/lib/economy/atomic-data";
import { formatCurrency } from "~/lib/economy/atomic-utils";
import { AtomicCard } from "~/components/shared/atomic-picker";

export interface ComponentCardProps {
  component: AtomicEconomicComponent;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  isReadOnly?: boolean;
  canSelectMore?: boolean;
}

export const ComponentCard = React.memo(function ComponentCard({
  component,
  isSelected,
  onSelect,
  disabled = false,
  isReadOnly = false,
  canSelectMore = true,
}: ComponentCardProps) {
  return (
    <AtomicCard
      component={component}
      isSelected={isSelected}
      onSelect={onSelect}
      disabled={disabled}
      isReadOnly={isReadOnly}
      canSelectMore={canSelectMore}
      currencyFormatter={formatCurrency}
    />
  );
});
