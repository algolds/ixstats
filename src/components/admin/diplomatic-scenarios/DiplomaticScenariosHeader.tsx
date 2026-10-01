"use client";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
// oxlint-disable-next-line eslint/no-unused-vars
import { Globe, Plus, Search } from "iconoir-react";
import {
  SCENARIO_TYPES,
  RELATIONSHIP_LEVELS,
  DIFFICULTY_LEVELS,
  TIME_FRAMES,
} from "~/lib/admin/diplomatic-scenario-transforms";

interface DiplomaticScenariosHeaderProps {
  typeFilter: string;
  setTypeFilter: (type: string) => void;
  relationshipFilter: string[];
  setRelationshipFilter: React.Dispatch<React.SetStateAction<string[]>>;
  difficultyFilter: string[];
  setDifficultyFilter: React.Dispatch<React.SetStateAction<string[]>>;
  timeFrameFilter: string[];
  setTimeFrameFilter: React.Dispatch<React.SetStateAction<string[]>>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showInactive: boolean;
  setShowInactive: (show: boolean) => void;
  onOpenAddDialog: () => void;
}

export function DiplomaticScenariosHeader({
  typeFilter,
  setTypeFilter,
  relationshipFilter,
  setRelationshipFilter,
  difficultyFilter,
  setDifficultyFilter,
  timeFrameFilter,
  setTimeFrameFilter,
  searchQuery,
  setSearchQuery,
  showInactive,
  setShowInactive,
  onOpenAddDialog,
}: DiplomaticScenariosHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-sm min-w-[200px] flex-1">
            <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search scenarios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue placeholder="Scenario Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-footnote">
                All Types
              </SelectItem>
              {SCENARIO_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-footnote">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="text-label-secondary text-footnote flex cursor-pointer items-center gap-1.5 px-2 select-none">
            <Checkbox
              id="showInactive"
              checked={showInactive}
              onCheckedChange={(checked) => setShowInactive(checked as boolean)}
              className="h-3.5 w-3.5"
            />
            <span>Show inactive</span>
          </label>
        </div>

        <Button onClick={onOpenAddDialog}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create Scenario
        </Button>
      </div>

      {/* Advanced Tag Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-label-secondary text-caption mr-1">Filter by:</span>

        {/* Relationship filters */}
        {RELATIONSHIP_LEVELS.map((rel) => {
          const isSelected = relationshipFilter.includes(rel.value);
          return (
            <button
              key={rel.value}
              type="button"
              onClick={() => {
                setRelationshipFilter((prev) =>
                  isSelected ? prev.filter((r) => r !== rel.value) : [...prev, rel.value]
                );
              }}
              className={`text-footnote rounded-full px-3 py-1 transition-colors ${
                isSelected
                  ? "bg-blue text-on-blue"
                  : "bg-fill-4 hover:bg-fill-4 text-label-secondary"
              }`}
            >
              {rel.label}
            </button>
          );
        })}

        {/* Difficulty filters */}
        {DIFFICULTY_LEVELS.map((diff) => {
          const isSelected = difficultyFilter.includes(diff.value);
          return (
            <button
              key={diff.value}
              type="button"
              onClick={() => {
                setDifficultyFilter((prev) =>
                  isSelected ? prev.filter((d) => d !== diff.value) : [...prev, diff.value]
                );
              }}
              className={`text-footnote rounded-full px-3 py-1 transition-colors ${
                isSelected
                  ? "bg-yellow text-on-yellow font-medium"
                  : "bg-fill-4 hover:bg-fill-4 text-label-secondary"
              }`}
            >
              {diff.label}
            </button>
          );
        })}

        {/* Time frame filters */}
        {TIME_FRAMES.map((tf) => {
          const isSelected = timeFrameFilter.includes(tf.value);
          return (
            <button
              key={tf.value}
              type="button"
              onClick={() => {
                setTimeFrameFilter((prev) =>
                  isSelected ? prev.filter((t) => t !== tf.value) : [...prev, tf.value]
                );
              }}
              className={`text-footnote rounded-full px-3 py-1 transition-colors ${
                isSelected
                  ? "bg-teal text-on-teal"
                  : "bg-fill-4 hover:bg-fill-4 text-label-secondary"
              }`}
            >
              {tf.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
