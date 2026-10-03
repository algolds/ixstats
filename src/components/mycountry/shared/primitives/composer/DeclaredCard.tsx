"use client";

import React from "react";
import { CheckCircle, GitFork } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import {
  TONE_CLASSES,
  categoryLabel,
  parseChangeLines,
  tierMaySpawnResistance,
  tierMeta,
} from "~/components/mycountry/directives/directive-model";
import type { IntentCommitResult } from "../IntentComposer";

/** Confirmation shown after a directive is declared, with the next steps on offer. */
export function DeclaredCard({
  declared,
  onViewActive,
  onFollowUp,
  onDismiss,
}: {
  declared: { res: IntentCommitResult; goal: string };
  onViewActive?: () => void;
  onFollowUp?: () => void;
  onDismiss: () => void;
}) {
  const { res } = declared;
  const changes = parseChangeLines(res.intent.changesJson);
  const meta = tierMeta(res.intent.tier);
  return (
    <Card
      role="region"
      aria-label="Directive declared"
      aria-live="polite"
      className="animate-in fade-in rounded-card p-4 duration-200 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <CheckCircle className={cn("mt-0.5 h-6 w-6 shrink-0", TONE_CLASSES.positive.text)} />
        <div className="min-w-0 flex-1">
          <h3 className="text-label text-title-3">Directive declared</h3>
          <p className="text-label text-body mt-1 font-medium">{declared.goal}</p>
          <p className="text-label-secondary text-body mt-1">
            {meta.label} approach · {categoryLabel(res.intent.category)}
            {res.intent.civCapCost ? ` · ${res.intent.civCapCost} CivCap held for a week` : ""}
          </p>
        </div>
      </div>
      {changes.length > 0 && (
        <ul className="border-separator mt-4 space-y-2 border-t pt-4">
          {changes.map((c, i) => (
            <li key={i} className="text-label-secondary text-body first-letter:uppercase">
              {c.label}
            </li>
          ))}
        </ul>
      )}
      {tierMaySpawnResistance(res.intent.tier) && (
        <p className="text-label-secondary text-footnote mt-4">
          Watch your issues: a resistance issue may follow. It must be resolved before this
          directive can be completed.
        </p>
      )}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {onViewActive && (
          <Button className="max-sm:h-11" onClick={onViewActive}>
            View active directives
          </Button>
        )}
        {onFollowUp && (
          <Button variant="outline" className="max-sm:h-11" onClick={onFollowUp}>
            <GitFork /> Build a follow-up
          </Button>
        )}
        <Button variant="ghost" className="max-sm:h-11" onClick={onDismiss}>
          Declare another
        </Button>
      </div>
    </Card>
  );
}
