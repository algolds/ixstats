"use client";

import { useState } from "react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ControlSlider, SwitchRow } from "~/components/maps/editor/panels/WorldControlParts";
import {
  DEVELOPMENT_LEVELS,
  PARAM_RANGES,
  patchOf,
  sameValue,
  type FieldSpec,
  type StudioKey,
  type StudioParams,
} from "~/lib/worldgen/studio-fields";
import { StudioFieldFrame } from "./StudioFieldFrame";
import { HypsometryField } from "./StudioHypsometry";

export interface StudioFieldProps {
  spec: FieldSpec;
  params: StudioParams;
  /** The chosen preset's values */
  base: StudioParams;
  /** A world fitted to a realm's map: the fields the map decides are off */
  fitting: boolean;
  onCommit: (patch: Partial<StudioParams>) => void;
  onReset: (keys: readonly StudioKey[]) => void;
}

interface LiveSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  ends?: readonly [string, string];
  disabled?: boolean;
  onCommit: (value: number) => void;
}

/**
 * A slider whose readout follows the drag while the rail's value waits for the release (or the end of a key burst):
 * only a commit reaches the recipe, so only a commit asks the generator for a world.
 */
function LiveSlider({ value, format, onCommit, ...rest }: LiveSliderProps) {
  const [live, setLive] = useState<number | null>(null);
  const shown = live ?? value;
  return (
    <ControlSlider
      {...rest}
      value={shown}
      display={format(shown)}
      onChange={setLive}
      onCommit={(next) => {
        setLive(null);
        onCommit(next);
      }}
    />
  );
}

function SliderField({ spec, params, base, fitting, onCommit, onReset }: StudioFieldProps) {
  if (spec.kind !== "slider") return null;
  const { key, label, format, ends, fromMap } = spec;
  const range = PARAM_RANGES[key];
  const off = fitting && !!fromMap;
  return (
    <StudioFieldFrame
      label={label}
      range={`${format(range.min)} to ${format(range.max)}`}
      preset={format(base[key])}
      changed={!sameValue(params[key], base[key])}
      fromMap={off}
      onReset={() => onReset([key])}
    >
      <LiveSlider
        label={label}
        {...range}
        value={params[key]}
        format={format}
        ends={ends}
        disabled={off}
        onCommit={(value) => onCommit(patchOf(key, value))}
      />
    </StudioFieldFrame>
  );
}

function RangeField({ spec, params, base, fitting, onCommit, onReset }: StudioFieldProps) {
  if (spec.kind !== "range") return null;
  const { key, label, format, ends, fromMap } = spec;
  const range = PARAM_RANGES[key];
  const [low, high] = params[key];
  const [presetLow, presetHigh] = base[key];
  const off = fitting && !!fromMap;
  // The ends cannot cross: moving one past the other pushes the other along
  const commitLow = (value: number) => onCommit(patchOf(key, [value, Math.max(value, high)]));
  const commitHigh = (value: number) => onCommit(patchOf(key, [Math.min(low, value), value]));
  return (
    <StudioFieldFrame
      label={label}
      range={`${format(range.min)} to ${format(range.max)}`}
      preset={`${format(presetLow)} to ${format(presetHigh)}`}
      changed={!sameValue(params[key], base[key])}
      fromMap={off}
      onReset={() => onReset([key])}
    >
      <div className="space-y-1">
        <LiveSlider
          label={`${label}, ${ends[0].toLowerCase()}`}
          {...range}
          value={low}
          format={format}
          disabled={off}
          onCommit={commitLow}
        />
        <LiveSlider
          label={`${label}, ${ends[1].toLowerCase()}`}
          {...range}
          value={high}
          format={format}
          disabled={off}
          onCommit={commitHigh}
        />
      </div>
    </StudioFieldFrame>
  );
}

const onOff = (on: boolean) => (on ? "on" : "off");

function SwitchField({ spec, params, base, onCommit, onReset }: StudioFieldProps) {
  if (spec.kind !== "switch") return null;
  const { key, label } = spec;
  return (
    <StudioFieldFrame
      label={label}
      range="on or off"
      preset={onOff(base[key])}
      changed={params[key] !== base[key]}
      onReset={() => onReset([key])}
    >
      <SwitchRow
        label={label}
        checked={params[key]}
        onCheckedChange={(on) => onCommit(patchOf(key, on))}
      />
    </StudioFieldFrame>
  );
}

function PolarField({ spec, params, base, fitting, onCommit, onReset }: StudioFieldProps) {
  if (spec.kind !== "polar") return null;
  const off = fitting && !!spec.fromMap;
  const { north, south } = params.polarLand;
  return (
    <StudioFieldFrame
      label={spec.label}
      range="north and south"
      preset={`north ${onOff(base.polarLand.north)}, south ${onOff(base.polarLand.south)}`}
      changed={!sameValue(params.polarLand, base.polarLand)}
      fromMap={off}
      onReset={() => onReset(["polarLand"])}
    >
      <div className="space-y-1">
        <SwitchRow
          label="Polar land in the north"
          checked={north}
          disabled={off}
          onCheckedChange={(on) => onCommit({ polarLand: { north: on, south } })}
        />
        <SwitchRow
          label="Polar land in the south"
          checked={south}
          disabled={off}
          onCheckedChange={(on) => onCommit({ polarLand: { north, south: on } })}
        />
      </div>
    </StudioFieldFrame>
  );
}

function ChoiceField({ spec, params, base, onCommit, onReset }: StudioFieldProps) {
  if (spec.kind !== "choice") return null;
  const { key, label } = spec;
  return (
    <StudioFieldFrame
      label={label}
      range="three levels"
      preset={base[key]}
      changed={params[key] !== base[key]}
      onReset={() => onReset([key])}
    >
      <div className="space-y-1">
        <span className="text-label text-footnote">{label}</span>
        <SegmentedControl
          aria-label={label}
          size="sm"
          fullWidth
          value={params[key]}
          onValueChange={(value) => onCommit(patchOf(key, value))}
          options={DEVELOPMENT_LEVELS}
        />
      </div>
    </StudioFieldFrame>
  );
}

/** One parameter's control, by the kind of field it is. */
export function StudioField(props: StudioFieldProps) {
  switch (props.spec.kind) {
    case "slider":
      return <SliderField {...props} />;
    case "range":
      return <RangeField {...props} />;
    case "switch":
      return <SwitchField {...props} />;
    case "polar":
      return <PolarField {...props} />;
    case "choice":
      return <ChoiceField {...props} />;
    case "hypsometry":
      return <HypsometryField {...props} />;
  }
}
