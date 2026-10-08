"use client";

import { useState } from "react";
import { Play } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type { MapPipelineStep } from "~/lib/maps/realm-map-pipeline";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { PipelineSection } from "./fields";
import { RunDetails } from "./RunDetails";
import { stepLabel } from "./run-status";

interface RunSectionProps {
  slug: string;
  steps: ReadonlyArray<{ step: MapPipelineStep; label: string }>;
  /** Why a run can't start now (unsaved edits, a run in progress), or null. */
  blocked: string | null;
  jobId: string | null;
  onStarted: (jobId: string) => void;
  onFinished: () => void;
}

/**
 * Run the saved pipeline: choose steps (all by default), dry run or apply (confirmed), then follow the run's
 * progress and read each step's report.
 */
export function RunSection({
  slug,
  steps,
  blocked,
  jobId,
  onStarted,
  onFinished,
}: RunSectionProps) {
  const notify = useNotify();
  const [chosen, setChosen] = useState<MapPipelineStep[]>(steps.map((s) => s.step));
  const [confirming, setConfirming] = useState(false);
  const start = api.realms.mapPipeline.start.useMutation({
    onSuccess: ({ jobId: id }, input) => {
      setConfirming(false);
      onStarted(id);
      notify.info(input.dryRun ? "Dry run started" : "Run started", "Its progress is below.");
    },
    onError: (e) => notify.error("Could not start the run", e.message),
  });
  const ordered = steps.map((s) => s.step).filter((step) => chosen.includes(step));
  const toggle = (step: MapPipelineStep, on: boolean) =>
    setChosen((prev) => (on ? [...prev, step] : prev.filter((s) => s !== step)));
  const go = (dryRun: boolean) => start.mutate({ realm: slug, steps: ordered, dryRun });
  const disabled = !!blocked || ordered.length === 0 || start.isPending;

  return (
    <PipelineSection
      icon={<Play />}
      title="Run"
      description="A dry run writes nothing and reports what each step would change. Apply writes it; layer writes keep a rollback snapshot. Steps always run in this order."
    >
      <fieldset className="flex flex-wrap gap-x-6 gap-y-3">
        <legend className="sr-only">Steps to run</legend>
        {steps.map(({ step, label }) => (
          <div key={step} className="flex items-center gap-2">
            <Checkbox
              id={`run-step-${step}`}
              checked={chosen.includes(step)}
              onCheckedChange={(v) => toggle(step, v === true)}
            />
            <Label htmlFor={`run-step-${step}`}>{label}</Label>
          </div>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={disabled} onClick={() => go(true)}>
          {start.isPending ? "Starting…" : "Dry run"}
        </Button>
        <Button disabled={disabled} onClick={() => setConfirming(true)}>
          Apply
        </Button>
        {blocked && <span className="text-label-secondary text-footnote">{blocked}</span>}
      </div>
      {jobId && (
        <div className="border-separator border-t pt-4">
          <RunDetails key={jobId} jobId={jobId} onFinished={onFinished} />
        </div>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Apply {ordered.length === 1 ? "this step" : "these steps"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ordered.map(stepLabel).join(", ")} write to the realm&apos;s map. Run a dry run first
              to see what changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button disabled={start.isPending} onClick={() => go(false)}>
              Apply
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PipelineSection>
  );
}
