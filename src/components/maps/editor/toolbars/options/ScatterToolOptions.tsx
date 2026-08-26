"use client";

import React, { useState } from "react";
import { Sparks as Sparkles } from "iconoir-react";
import { PopoverContent } from "~/components/ui/popover";
import { Label } from "~/components/ui/label";

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
    <PopoverContent className="bg-popover border-border/50 text-foreground w-64 space-y-3 p-3">
      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Scatter Count
        </Label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="accent-primary h-4 flex-1"
          />
          <span className="w-8 text-right text-[11px] font-semibold">{count}</span>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          City Type
        </Label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border-border bg-background text-foreground focus:ring-primary/50 h-6 w-full rounded border px-1.5 text-[11px] outline-none focus:ring-1"
        >
          {CITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Name Prefix
        </Label>
        <input
          type="text"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          className="border-border bg-background text-foreground focus:ring-primary/50 h-6 w-full rounded border px-1.5 text-[11px] outline-none focus:ring-1"
        />
      </div>
      <button
        type="button"
        onClick={() => onScatter(count, type, prefix)}
        className="bg-primary hover:bg-primary/90 flex h-7 w-full items-center justify-center gap-1 rounded text-[11px] font-medium text-white transition-colors"
      >
        <Sparkles className="h-3 w-3" /> Scatter Cities
      </button>
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
    <PopoverContent className="bg-popover border-border/50 text-foreground w-64 space-y-4 p-3">
      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Simplify Tolerance
        </Label>
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
          <button
            type="button"
            onClick={() => onApply("simplify", simplifyVal)}
            className="bg-primary/10 text-primary hover:bg-primary/20 h-6 rounded px-2 text-[10px]"
          >
            Apply
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Smooth Geometry
        </Label>
        <button
          type="button"
          onClick={() => onApply("smooth", 1)}
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 h-7 w-full rounded text-[11px]"
        >
          Smooth Path (Chaikin)
        </button>
      </div>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Rotate (° degrees)
        </Label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={-180}
            max={180}
            value={rotateVal}
            onChange={(e) => setRotateVal(Number(e.target.value))}
            className="accent-primary h-4 flex-1"
          />
          <span className="w-8 text-right text-[11px] font-semibold">{rotateVal}°</span>
          <button
            type="button"
            onClick={() => onApply("rotate", rotateVal)}
            className="bg-primary/10 text-primary hover:bg-primary/20 h-6 rounded px-2 text-[10px]"
          >
            Apply
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Scale Factor
        </Label>
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
          <span className="w-8 text-right text-[11px] font-semibold">{scaleVal}x</span>
          <button
            type="button"
            onClick={() => onApply("scale", scaleVal)}
            className="bg-primary/10 text-primary hover:bg-primary/20 h-6 rounded px-2 text-[10px]"
          >
            Apply
          </button>
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
    <PopoverContent className="bg-popover border-border/50 text-foreground w-64 space-y-4 p-3">
      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Scale Population
        </Label>
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
          <button
            type="button"
            onClick={() => onScalePopulation(scaleVal)}
            className="bg-primary hover:bg-primary/95 h-6 rounded px-2 text-[10px] text-white"
          >
            Apply
          </button>
        </div>
        <div className="text-muted-foreground text-[9px]">Factor: {scaleVal.toFixed(1)}x</div>
      </div>

      {selectedCitiesCount > 1 && (
        <div className="space-y-1">
          <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Rotate Group (Degrees)
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={-180}
              max={180}
              value={rotateVal}
              onChange={(e) => setRotateVal(Number(e.target.value))}
              className="accent-primary h-4 flex-1"
            />
            <button
              type="button"
              onClick={() => onRotateCities(rotateVal)}
              className="bg-primary hover:bg-primary/95 h-6 rounded px-2 text-[10px] text-white"
            >
              Apply
            </button>
          </div>
          <div className="text-muted-foreground text-[9px]">Angle: {rotateVal}°</div>
        </div>
      )}
    </PopoverContent>
  );
}
