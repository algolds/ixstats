"use client";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-sm min-w-[200px] flex-1">
            <Search className="text-label-secondary absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search scenarios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue placeholder="Scenario type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-footnote">
                All types
              </SelectItem>
              {SCENARIO_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-footnote">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="text-label-secondary text-footnote flex cursor-pointer items-center gap-2 px-2 select-none">
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
          <Plus className="mr-2 h-3.5 w-3.5" />
          Create scenario
        </Button>
      </div>

      {/* Advanced Tag Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-label-secondary text-caption mr-1">Filter by:</span>

        {/* Relationship filters */}
        <ToggleGroup
          type="multiple"
          variant="pill"
          size="sm"
          aria-label="Relationship"
          value={relationshipFilter}
          onValueChange={setRelationshipFilter}
          className="flex flex-wrap gap-2"
        >
          {RELATIONSHIP_LEVELS.map((item) => (
            <ToggleGroupItem
              key={item.value}
              value={item.value}
              className="data-[state=on]:bg-blue/15 data-[state=on]:text-blue-ink data-[state=on]:hover:bg-blue/20"
            >
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Difficulty filters */}
        <ToggleGroup
          type="multiple"
          variant="pill"
          size="sm"
          aria-label="Difficulty"
          value={difficultyFilter}
          onValueChange={setDifficultyFilter}
          className="flex flex-wrap gap-2"
        >
          {DIFFICULTY_LEVELS.map((item) => (
            <ToggleGroupItem
              key={item.value}
              value={item.value}
              className="data-[state=on]:bg-yellow/15 data-[state=on]:text-yellow-ink data-[state=on]:hover:bg-yellow/20"
            >
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Time frame filters */}
        <ToggleGroup
          type="multiple"
          variant="pill"
          size="sm"
          aria-label="Time frame"
          value={timeFrameFilter}
          onValueChange={setTimeFrameFilter}
          className="flex flex-wrap gap-2"
        >
          {TIME_FRAMES.map((item) => (
            <ToggleGroupItem
              key={item.value}
              value={item.value}
              className="data-[state=on]:bg-teal/15 data-[state=on]:text-teal-ink data-[state=on]:hover:bg-teal/20"
            >
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
