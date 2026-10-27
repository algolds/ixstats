"use client";

import { useId } from "react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import type { DevelopmentLevel } from "~/lib/worldgen/v2/types";
import { CONTROL_LIMITS } from "~/lib/worldgen/world-controls";
import { ControlSlider, percent, signed, type ControlSectionProps } from "./WorldControlParts";

const LEVELS: { value: DevelopmentLevel; label: string }[] = [
  { value: "developing", label: "Developing" },
  { value: "industrial", label: "Industrial" },
  { value: "modern", label: "Modern" },
];

/** The sliders every world has: continents, land share, nations, temperature, rainfall; and the development level. */
export function WorldBasicControls({ controls, available, onLive, onCommit }: ControlSectionProps) {
  const levelId = useId();
  const limits = CONTROL_LIMITS;
  return (
    <div className="space-y-3">
      <ControlSlider
        label="Continents"
        {...limits.continents}
        value={controls.continents}
        display={String(controls.continents)}
        disabled={!available.continents}
        onChange={(continents) => onLive({ continents })}
        onCommit={(continents) => onCommit({ continents })}
      />
      <ControlSlider
        label="Land share"
        {...limits.landShare}
        value={controls.landShare}
        display={percent(controls.landShare)}
        disabled={!available.landShare}
        onChange={(landShare) => onLive({ landShare })}
        onCommit={(landShare) => onCommit({ landShare })}
      />
      <ControlSlider
        label="Nations"
        {...limits.nations}
        value={controls.nations}
        display={String(controls.nations)}
        disabled={!available.nations}
        onChange={(nations) => onLive({ nations })}
        onCommit={(nations) => onCommit({ nations })}
      />
      <ControlSlider
        label="Temperature"
        {...limits.temperature}
        value={controls.temperature}
        display={signed(controls.temperature, " °C")}
        ends={["Colder", "Warmer"]}
        onChange={(temperature) => onLive({ temperature })}
        onCommit={(temperature) => onCommit({ temperature })}
      />
      <ControlSlider
        label="Rainfall"
        {...limits.rainfall}
        value={controls.rainfall}
        display={`${controls.rainfall.toFixed(2)}×`}
        ends={["Drier", "Wetter"]}
        onChange={(rainfall) => onLive({ rainfall })}
        onCommit={(rainfall) => onCommit({ rainfall })}
      />
      <div className="space-y-1">
        <span id={levelId} className="text-label text-footnote">
          Development level
        </span>
        <SegmentedControl
          aria-labelledby={levelId}
          size="sm"
          fullWidth
          value={controls.developmentLevel}
          onValueChange={(developmentLevel) => onCommit({ developmentLevel })}
          options={LEVELS}
        />
        <p className="text-label-secondary text-caption">
          Sets the starting population and income of the nations.
        </p>
      </div>
    </div>
  );
}
