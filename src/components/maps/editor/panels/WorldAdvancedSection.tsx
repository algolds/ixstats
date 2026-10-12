"use client";

import { useId } from "react";
import { NavArrowDown, NavArrowRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { SegmentedControl } from "~/components/ui/segmented-control";
import type { WorldPreset } from "~/lib/worldgen/v2/config";
import { CONTROL_LIMITS, WORLD_PRESET_IDS } from "~/lib/worldgen/world-controls";
import { ControlSlider, SwitchRow, percent, type ControlSectionProps } from "./WorldControlParts";

const PROFILE_LABELS: Record<WorldPreset, string> = {
  earthlike: "Earth-like",
  ixnay: "Flat",
  eurth: "Rugged",
};

const latitude = (degrees: number) => `${Math.abs(degrees)}°${degrees < 0 ? "S" : "N"}`;

/** The rest of the generator's parameters, folded away until asked for. */
export function WorldAdvancedSection({
  controls,
  available,
  onLive,
  onCommit,
}: ControlSectionProps) {
  const profileId = useId();
  const limits = CONTROL_LIMITS;
  const [south, north] = controls.latitudeBand;
  return (
    <Collapsible className="border-separator border-t pt-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group -ml-2 justify-start gap-1 px-2">
          <NavArrowRight aria-hidden className="size-3.5 group-data-[state=open]:hidden" />
          <NavArrowDown aria-hidden className="size-3.5 group-data-[state=closed]:hidden" />
          Advanced
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <ControlSlider
          label="Southern edge of the continents"
          {...limits.latitude}
          value={south}
          display={latitude(south)}
          disabled={!available.latitudeBand}
          onChange={(value) => onLive({ latitudeBand: [value, north] })}
          onCommit={(value) => onCommit({ latitudeBand: [value, north] })}
        />
        <ControlSlider
          label="Northern edge of the continents"
          {...limits.latitude}
          value={north}
          display={latitude(north)}
          disabled={!available.latitudeBand}
          onChange={(value) => onLive({ latitudeBand: [south, value] })}
          onCommit={(value) => onCommit({ latitudeBand: [south, value] })}
        />
        <ControlSlider
          label="Size spread"
          {...limits.sizeSpread}
          value={controls.sizeSpread}
          display={controls.sizeSpread.toFixed(2)}
          ends={["Equal", "A few dominate"]}
          disabled={!available.sizeSpread}
          onChange={(sizeSpread) => onLive({ sizeSpread })}
          onCommit={(sizeSpread) => onCommit({ sizeSpread })}
        />
        <ControlSlider
          label="Islands"
          {...limits.islands}
          value={controls.islands}
          display={percent(controls.islands)}
          disabled={!available.islands}
          onChange={(islands) => onLive({ islands })}
          onCommit={(islands) => onCommit({ islands })}
        />
        <SwitchRow
          label="Polar land in the north"
          checked={controls.polarNorth}
          disabled={!available.polar}
          onCheckedChange={(polarNorth) => onCommit({ polarNorth })}
        />
        <SwitchRow
          label="Polar land in the south"
          checked={controls.polarSouth}
          disabled={!available.polar}
          onCheckedChange={(polarSouth) => onCommit({ polarSouth })}
        />
        <div className="space-y-1">
          <span id={profileId} className="text-label text-footnote">
            Elevation profile
          </span>
          <SegmentedControl
            aria-labelledby={profileId}
            size="sm"
            fullWidth
            value={controls.hypsometry}
            onValueChange={(hypsometry) => onCommit({ hypsometry })}
            options={WORLD_PRESET_IDS.map((id) => ({ value: id, label: PROFILE_LABELS[id] }))}
          />
        </div>
        <ControlSlider
          label="Rivers"
          {...limits.rivers}
          value={controls.rivers}
          display={controls.rivers === 0 ? "None" : `${controls.rivers.toFixed(1)}×`}
          onChange={(rivers) => onLive({ rivers })}
          onCommit={(rivers) => onCommit({ rivers })}
        />
        <ControlSlider
          label="Lakes"
          {...limits.lakes}
          value={controls.lakes}
          display={controls.lakes === 0 ? "None" : percent(controls.lakes, 1)}
          onChange={(lakes) => onLive({ lakes })}
          onCommit={(lakes) => onCommit({ lakes })}
        />
        <ControlSlider
          label="Coast complexity"
          {...limits.coastComplexity}
          value={controls.coastComplexity}
          display={percent(controls.coastComplexity)}
          ends={["Smooth", "Ragged"]}
          disabled={!available.coastComplexity}
          onChange={(coastComplexity) => onLive({ coastComplexity })}
          onCommit={(coastComplexity) => onCommit({ coastComplexity })}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
