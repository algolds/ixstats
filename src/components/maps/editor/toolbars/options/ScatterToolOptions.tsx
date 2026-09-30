"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { City } from "iconoir-react";
import { PopoverContent } from "~/components/ui/popover";

const CITY_TYPES = [
  { value: "city", label: "City" },
  { value: "capital", label: "Capital" },
  { value: "town", label: "Town" },
  { value: "village", label: "Village" },
  { value: "port", label: "Port City" },
];

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
      <div className="space-y-1">
        <Eyebrow className="block">Scatter Count</Eyebrow>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="accent-primary h-4 flex-1"
          />
          <span className="w-8 text-right text-xs font-semibold">{count}</span>
        </div>
      </div>
      <div className="space-y-1">
        <Eyebrow className="block">City Type</Eyebrow>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border-border bg-background text-foreground focus:ring-primary/50 h-6 w-full rounded border px-1.5 text-xs outline-none focus:ring-1"
        >
          {CITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Eyebrow className="block">Name Prefix</Eyebrow>
        <input
          type="text"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          className="border-border bg-background text-foreground focus:ring-primary/50 h-6 w-full rounded border px-1.5 text-xs outline-none focus:ring-1"
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
      <div className="space-y-1">
        <Eyebrow className="block">Simplify Tolerance</Eyebrow>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.0001}
            max={0.01}
            step={0.0001}
            value={simplifyVal}
            onChange={(e) => setSimplifyVal(Number(e.target.value))}
            className="accent-primary h-4 flex-1"
          />
          <Button
            variant="secondary"
            size="xs"
            type="button"
            onClick={() => onApply("simplify", simplifyVal)}
          >
            Apply
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <Eyebrow className="block">Smooth Geometry</Eyebrow>
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
      <div className="space-y-1">
        <Eyebrow className="block">Rotate (° degrees)</Eyebrow>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={-180}
            max={180}
            value={rotateVal}
            onChange={(e) => setRotateVal(Number(e.target.value))}
            className="accent-primary h-4 flex-1"
          />
          <span className="w-8 text-right text-xs font-semibold">{rotateVal}°</span>
          <Button
            variant="secondary"
            size="xs"
            type="button"
            onClick={() => onApply("rotate", rotateVal)}
          >
            Apply
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <Eyebrow className="block">Scale Factor</Eyebrow>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.1}
            max={3.0}
            step={0.1}
            value={scaleVal}
            onChange={(e) => setScaleVal(Number(e.target.value))}
            className="accent-primary h-4 flex-1"
          />
          <span className="w-8 text-right text-xs font-semibold">{scaleVal}x</span>
          <Button
            variant="secondary"
            size="xs"
            type="button"
            onClick={() => onApply("scale", scaleVal)}
          >
            Apply
          </Button>
        </div>
      </div>
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
      <div className="space-y-1">
        <Eyebrow className="block">Scale Population</Eyebrow>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={scaleVal}
            onChange={(e) => setScaleVal(Number(e.target.value))}
            className="accent-primary h-4 flex-1"
          />
          <Button size="xs" type="button" onClick={() => onScalePopulation(scaleVal)}>
            Apply
          </Button>
        </div>
        <div className="text-muted-foreground text-xs">Factor: {scaleVal.toFixed(1)}x</div>
      </div>

      {selectedCitiesCount > 1 && (
        <div className="space-y-1">
          <Eyebrow className="block">Rotate Group (Degrees)</Eyebrow>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={-180}
              max={180}
              value={rotateVal}
              onChange={(e) => setRotateVal(Number(e.target.value))}
              className="accent-primary h-4 flex-1"
            />
            <Button size="xs" type="button" onClick={() => onRotateCities(rotateVal)}>
              Apply
            </Button>
          </div>
          <div className="text-muted-foreground text-xs">Angle: {rotateVal}°</div>
        </div>
      )}
    </PopoverContent>
  );
}
