"use client";

import { Clock } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { PipelineSection } from "./fields";
import { RunStatusBadge, StepStatusBadge, stepLabel, type PipelineRunListItem } from "./run-status";

/** The realm's last runs, newest first; Details shows one above, with each step's report. */
export function RunHistory({
  runs,
  selectedId,
  onSelect,
}: {
  runs: PipelineRunListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <PipelineSection icon={<Clock />} title="Run history">
      {runs.length === 0 ? (
        <p className="text-label-secondary text-body">No runs yet. Start with a dry run.</p>
      ) : (
        <ul className="divide-separator divide-y" aria-label="Run history">
          {runs.map((run) => (
            <li key={run.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <RunStatusBadge status={run.status} />
                <span className="text-label text-callout">
                  {run.dryRun ? "Dry run" : "Applied"}
                </span>
                <span className="text-label-secondary text-footnote">
                  {new Date(run.createdAt).toLocaleString()} · by {run.requestedByName}
                </span>
                <Button
                  size="xs"
                  variant={selectedId === run.id ? "secondary" : "ghost"}
                  className="ml-auto"
                  aria-label={`Details of the run of ${new Date(run.createdAt).toLocaleString()}`}
                  onClick={() => onSelect(run.id)}
                >
                  {selectedId === run.id ? "Showing" : "Details"}
                </Button>
              </div>
              {run.results.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {run.results.map((r) => (
                    <span
                      key={r.step}
                      className="text-label-secondary text-footnote flex items-center gap-1"
                    >
                      {stepLabel(r.step)} <StepStatusBadge status={r.status} />
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-label-secondary text-footnote">
                  {run.steps.map(stepLabel).join(", ")}
                </p>
              )}
              {run.error && <p className="text-destructive-ink text-footnote">{run.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </PipelineSection>
  );
}
