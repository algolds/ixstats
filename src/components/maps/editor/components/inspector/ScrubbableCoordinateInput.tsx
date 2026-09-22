"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Pin as Crosshair } from "iconoir-react";

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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground font-medium tracking-wider uppercase text-[10px]">
          Coordinates
        </span>
        <span className="text-muted-foreground/60 text-[9px] italic">
          Drag label or type value
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Longitude */}
        <div className="border-border/60 bg-muted/20 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary flex flex-1 items-center rounded-lg border px-2 py-1 transition-all">
          <span
            onPointerDown={(e) => handlePointerDown("lng", e)}
            onPointerMove={(e) => handlePointerMove("lng", e)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`cursor-ew-resize font-mono text-[10px] font-semibold tracking-wider uppercase select-none transition-colors ${
              activeScrub === "lng"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
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
            className="text-foreground w-full bg-transparent text-right font-mono text-xs tabular-nums focus:outline-none"
          />
          <span className="text-muted-foreground/60 ml-0.5 text-[10px]">&deg;</span>
        </div>

        {/* Latitude */}
        <div className="border-border/60 bg-muted/20 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary flex flex-1 items-center rounded-lg border px-2 py-1 transition-all">
          <span
            onPointerDown={(e) => handlePointerDown("lat", e)}
            onPointerMove={(e) => handlePointerMove("lat", e)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`cursor-ew-resize font-mono text-[10px] font-semibold tracking-wider uppercase select-none transition-colors ${
              activeScrub === "lat"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
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
            className="text-foreground w-full bg-transparent text-right font-mono text-xs tabular-nums focus:outline-none"
          />
          <span className="text-muted-foreground/60 ml-0.5 text-[10px]">&deg;</span>
        </div>

        {/* Crosshair Picker */}
        {onTogglePickLocation && (
          <button
            type="button"
            onClick={onTogglePickLocation}
            disabled={disabled}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-[0.98] ${
              isPickingLocation
                ? "bg-primary text-primary-foreground border-primary shadow-sm animate-pulse"
                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            }`}
            title={
              isPickingLocation
                ? "Click anywhere on map to reposition (Active)"
                : "Pick location on map"
            }
          >
            <Crosshair className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
});
