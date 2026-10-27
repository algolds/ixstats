"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { City } from "iconoir-react";
import { PopoverContent } from "~/components/ui/popover";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { Slider } from "~/components/ui/slider";

const CITY_TYPES = [
  { value: "city", label: "City" },
  { value: "capital", label: "Capital" },
  { value: "town", label: "Town" },
  { value: "village", label: "Village" },
  { value: "port", label: "Port city" },
];

interface SliderRowProps {
  label: string;
  ariaLabel?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  /** Value readout beside the slider. */
  valueText?: string;
  onApply?: () => void;
  applyVariant?: "secondary";
  /** Readout under the slider. */
  note?: string;
}

function SliderRow({
  label,
  ariaLabel = label,
  min,
  max,
  step,
  value,
  onChange,
  valueText,
  onApply,
  applyVariant,
  note,
}: SliderRowProps) {
  return (
    <div className="space-y-1">
      <Eyebrow className="block">{label}</Eyebrow>
      <div className="flex items-center gap-2">
        <Slider
          aria-label={ariaLabel}
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={([v]) => v !== undefined && onChange(v)}
          className="flex-1 py-2"
        />
        {valueText && (
          <span className="text-caption w-8 text-right font-semibold">{valueText}</span>
        )}
        {onApply && (
          <Button size="xs" variant={applyVariant} type="button" onClick={onApply}>
            Apply
          </Button>
        )}
      </div>
      {note && <div className="text-label-secondary text-footnote">{note}</div>}
    </div>
  );
}

export function CityScatterPopover({
  onScatter,
  defaultPrefix = "City",
}: {
  onScatter: (count: number, type: string, prefix: string) => void;
  defaultPrefix?: string;
}) {
  const [count, setCount] = useState(5);
  const [type, setType] = useState("city");
  const [prefix, setPrefix] = useState(defaultPrefix);

  return (
    <PopoverContent className="w-64 space-y-3 p-3">
      <SliderRow
        label="Scatter count"
        min={1}
        max={50}
        value={count}
        onChange={setCount}
        valueText={String(count)}
      />
      <div className="space-y-1">
        <Eyebrow className="block">City type</Eyebrow>
        <OptionSelect
          aria-label="City type"
          value={type}
          onValueChange={(v) => setType(v)}
          options={CITY_TYPES}
          size="sm"
          className="w-full"
        />
      </div>
      <div className="space-y-1">
        <Eyebrow className="block">Name prefix</Eyebrow>
        <input
          type="text"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          className="border-separator bg-surface text-label focus:ring-tint/50 text-footnote rounded-control-sm h-6 w-full border px-2 outline-none focus:ring-1"
        />
      </div>
      <Button
        size="sm"
        className="w-full justify-center"
        type="button"
        onClick={() => onScatter(count, type, prefix)}
      >
        <City className="h-3 w-3" aria-hidden /> Scatter cities
      </Button>
    </PopoverContent>
  );
}

export function TransformGeometryPopover({
  onApply,
}: {
  onApply: (type: "simplify" | "smooth" | "rotate" | "scale", value: number) => void;
}) {
  const [simplifyVal, setSimplifyVal] = useState(0.001);
  const [rotateVal, setRotateVal] = useState(0);
  const [scaleVal, setScaleVal] = useState(1);

  return (
    <PopoverContent className="w-64 space-y-4 p-3">
      <SliderRow
        label="Simplify tolerance"
        min={0.0001}
        max={0.01}
        step={0.0001}
        value={simplifyVal}
        onChange={setSimplifyVal}
        onApply={() => onApply("simplify", simplifyVal)}
        applyVariant="secondary"
      />
      <div className="space-y-1">
        <Eyebrow className="block">Smooth geometry</Eyebrow>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          type="button"
          onClick={() => onApply("smooth", 1)}
        >
          Smooth Path (Chaikin)
        </Button>
      </div>
      <SliderRow
        label="Rotate (° degrees)"
        min={-180}
        max={180}
        value={rotateVal}
        onChange={setRotateVal}
        valueText={`${rotateVal}°`}
        onApply={() => onApply("rotate", rotateVal)}
        applyVariant="secondary"
      />
      <SliderRow
        label="Scale factor"
        min={0.1}
        max={3.0}
        step={0.1}
        value={scaleVal}
        onChange={setScaleVal}
        valueText={`${scaleVal}x`}
        onApply={() => onApply("scale", scaleVal)}
        applyVariant="secondary"
      />
    </PopoverContent>
  );
}

export function CityTransformationsPopover({
  selectedCitiesCount,
  onScalePopulation,
  onRotateCities,
}: {
  selectedCitiesCount: number;
  onScalePopulation: (factor: number) => void;
  onRotateCities: (angle: number) => void;
}) {
  const [scaleVal, setScaleVal] = useState(1);
  const [rotateVal, setRotateVal] = useState(0);

  return (
    <PopoverContent className="w-64 space-y-4 p-3">
      <SliderRow
        label="Scale population"
        min={0.5}
        max={2.0}
        step={0.1}
        value={scaleVal}
        onChange={setScaleVal}
        onApply={() => onScalePopulation(scaleVal)}
        note={`Factor: ${scaleVal.toFixed(1)}x`}
      />

      {selectedCitiesCount > 1 && (
        <SliderRow
          label="Rotate Group (Degrees)"
          ariaLabel="Rotate group (degrees)"
          min={-180}
          max={180}
          value={rotateVal}
          onChange={setRotateVal}
          onApply={() => onRotateCities(rotateVal)}
          note={`Angle: ${rotateVal}°`}
        />
      )}
    </PopoverContent>
  );
}
