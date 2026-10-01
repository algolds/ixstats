"use client";

import React from "react";
import {
  Trophy,
  Globe,
  StatUp as TrendingUp,
  ChatBubble as MessageSquare,
  Activity,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

type ActivityFilter = "all" | "achievements" | "diplomatic" | "economic" | "social" | "meta";
type ActivityCategory = "all" | "game" | "platform" | "social";

interface ActivityFiltersProps {
  filter: ActivityFilter;
  category: ActivityCategory;
  onFilterChange: (filter: ActivityFilter) => void;
  onCategoryChange: (category: ActivityCategory) => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
}

const filterOptions: Array<{ value: ActivityFilter; label: string; icon: any; color: string }> = [
  { value: "all", label: "All", icon: Activity, color: "text-label-secondary" },
  { value: "achievements", label: "Achievements", icon: Trophy, color: "text-yellow" },
  { value: "diplomatic", label: "Diplomatic", icon: Globe, color: "text-indigo" },
  { value: "economic", label: "Economic", icon: TrendingUp, color: "text-green" },
  { value: "social", label: "Social", icon: MessageSquare, color: "text-blue" },
  { value: "meta", label: "Platform", icon: Activity, color: "text-teal" },
];

const categoryOptions: Array<{ value: ActivityCategory; label: string }> = [
  { value: "all", label: "All Sources" },
  { value: "game", label: "In-Game" },
  { value: "platform", label: "Platform" },
  { value: "social", label: "Social" },
];

export function ActivityFilters({
  filter,
  category,
  onFilterChange,
  onCategoryChange,
}: ActivityFiltersProps) {
  return (
    <FacetCard padding="md" className="space-y-4">
      {/* Activity Type Filters */}
      <div>
        <h3 id="activity-type-label" className="text-subhead text-label mb-2">
          Activity Type
        </h3>
        <ToggleGroup
          type="single"
          disallowEmpty
          aria-labelledby="activity-type-label"
          value={filter}
          onValueChange={(value) => value && onFilterChange(value as ActivityFilter)}
          className="flex-wrap"
        >
          {filterOptions.map((option) => {
            const Icon = option.icon;
            return (
              <ToggleGroupItem key={option.value} value={option.value} aria-label={option.label}>
                <Icon aria-hidden className={option.color} />
                <span className="hidden sm:inline">{option.label}</span>
                <span className="sm:hidden">{option.label.substring(0, 4)}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      {/* Category Filters */}
      <div>
        <h3 id="activity-source-label" className="text-subhead text-label mb-2">
          Source
        </h3>
        <SegmentedControl
          aria-labelledby="activity-source-label"
          size="sm"
          value={category}
          onValueChange={onCategoryChange}
          options={categoryOptions}
        />
      </div>
    </FacetCard>
  );
}
