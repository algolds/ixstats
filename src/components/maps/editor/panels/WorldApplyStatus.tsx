"use client";

import Link from "next/link";
import { SystemRestart } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Signal } from "~/components/ui/signal";
import {
  appliedText,
  countOf,
  describeWorldFailure,
  type WorldFailure,
} from "~/lib/worldgen/world-apply";
import type { WorldApplied } from "../hooks/useWorldApply";

interface WorldApplyProgressProps {
  label: string;
  message: string;
  progress: number | null;
  /** Offered where the step can be called off without a half-written world */
  onCancel?: () => void;
}

/** A step that takes a while: what it is doing and how far it has got (no number while it is only starting). */
export function WorldApplyProgress({
  label,
  message,
  progress,
  onCancel,
}: WorldApplyProgressProps) {
  return (
    <div className="space-y-2" role="status">
      <p className="text-label-secondary text-footnote flex items-center gap-2">
        <SystemRestart
          aria-hidden
          className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
        />
        <span className="min-w-0 truncate">
          {label}: {message}
        </span>
        {progress !== null && <span className="ml-auto tabular-nums">{Math.round(progress)}%</span>}
      </p>
      {progress !== null && <Progress value={progress} aria-label={label} />}
      {onCancel && (
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}

interface WorldApplyFailedProps {
  failure: WorldFailure;
  /** Why trying again is not possible now, or null */
  blocked: string | null;
  onRetry: () => void;
  onClose: () => void;
}

/** Why the world was not applied, in the server's words, with Retry. The draft is still on the map. */
export function WorldApplyFailed({ failure, blocked, onRetry, onClose }: WorldApplyFailedProps) {
  const { title, reason } = describeWorldFailure(failure);
  return (
    <div className="space-y-2">
      <Signal tone="destructive" title={title}>
        <p>{reason}</p>
        <p className="mt-1">Your preview is kept.</p>
      </Signal>
      {blocked && <p className="text-label-secondary text-caption">{blocked}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={blocked !== null} onClick={onRetry}>
          Retry
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

interface WorldApplyDoneProps {
  applied: WorldApplied;
  realmSlug: string | null;
  onClose: () => void;
}

/** The world is on the realm's map: what was written, and where to go next. */
export function WorldApplyDone({ applied, realmSlug, onClose }: WorldApplyDoneProps) {
  return (
    <div className="space-y-2">
      <Signal tone="success" title="The world is applied">
        <p>{appliedText(applied)}.</p>
        {applied.rejected.length > 0 && (
          <p className="mt-1">
            {countOf(applied.rejected.length, "shape")} could not be written and{" "}
            {applied.rejected.length === 1 ? "was" : "were"} left out.
          </p>
        )}
        {applied.slots.opened > 0 && (
          <p className="mt-1">
            {countOf(applied.slots.opened, "nation")} {applied.slots.opened === 1 ? "is" : "are"}{" "}
            open for claims.
          </p>
        )}
      </Signal>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
        {realmSlug && (
          <Link
            className="text-tint text-footnote underline"
            href={`/r/${encodeURIComponent(realmSlug)}`}
          >
            Go to the realm
          </Link>
        )}
      </div>
    </div>
  );
}
