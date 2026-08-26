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
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search scenarios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-xl border-border/30 bg-background/50 pl-8 text-xs backdrop-blur-md focus:border-border/60"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-44 rounded-xl border-border/30 bg-background/50 text-xs backdrop-blur-md">
              <SelectValue placeholder="Scenario Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Types</SelectItem>
              {SCENARIO_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              id="showInactive"
              checked={showInactive}
              onCheckedChange={(checked) => setShowInactive(checked as boolean)}
              className="h-3.5 w-3.5"
            />
            <span>Show inactive</span>
          </label>
        </div>

        <Button
          onClick={onOpenAddDialog}
          className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create Scenario
        </Button>
      </div>

      {/* Advanced Tag Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[11px] font-medium text-muted-foreground mr-1">Filter by:</span>

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
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                isSelected
                  ? "bg-blue-500 text-white"
                  : "bg-white/5 text-[--intel-silver] hover:bg-white/10"
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
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                isSelected
                  ? "bg-yellow-500 text-black font-medium"
                  : "bg-white/5 text-[--intel-silver] hover:bg-white/10"
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
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                isSelected
                  ? "bg-purple-500 text-white"
                  : "bg-white/5 text-[--intel-silver] hover:bg-white/10"
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
