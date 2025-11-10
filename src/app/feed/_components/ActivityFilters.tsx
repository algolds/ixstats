"use client";

import React from "react";
import { Trophy, Globe, TrendingUp, MessageSquare, Activity } from "lucide-react";
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
    <div className="glass-hierarchy-child space-y-4 rounded-lg p-4">
      {/* Activity Type Filters */}
      <div>
        <h3 className="text-foreground mb-3 text-sm font-semibold">Activity Type</h3>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => {
            const Icon = option.icon;
            const isActive = filter === option.value;

            return (
              <Button
                key={option.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => onFilterChange(option.value)}
                className={`${!isActive && `hover:${option.color}`}`}
              >
                <Icon className="mr-2 h-4 w-4" />
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Category Filters */}
      <div>
        <h3 className="text-foreground mb-3 text-sm font-semibold">Source</h3>
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((option) => {
            const isActive = category === option.value;

            return (
              <Button
                key={option.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => onCategoryChange(option.value)}
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
