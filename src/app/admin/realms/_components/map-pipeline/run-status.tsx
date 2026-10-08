"use client";

import type { RouterOutputs } from "~/trpc/react";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { MAP_PIPELINE_STEP_LABELS, type MapPipelineStep } from "~/lib/maps/realm-map-pipeline";

export type PipelineRun = RouterOutputs["realms"]["mapPipeline"]["run"];
export type PipelineRunListItem = RouterOutputs["realms"]["mapPipeline"]["runs"][number];
type StepStatus = PipelineRunListItem["results"][number]["status"];

const STEP_STATUS: Record<StepStatus, { text: string; variant: BadgeVariant }> = {
  unchanged: { text: "Unchanged", variant: "default" },
  "would-change": { text: "Would change", variant: "info" },
  changed: { text: "Changed", variant: "success" },
  skipped: { text: "Skipped", variant: "outline" },
  failed: { text: "Failed", variant: "destructive" },
};

const RUN_STATUS: Record<string, { text: string; variant: BadgeVariant }> = {
  queued: { text: "Queued", variant: "default" },
  running: { text: "Running", variant: "info" },
  succeeded: { text: "Done", variant: "success" },
  failed: { text: "Failed", variant: "destructive" },
  cancelled: { text: "Cancelled", variant: "warning" },
};

const ACTIVE = new Set(["queued", "running"]);

export const isRunActive = (status: string | undefined) => !!status && ACTIVE.has(status);

export function StepStatusBadge({ status }: { status: StepStatus }) {
  const { text, variant } = STEP_STATUS[status];
  return <Badge variant={variant}>{text}</Badge>;
}

export function RunStatusBadge({ status }: { status: string }) {
  const { text, variant } = RUN_STATUS[status] ?? { text: status, variant: "default" as const };
  return <Badge variant={variant}>{text}</Badge>;
}

export const stepLabel = (step: MapPipelineStep) => MAP_PIPELINE_STEP_LABELS[step];

export const formatMs = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
