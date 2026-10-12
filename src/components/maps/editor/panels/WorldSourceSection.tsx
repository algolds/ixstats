"use client";

import { useId } from "react";
import Link from "next/link";
import { DiceFive } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { realmManageHref } from "~/lib/maps/realm-world-editor";
import type { WorldPreset } from "~/lib/worldgen/v2/config";
import {
  WORLD_PRESET_IDS,
  type WorldControls,
  type WorldSource,
} from "~/lib/worldgen/world-controls";

const PRESET_LABELS: Record<WorldPreset, string> = {
  earthlike: "Earth-like",
  ixnay: "Ixnay",
  eurth: "Eurth",
};

/** Whether the realm's own map can stand in as the source: it has borders, and they have loaded. */
export type RealmMapState = "none" | "loading" | "ready";

const MAX_SEED = 2 ** 31 - 1;

interface WorldSourceSectionProps {
  controls: Pick<WorldControls, "source" | "preset">;
  seed: number;
  realmMap: RealmMapState;
  /** The realm's slug, for the link to Map import */
  realmSlug: string | null;
  onPickSource: (source: WorldSource) => void;
  onPickPreset: (preset: WorldPreset) => void;
  onCommitSeed: (seed: number) => void;
  onReroll: () => void;
}

export function WorldSourceSection({
  controls,
  seed,
  realmMap,
  realmSlug,
  onPickSource,
  onPickPreset,
  onCommitSeed,
  onReroll,
}: WorldSourceSectionProps) {
  const seedId = useId();
  const sourceId = useId();
  const commitSeed = (text: string) => {
    const next = Number(text);
    if (Number.isInteger(next) && next >= 1 && next <= MAX_SEED && next !== seed)
      onCommitSeed(next);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <span id={sourceId} className="text-label text-footnote">
          Source
        </span>
        <SegmentedControl
          aria-labelledby={sourceId}
          size="sm"
          fullWidth
          value={controls.source}
          onValueChange={onPickSource}
          options={[
            { value: "preset", label: "Preset" },
            { value: "realm-map", label: "This realm's map", disabled: realmMap !== "ready" },
          ]}
        />
        {realmMap === "none" && (
          <p className="text-label-secondary text-caption">
            This realm has no map to build on yet.{" "}
            {realmSlug && (
              <Link className="text-tint underline" href={realmManageHref(realmSlug, "map-import")}>
                Import one under Map import
              </Link>
            )}
          </p>
        )}
        {realmMap === "loading" && (
          <p className="text-label-secondary text-caption">Loading the realm's map.</p>
        )}
        {controls.source === "preset" && (
          <SegmentedControl
            aria-label="Preset"
            size="sm"
            fullWidth
            value={controls.preset}
            onValueChange={onPickPreset}
            options={WORLD_PRESET_IDS.map((id) => ({ value: id, label: PRESET_LABELS[id] }))}
          />
        )}
        {controls.source === "realm-map" && (
          <p className="text-label-secondary text-caption">
            The land and the borders stay as the realm drew them. Climate, rivers, lakes and
            elevation are generated around them.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor={seedId} className="text-footnote">
          Seed
        </Label>
        <div className="flex items-center gap-2">
          {/* Re-keyed by the seed, so a reroll replaces what was typed */}
          <Input
            key={seed}
            id={seedId}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_SEED}
            defaultValue={seed}
            onBlur={(event) => commitSeed(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitSeed(event.currentTarget.value);
            }}
            className="tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onReroll}
            aria-label="Reroll seed"
            title="Reroll seed"
          >
            <DiceFive aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
