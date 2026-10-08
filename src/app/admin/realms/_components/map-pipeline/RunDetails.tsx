"use client";

import { useEffect, useRef, useState } from "react";
import { NavArrowDown, NavArrowRight } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import {
  RunStatusBadge,
  StepStatusBadge,
  formatMs,
  isRunActive,
  stepLabel,
  type PipelineRun,
} from "./run-status";

type StepResult = NonNullable<PipelineRun["result"]>["steps"][number];

function StepResultRow({ result }: { result: StepResult }) {
  const [open, setOpen] = useState(result.status === "failed");
  const hasDetails = result.details.length > 0;
  const Arrow = open ? NavArrowDown : NavArrowRight;
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <StepStatusBadge status={result.status} />
        <span className="text-label text-callout font-medium">{stepLabel(result.step)}</span>
        <span className="text-label-secondary text-footnote tabular-nums">
          {formatMs(result.ms)}
        </span>
        {hasDetails && (
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Arrow /> {open ? "Hide details" : `Details (${result.details.length})`}
          </Button>
        )}
      </div>
      <p className="text-label-secondary text-footnote">{result.summary}</p>
      {open && hasDetails && (
        <ul className="bg-fill-4 rounded-row text-footnote text-label-secondary flex flex-col gap-1 p-3">
          {result.details.map((line, i) => (
            <li key={i} className="font-data break-words whitespace-pre-wrap">
              {line}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RunProgress({ run }: { run: PipelineRun }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const cancel = api.realms.mapPipeline.cancel.useMutation({
    onSuccess: () => void utils.realms.mapPipeline.run.invalidate({ jobId: run.id }),
    onError: (e) => notify.error("Could not cancel the run", e.message),
  });
  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <div className="text-footnote flex items-center justify-between gap-3">
        <span className="text-label">
          {run.status === "queued" ? "Waiting for the map import runner" : (run.stage ?? "Working")}
        </span>
        <span className="text-label-secondary tabular-nums">{run.progress}%</span>
      </div>
      <Progress value={run.progress} aria-label="Run progress" />
      <div>
        <Button
          size="sm"
          variant="outline"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate({ jobId: run.id })}
        >
          Cancel run
        </Button>
      </div>
    </div>
  );
}

/** One run, polled every second while it is queued or running: progress, then each step's report. */
export function RunDetails({ jobId, onFinished }: { jobId: string; onFinished: () => void }) {
  const { data: run, error } = api.realms.mapPipeline.run.useQuery(
    { jobId },
    {
      refetchInterval: (query) =>
        isRunActive(query.state.data?.status ?? "queued") ? 1000 : false,
    }
  );
  const active = isRunActive(run?.status);
  const wasActive = useRef(false);
  useEffect(() => {
    if (wasActive.current && !active) onFinished();
    wasActive.current = active;
  }, [active, onFinished]);

  if (!run)
    return <p className="text-label-secondary text-body">{error?.message ?? "Loading the run…"}</p>;
  const requested = run.options?.steps ?? [];
  const results = run.result?.steps ?? [];
  const pending = requested.filter((step) => !results.some((r) => r.step === step));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <RunStatusBadge status={run.status} />
        <span className="text-label text-callout">{run.dryRun ? "Dry run" : "Apply"}</span>
        <span className="text-label-secondary text-footnote">
          {new Date(run.createdAt).toLocaleString()} · by {run.requestedByName}
        </span>
      </div>
      {active && <RunProgress run={run} />}
      {run.error && <p className="text-destructive-ink text-footnote">{run.error}</p>}
      {results.length > 0 && (
        <ul className="divide-separator divide-y" aria-label="Step results">
          {results.map((result) => (
            <StepResultRow key={result.step} result={result} />
          ))}
        </ul>
      )}
      {active && pending.length > 0 && (
        <p className="text-label-secondary text-footnote">
          Still to run: {pending.map(stepLabel).join(", ")}.
        </p>
      )}
    </div>
  );
}
