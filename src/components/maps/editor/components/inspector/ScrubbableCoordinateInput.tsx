"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import React, { useState, useRef, useCallback, useEffect } from "react";
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

export const ScrubbableCoordinateInput = React.memo(function ScrubbableCoordinateInput({
  coordinates,
  onChange,
  isPickingLocation = false,
  onTogglePickLocation,
  disabled = false,
}: ScrubbableCoordinateInputProps) {
  const currentLng = coordinates ? coordinates[0] : 0;
  const currentLat = coordinates ? coordinates[1] : 0;

  const [lngText, setLngText] = useState(currentLng.toFixed(4));
  const [latText, setLatText] = useState(currentLat.toFixed(4));
  const [activeScrub, setActiveScrub] = useState<"lng" | "lat" | null>(null);

  const startXRef = useRef(0);
  const startValRef = useRef(0);

  useEffect(() => {
    if (!activeScrub) {
      setLngText(currentLng.toFixed(4));
      setLatText(currentLat.toFixed(4));
    }
  }, [currentLng, currentLat, activeScrub]);

  const handlePointerDown = (axis: "lng" | "lat", e: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled || !coordinates) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    startValRef.current = axis === "lng" ? currentLng : currentLat;
    setActiveScrub(axis);
  };

  const handlePointerMove = (axis: "lng" | "lat", e: React.PointerEvent<HTMLSpanElement>) => {
    if (activeScrub !== axis || !coordinates) return;
    const deltaX = e.clientX - startXRef.current;
    let step = 0.0005;
    if (e.shiftKey) step = 0.005;
    if (e.altKey) step = 0.00005;

    const newVal = startValRef.current + deltaX * step;
    if (axis === "lng") {
      const clamped = Math.max(-180, Math.min(180, newVal));
      onChange([clamped, currentLat]);
      setLngText(clamped.toFixed(4));
    } else {
      const clamped = Math.max(-90, Math.min(90, newVal));
      onChange([currentLng, clamped]);
      setLatText(clamped.toFixed(4));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (activeScrub) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setActiveScrub(null);
    }
  };

  const handleInputBlur = (axis: "lng" | "lat") => {
    if (!coordinates) return;
    const val = parseFloat(axis === "lng" ? lngText : latText);
    if (!isNaN(val)) {
      if (axis === "lng") {
        const clamped = Math.max(-180, Math.min(180, val));
        onChange([clamped, currentLat]);
        setLngText(clamped.toFixed(4));
      } else {
        const clamped = Math.max(-90, Math.min(90, val));
        onChange([currentLng, clamped]);
        setLatText(clamped.toFixed(4));
      }
    } else {
      setLngText(currentLng.toFixed(4));
      setLatText(currentLat.toFixed(4));
    }
  };

  const handleKeyDown = (axis: "lng" | "lat", e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled || !coordinates) return;
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setLngText(currentLng.toFixed(4));
      setLatText(currentLat.toFixed(4));
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const mult = e.shiftKey ? 0.01 : 0.001;
      const dir = e.key === "ArrowUp" ? 1 : -1;
      const current = axis === "lng" ? currentLng : currentLat;
      const newVal = current + dir * mult;
      if (axis === "lng") {
        const clamped = Math.max(-180, Math.min(180, newVal));
        onChange([clamped, currentLat]);
        setLngText(clamped.toFixed(4));
      } else {
        const clamped = Math.max(-90, Math.min(90, newVal));
        onChange([currentLng, clamped]);
        setLatText(clamped.toFixed(4));
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-footnote flex items-center justify-between">
        <Eyebrow>Coordinates</Eyebrow>
        <span className="text-label-secondary text-footnote italic">Drag label or type value</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Longitude */}
        <Card className="focus-within:border-tint focus-within:ring-tint flex flex-1 items-center px-2 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus-within:ring-1">
          <span
            onPointerDown={(e) => handlePointerDown("lng", e)}
            onPointerMove={(e) => handlePointerMove("lng", e)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`text-eyebrow cursor-ew-resize font-mono transition-colors select-none ${
              activeScrub === "lng" ? "text-tint" : "text-label-secondary hover:text-label"
            }`}
            title="Drag horizontally to scrub longitude (Shift for 10x, Alt for 0.1x)"
          >
            Lng
          </span>
          <input
            type="text"
            value={lngText}
            onChange={(e) => setLngText(e.target.value)}
            onBlur={() => handleInputBlur("lng")}
            onKeyDown={(e) => handleKeyDown("lng", e)}
            disabled={disabled || !coordinates}
            className="text-label text-footnote w-full bg-transparent text-right tabular-nums focus:outline-none"
          />
          <span className="text-label-secondary text-footnote ml-0.5">&deg;</span>
        </Card>

        {/* Latitude */}
        <Card className="focus-within:border-tint focus-within:ring-tint flex flex-1 items-center px-2 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus-within:ring-1">
          <span
            onPointerDown={(e) => handlePointerDown("lat", e)}
            onPointerMove={(e) => handlePointerMove("lat", e)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`text-eyebrow cursor-ew-resize font-mono transition-colors select-none ${
              activeScrub === "lat" ? "text-tint" : "text-label-secondary hover:text-label"
            }`}
            title="Drag horizontally to scrub latitude (Shift for 10x, Alt for 0.1x)"
          >
            Lat
          </span>
          <input
            type="text"
            value={latText}
            onChange={(e) => setLatText(e.target.value)}
            onBlur={() => handleInputBlur("lat")}
            onKeyDown={(e) => handleKeyDown("lat", e)}
            disabled={disabled || !coordinates}
            className="text-label text-footnote w-full bg-transparent text-right tabular-nums focus:outline-none"
          />
          <span className="text-label-secondary text-footnote ml-0.5">&deg;</span>
        </Card>

        {/* Crosshair Picker */}
        {onTogglePickLocation && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onTogglePickLocation}
            disabled={disabled}
            title={
              isPickingLocation
                ? "Click anywhere on map to reposition (Active)"
                : "Pick location on map"
            }
            aria-label={
              isPickingLocation
                ? "Click anywhere on map to reposition (Active)"
                : "Pick location on map"
            }
            className={cn(
              "rounded-control-sm size-5",
              `rounded-control flex h-8 w-8 shrink-0 items-center justify-center border transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98] ${
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
