/**
 * Component Card
 *
 * Individual economic component card with icon, details, and selection state.
 * Optimized with React.memo for performance.
 */

"use client";

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Plus, Check } from "lucide-react";
import type { AtomicEconomicComponent } from "~/lib/atomic-economic-data";
import { formatCurrency } from "~/lib/atomic-economic-utils";

export interface ComponentCardProps {
  component: AtomicEconomicComponent;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * Economic Component Card Component
 */
function ComponentCardComponent({
  component,
  isSelected,
  onSelect,
  disabled = false,
}: ComponentCardProps) {
  const Icon = component.icon;

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${isSelected ? "bg-emerald-50/50 ring-2 ring-emerald-500" : ""} ${disabled ? "cursor-not-allowed opacity-50" : ""} `}
      onClick={() => !disabled && onSelect()}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 items-start gap-3">
            <div className={`rounded-lg p-2 bg-${component.color}-100`}>
              <Icon className={`h-5 w-5 text-${component.color}-600`} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="mb-1 truncate text-sm font-semibold">{component.name}</h4>
              <p className="mb-2 line-clamp-2 text-xs text-gray-600">{component.description}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {component.category}
                </Badge>
                <Badge
                  variant={
                    component.metadata.complexity === "High"
                      ? "destructive"
                      : component.metadata.complexity === "Medium"
                        ? "default"
                        : "outline"
                  }
                  className="text-xs"
                >
                  {component.metadata.complexity}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant={isSelected ? "default" : "outline"}
            className="shrink-0"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            {isSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 text-xs text-gray-500">
          <span>Cost: {formatCurrency(component.implementationCost)}</span>
          <span>Effectiveness: {component.effectiveness}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

export const ComponentCard = React.memo(ComponentCardComponent);
