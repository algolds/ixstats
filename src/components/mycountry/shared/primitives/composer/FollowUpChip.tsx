"use client";

import React from "react";
import { GitFork, Xmark } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

/** The "Follow-up to ..." link between a new directive and the one it builds on. */
export function FollowUpChip({ goal, onClear }: { goal: string; onClear?: () => void }) {
  return (
    <Card
      variant="well"
      padding="none"
      className="text-footnote flex items-center gap-2 py-1 pr-1 pl-3"
    >
      <GitFork className="text-label-secondary h-4 w-4 shrink-0" aria-hidden />
      <span className="text-label-secondary min-w-0 flex-1 truncate">
        Follow-up to <span className="text-label font-medium">{goal}</span>
      </span>
      {onClear && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          aria-label="Remove follow-up link"
          className="text-label-secondary max-sm:h-11 max-sm:w-11"
        >
          <Xmark />
        </Button>
      )}
    </Card>
  );
}
