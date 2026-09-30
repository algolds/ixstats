"use client";

/**
 * Selected Components List (Economy Domain)
 *
 * Backed by shared AtomicSelectedList primitive.
 */

import React, { useMemo } from "react";
import {
  ATOMIC_ECONOMIC_COMPONENTS,
  type EconomicComponentType,
} from "~/lib/economy/atomic-data";
import { formatCurrency } from "~/lib/economy/atomic-utils";
import { AtomicSelectedList } from "~/components/shared/atomic-picker";

export interface SelectedComponentsListProps {
  selectedComponents: EconomicComponentType[];
  onDeselect: (component: EconomicComponentType) => void;
  maxComponents?: number;
  isReadOnly?: boolean;
}

export const SelectedComponentsList = React.memo(function SelectedComponentsList({
  selectedComponents,
  onDeselect,
  maxComponents = 15,
  isReadOnly = false,
}: SelectedComponentsListProps) {
  const componentObjects = useMemo(() => {
    return selectedComponents
      .map((type) => ATOMIC_ECONOMIC_COMPONENTS[type])
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
  }, [selectedComponents]);

  return (
    <AtomicSelectedList
      selectedComponents={componentObjects}
      onDeselect={(type) => onDeselect(type as EconomicComponentType)}
      maxComponents={maxComponents}
      isReadOnly={isReadOnly}
      currencyFormatter={formatCurrency}
      emptyTitle="No economic components selected"
      emptySubtitle="Choose components from the library to configure your economic model."
    />
  );
});
