"use client";

import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Signal } from "~/components/ui/signal";
import { WORLD_BUNDLE_LAYERS } from "~/lib/maps/import/world-bundle";
import {
  layerChangeText,
  slotChangeText,
  splitWarnings,
  WORLD_LAYER_LABELS,
} from "~/lib/worldgen/world-apply";
import type { WorldDryRun } from "../hooks/useWorldApply";

function DiffRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-label-secondary">{label}</dt>
      <dd className="text-label text-right tabular-nums">{value}</dd>
    </div>
  );
}

interface WorldApplyReviewProps {
  diff: WorldDryRun;
  /** The check no longer holds: the draft is not the world that was checked, or the realm's map moved on */
  outdated: boolean;
  /** The realm's map is newer than the one the check read (a reason for `outdated`) */
  mapMoved: boolean;
  /** Why the world can't be applied now (a claim landed, the claims can't be read), or null */
  blocked: string | null;
  onApply: () => void;
  onCheckAgain: () => void;
  onCancel: () => void;
}

/**
 * The dry run of a world: what it would do to the realm, before anything is written. Work the world replaces (hand
 * edits, earlier imports) is said first, in a warning of its own.
 */
export function WorldApplyReview({
  diff,
  outdated,
  mapMoved,
  blocked,
  onApply,
  onCheckAgain,
  onCancel,
}: WorldApplyReviewProps) {
  const { replaces, notes } = splitWarnings(diff);
  const layers = WORLD_BUNDLE_LAYERS.filter(
    (layer) => layer !== "political" || diff.source === "preset"
  );
  return (
    <div className="space-y-3">
      <p className="text-label text-footnote font-medium">What this world changes</p>
      {replaces.length > 0 && (
        <Signal tone="warning" title="This replaces work in the realm">
          <ul className="list-disc space-y-1 pl-4">
            {replaces.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Signal>
      )}
      <Card content="data" padding="sm" aria-label="What using this world changes">
        <dl className="text-footnote space-y-1">
          {layers.map((layer) => (
            <DiffRow
              key={layer}
              label={WORLD_LAYER_LABELS[layer]}
              value={layerChangeText(diff.layers[layer])}
            />
          ))}
          <DiffRow label="Nations" value={slotChangeText(diff.slots)} />
        </dl>
      </Card>
      {notes.length > 0 && (
        <ul className="text-label-secondary text-caption list-disc space-y-1 pl-4">
          {notes.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {outdated && (
        <p className="text-label-secondary text-caption" role="status">
          {mapMoved
            ? "The realm's map changed after this check. Check it again to use the new map."
            : "The preview changed after this check, or is being made again. Check it again to use the new one."}
        </p>
      )}
      {blocked && <p className="text-label-secondary text-caption">{blocked}</p>}
      <div className="flex flex-wrap gap-2">
        {outdated ? (
          <Button size="sm" disabled={blocked !== null} onClick={onCheckAgain}>
            Check again
          </Button>
        ) : (
          <Button size="sm" disabled={blocked !== null} onClick={onApply}>
            Apply this world
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
