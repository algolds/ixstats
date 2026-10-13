"use client";

import { SystemRestart } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { formatCompact } from "~/lib/format/compact";
import { CLIMATE_GROUP_NAMES, TREWARTHA_GROUPS } from "~/lib/worldgen/measure-world";
import type { WorldGenView } from "~/lib/worldgen/worker/world-gen-session";
import type { MinMax, WorldPreviewStats } from "~/lib/worldgen/world-stats";
import { percent } from "./WorldControlParts";

const EMPTY = "–";

const range = (values: MinMax, format: (value: number) => string) =>
  values.min === values.max ? format(values.min) : `${format(values.min)} to ${format(values.max)}`;

export const dollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;

export function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-label-secondary">{label}</dt>
      <dd className="text-label text-right tabular-nums">{value}</dd>
    </div>
  );
}

/** What the draft world came out as: land, continents, climate, nations and their starting figures. */
export function WorldStats({ stats }: { stats: WorldPreviewStats }) {
  const climate = TREWARTHA_GROUPS.filter((group) => stats.climateMix[group] !== undefined);
  return (
    <Card content="data" padding="sm" aria-label="Draft world statistics">
      <dl className="text-footnote space-y-1">
        <StatRow label="Land share" value={percent(stats.landShare, 1)} />
        <StatRow label="Continents" value={String(stats.continents)} />
        <StatRow label="Nations" value={stats.slotCount > 0 ? String(stats.slotCount) : EMPTY} />
        <StatRow
          label="Population per nation"
          value={stats.baseline ? range(stats.baseline.population, formatCompact) : EMPTY}
        />
        <StatRow
          label="Income per person"
          value={stats.baseline ? range(stats.baseline.gdpPerCapita, dollars) : EMPTY}
        />
      </dl>
      {climate.length > 0 && (
        <dl className="border-separator text-footnote mt-2 space-y-1 border-t pt-2">
          {climate.map((group) => (
            <StatRow
              key={group}
              label={CLIMATE_GROUP_NAMES[group]}
              value={percent(stats.climateMix[group]!)}
            />
          ))}
        </dl>
      )}
    </Card>
  );
}

interface WorldProgressProps {
  view: Pick<WorldGenView, "state" | "message" | "pct" | "error">;
  hasWorld: boolean;
  onGenerate: () => void;
}

/** The run in flight (its stage and how far), the error that ended one, or the button to make the first world. */
export function WorldProgress({ view, hasWorld, onGenerate }: WorldProgressProps) {
  if (view.state === "generating") {
    return (
      <p className="text-label-secondary text-footnote flex items-center gap-2" role="status">
        <SystemRestart
          aria-hidden
          className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
        />
        <span className="min-w-0 truncate">{view.message || "Making the world"}</span>
        <span className="ml-auto tabular-nums">{Math.round(view.pct)}%</span>
      </p>
    );
  }
  if (view.state === "error") {
    return (
      <div className="space-y-2" role="alert">
        <p className="text-destructive text-footnote">
          {view.error ?? "The world could not be made."}
        </p>
        <Button size="sm" variant="outline" onClick={onGenerate}>
          Try again
        </Button>
      </div>
    );
  }
  if (hasWorld) return null;
  return (
    <div className="space-y-2">
      <p className="text-label-secondary text-footnote">
        Preview a generated world on the map, tune it, then use it for this realm.
      </p>
      <Button size="sm" onClick={onGenerate}>
        Generate preview
      </Button>
    </div>
  );
}
