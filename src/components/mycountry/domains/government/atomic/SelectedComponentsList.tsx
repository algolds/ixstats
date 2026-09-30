"use client";

/**
 * Selected Components List (Government Domain)
 *
 * Backed by shared AtomicSelectedList primitive.
 */

import React from "react";
import type { AtomicGovernmentComponent } from "~/lib/government/atomic-data";
import { ComponentType } from "~/lib/enums";
import { AtomicSelectedList } from "~/components/shared/atomic-picker";

export interface SelectedComponentsListProps {
  selectedComponents: AtomicGovernmentComponent[];
  onDeselect: (componentType: ComponentType) => void;
  isReadOnly?: boolean;
  totalCost?: number;
  totalEffectiveness?: number;
  maxComponents?: number;
}

export const SelectedComponentsList = React.memo<SelectedComponentsListProps>(
  function SelectedComponentsList({
    selectedComponents,
    onDeselect,
    isReadOnly = false,
    maxComponents = 10,
  }) {
    return (
      <AtomicSelectedList
        selectedComponents={selectedComponents}
        onDeselect={onDeselect}
        isReadOnly={isReadOnly}
        maxComponents={maxComponents}
        emptyTitle="No government components selected"
        emptySubtitle="Select components from the library to build your government structure."
      />
    );
  }
);
