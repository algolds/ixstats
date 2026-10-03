"use client";

import React from "react";
import { ArrowRight, DiceSix, GitFork, Search, Xmark } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { DirectivePresetsCatalog } from "./DirectivePresetsCatalog";
import type { DirectiveDomain } from "./directive-presets";
import { StepSection } from "./StepSection";

export const MIN_GOAL = 2;
export const MAX_GOAL = 200;

interface GoalStepProps {
  query: string;
  onQueryChange: (query: string) => void;
  domain: DirectiveDomain | "All";
  onDomainChange: (domain: DirectiveDomain | "All") => void;
  followUpOf: { id: string; goal: string } | null;
  onClearFollowUp: () => void;
  onChooseGoal: (goal: string) => void;
  onSuggest: () => void;
}

/** Step 1 of the composer: pick a preset or type a custom goal. */
export function GoalStep({
  query,
  onQueryChange,
  domain,
  onDomainChange,
  followUpOf,
  onClearFollowUp,
  onChooseGoal,
  onSuggest,
}: GoalStepProps) {
  const trimmed = query.trim();
  return (
    <StepSection
      step={1}
      title="Choose a goal"
      description="Pick a preset, or describe what you want your government to achieve."
      action={
        <Button variant="ghost" className="max-sm:h-11" onClick={onSuggest}>
          <DiceSix /> <span className="hidden sm:inline">Suggest one</span>
          <span className="sr-only sm:hidden">Suggest a goal</span>
        </Button>
      }
    >
      <div className="space-y-4">
        {followUpOf && (
          <Card
            variant="inset"
            padding="none"
            className="text-footnote flex items-center gap-2 py-1 pr-1 pl-3"
          >
            <GitFork className="text-label-secondary h-4 w-4 shrink-0" aria-hidden />
            <span className="text-label-secondary min-w-0 flex-1 truncate">
              Follow-up to <span className="text-label font-medium">{followUpOf.goal}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearFollowUp}
              aria-label="Remove follow-up link"
              className="text-label-secondary max-sm:h-11 max-sm:w-11"
            >
              <Xmark />
            </Button>
          </Card>
        )}

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            chooseGoal(query);
          }}
          className="space-y-2"
        >
          <label htmlFor="directive-goal" className="sr-only">
            Goal
          </label>
          <div className="relative">
            <Search
              className="text-label-secondary pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="directive-goal"
              type="text"
              value={query}
              maxLength={MAX_GOAL}
              autoComplete="off"
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search presets or type a goal, e.g. “cut youth unemployment”"
              className="rounded-row focus-visible:border-yellow/60 focus-visible:ring-yellow/30 h-11 pr-11 pl-9"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onQueryChange("")}
                aria-label="Clear"
                className="text-label-secondary absolute top-1/2 right-1 -translate-y-1/2"
              >
                <Xmark />
              </Button>
            )}
          </div>
          {trimmed.length >= MIN_GOAL && (
            <Button
              type="submit"
              variant="outline"
              className="rounded-row h-auto min-h-11 w-full justify-start gap-3 px-3 py-2 text-left"
            >
              <span className="text-label-secondary shrink-0">Use as a custom goal:</span>
              <span className="text-label min-w-0 flex-1 truncate font-medium">{trimmed}</span>
              <ArrowRight className="text-label-secondary" aria-hidden />
            </Button>
          )}
        </form>

        <DirectivePresetsCatalog
          query={query}
          domain={domain}
          onDomainChange={onDomainChange}
          onSelectGoal={onChooseGoal}
        />
      </div>
    </StepSection>
  );
}
