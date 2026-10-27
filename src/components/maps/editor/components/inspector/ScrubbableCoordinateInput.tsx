"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import React, { useState, useRef } from "react";
import { Pin as Crosshair } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils/cn";
import { Card } from "~/components/ui/card";

interface ScrubbableCoordinateInputProps {
  coordinates?: [number, number] | null;
  onChange: (coords: [number, number]) => void;
  isPickingLocation?: boolean;
  onTogglePickLocation?: () => void;
  disabled?: boolean;
}

const AXES = {
  lng: { label: "Lng", name: "longitude", limit: 180 },
  lat: { label: "Lat", name: "latitude", limit: 90 },
} as const;
type Axis = keyof typeof AXES;

const clampAxis = (axis: Axis, value: number) =>
  Math.max(-AXES[axis].limit, Math.min(AXES[axis].limit, value));

export const ScrubbableCoordinateInput = React.memo(function ScrubbableCoordinateInput({
  coordinates,
  onChange,
  isPickingLocation = false,
  onTogglePickLocation,
  disabled = false,
}: ScrubbableCoordinateInputProps) {
  const current = { lng: coordinates ? coordinates[0] : 0, lat: coordinates ? coordinates[1] : 0 };

  const [texts, setTexts] = useState({ lng: current.lng.toFixed(4), lat: current.lat.toFixed(4) });
  const [activeScrub, setActiveScrub] = useState<Axis | null>(null);

  const startXRef = useRef(0);
  const startValRef = useRef(0);

  const resetTexts = () => setTexts({ lng: current.lng.toFixed(4), lat: current.lat.toFixed(4) });

  // Re-sync the text fields from the coordinates, except while a label is being scrubbed.
  const syncKey = activeScrub ? null : `${current.lng},${current.lat}`;
  const [syncedKey, setSyncedKey] = useState(syncKey);
  if (syncedKey !== syncKey) {
    setSyncedKey(syncKey);
    if (syncKey) resetTexts();
  }

  /** Clamps and applies a new value for one axis, keeping the other axis unchanged. */
  const commit = (axis: Axis, value: number) => {
    const clamped = clampAxis(axis, value);
    onChange(axis === "lng" ? [clamped, current.lat] : [current.lng, clamped]);
    setTexts((t) => ({ ...t, [axis]: clamped.toFixed(4) }));
  };

  const handlePointerDown = (axis: Axis, e: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled || !coordinates) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    startValRef.current = current[axis];
    setActiveScrub(axis);
  };

  const handlePointerMove = (axis: Axis, e: React.PointerEvent<HTMLSpanElement>) => {
    if (activeScrub !== axis || !coordinates) return;
    const step = e.altKey ? 0.00005 : e.shiftKey ? 0.005 : 0.0005;
    commit(axis, startValRef.current + (e.clientX - startXRef.current) * step);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (activeScrub) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setActiveScrub(null);
    }
  };

  const handleInputBlur = (axis: Axis) => {
    if (!coordinates) return;
    const val = parseFloat(texts[axis]);
    if (isNaN(val)) resetTexts();
    else commit(axis, val);
  };

  const handleKeyDown = (axis: Axis, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled || !coordinates) return;
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      resetTexts();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const dir = e.key === "ArrowUp" ? 1 : -1;
      commit(axis, current[axis] + dir * (e.shiftKey ? 0.01 : 0.001));
    }
  };

  const pickerTitle = isPickingLocation
    ? "Click anywhere on map to reposition (Active)"
    : "Pick location on map";

  return (
    <div className="space-y-2">
      <div className="text-footnote flex items-center justify-between">
        <Eyebrow>Coordinates</Eyebrow>
        <span className="text-label-secondary text-footnote italic">Drag label or type value</span>
      </div>

      <div className="flex items-center gap-2">
        {(Object.keys(AXES) as Axis[]).map((axis) => (
          <Card
            key={axis}
            className="focus-within:border-tint focus-within:ring-tint flex flex-1 items-center px-2 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus-within:ring-1"
          >
            <span
              onPointerDown={(e) => handlePointerDown(axis, e)}
              onPointerMove={(e) => handlePointerMove(axis, e)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`text-eyebrow cursor-ew-resize font-mono transition-colors select-none ${
                activeScrub === axis ? "text-tint" : "text-label-secondary hover:text-label"
              }`}
              title={`Drag horizontally to scrub ${AXES[axis].name} (Shift for 10x, Alt for 0.1x)`}
            >
              {AXES[axis].label}
            </span>
            <input
              type="text"
              value={texts[axis]}
              onChange={(e) => setTexts((t) => ({ ...t, [axis]: e.target.value }))}
              onBlur={() => handleInputBlur(axis)}
              onKeyDown={(e) => handleKeyDown(axis, e)}
              disabled={disabled || !coordinates}
              className="text-label text-footnote w-full bg-transparent text-right tabular-nums focus:outline-none"
            />
            <span className="text-label-secondary text-footnote ml-0.5">&deg;</span>
          </Card>
        ))}

        {onTogglePickLocation && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onTogglePickLocation}
            disabled={disabled}
            title={pickerTitle}
            aria-label={pickerTitle}
            className={cn(
              "rounded-control-sm size-5",
              `rounded-control flex h-8 w-8 shrink-0 items-center justify-center border transition-[color,background-color,border-color,box-shadow,opacity] ${
                isPickingLocation
                  ? "bg-tint text-on-tint border-tint shadow-card"
                  : "border-separator bg-fill-4 text-label-secondary hover:bg-fill-3 hover:text-label"
              }`
            )}
          >
            <Crosshair className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
});
