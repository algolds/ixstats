"use client";

import React from "react";
import {
  Trophy,
  Globe,
  StatUp as TrendingUp,
  ChatBubble as MessageSquare,
  Activity,
} from "iconoir-react";
import { Button } from "~/components/ui/button";

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
  { value: "all", label: "All", icon: Activity, color: "text-slate-600" },
  { value: "achievements", label: "Achievements", icon: Trophy, color: "text-amber-500" },
  { value: "diplomatic", label: "Diplomatic", icon: Globe, color: "text-indigo-500" },
  { value: "economic", label: "Economic", icon: TrendingUp, color: "text-green-500" },
  { value: "social", label: "Social", icon: MessageSquare, color: "text-blue-500" },
  { value: "meta", label: "Platform", icon: Activity, color: "text-cyan-500" },
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
    <div className="facet-hierarchy-child space-y-4 rounded-lg p-3 sm:p-4">
      {/* Activity Type Filters */}
      <div>
        <h3 className="text-foreground mb-2 text-xs font-semibold sm:mb-3 sm:text-sm">
          Activity Type
        </h3>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {filterOptions.map((option) => {
            const Icon = option.icon;
            const isActive = filter === option.value;

            return (
              <Button
                key={option.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => onFilterChange(option.value)}
                className={`text-xs sm:text-sm ${!isActive && `hover:${option.color}`}`}
              >
                <Icon className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{option.label}</span>
                <span className="sm:hidden">{option.label.substring(0, 4)}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Category Filters */}
      <div>
        <h3 className="text-foreground mb-2 text-xs font-semibold sm:mb-3 sm:text-sm">Source</h3>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {categoryOptions.map((option) => {
            const isActive = category === option.value;

            return (
              <Button
                key={option.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => onCategoryChange(option.value)}
                className="text-xs sm:text-sm"
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
