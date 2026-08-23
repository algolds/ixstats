"use client";

import Link from "next/link";
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
import { ArrowLeft, Globe, Plus, Search } from "iconoir-react";
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
    <div className="facet-card-parent mb-6 rounded-xl border-2 border-[--intel-gold]/20 bg-gradient-to-br from-[--intel-gold]/5 via-transparent to-[--intel-gold]/10 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-[--intel-gold]/20 bg-[--intel-gold]/10 p-3">
              <Globe className="h-6 w-6 text-[--intel-gold]" />
            </div>
            <div>
              <h1 className="text-foreground text-2xl font-bold md:text-3xl">
                Diplomatic Scenarios
              </h1>
              <p className="text-muted-foreground text-sm">
                Manage dynamic scenario templates with branching player choices and outcomes
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onOpenAddDialog}
            className="bg-[--intel-gold]/20 text-[--intel-gold] hover:bg-[--intel-gold]/30"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Scenario
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Search scenarios by title or narrative..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Scenario Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {SCENARIO_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Checkbox
            id="showInactive"
            checked={showInactive}
            onCheckedChange={(checked) => setShowInactive(checked as boolean)}
          />
          <label htmlFor="showInactive" className="text-foreground cursor-pointer text-sm">
            Show inactive & expired
          </label>
        </div>
      </div>

      {/* Advanced Tag Filter Pills */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <span className="text-xs text-[--intel-silver] self-center mr-2">Filter by:</span>

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
