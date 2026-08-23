"use client";

import React, { useState } from "react";
import { Archery as Crosshair, Navigator as Navigation } from "iconoir-react";

export const btnClass =
  "flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-muted-foreground transition-all duration-100 ease-out active:scale-95 hover:bg-accent hover:text-foreground";
export const activeBtnClass =
  "flex h-6 items-center gap-1 rounded bg-primary/10 px-1.5 text-[11px] font-medium text-primary shadow-xs transition-all duration-100 ease-out active:scale-95";
export const dangerBtnClass =
  "flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-red-500 transition-all duration-100 ease-out active:scale-95 hover:bg-red-500/10";
export const labelClass = "text-[10px] font-medium uppercase tracking-wider text-muted-foreground";
export const dividerClass = "bg-border h-4 w-px";
export const selectClass =
  "h-6 rounded border border-border bg-background px-1.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/50";

export function ToolLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="border-border mr-2 flex items-center gap-1.5 border-r pr-2">
      <Icon className="text-muted-foreground h-3.5 w-3.5" />
      <span className="text-foreground text-[11px] font-semibold">{label}</span>
    </div>
  );
}

export function MoveToCoordsInput({ onMove }: { onMove: (lng: number, lat: number) => void }) {
  const [lng, setLng] = useState("");
  const [lat, setLat] = useState("");
  const handle = () => {
    const lngN = parseFloat(lng);
    const latN = parseFloat(lat);
    if (!isNaN(lngN) && !isNaN(latN)) onMove(lngN, latN);
  };
  return (
    <div className="flex items-center gap-1">
      <span className={labelClass}>Move to</span>
      <input
        type="number"
        placeholder="Lng"
        value={lng}
        onChange={(e) => setLng(e.target.value)}
        className={`${selectClass} w-16`}
        step="any"
      />
      <input
        type="number"
        placeholder="Lat"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
        className={`${selectClass} w-16`}
        step="any"
      />
      <button type="button" onClick={handle} className={btnClass} title="Go">
        <Navigation className="h-3 w-3" />
      </button>
    </div>
  );
}

export function CoordinateSnappingControls({
  coords,
  onCoordsChange,
  onSnapBorder,
  onSnapCoast,
  isPickingLocation,
  onTogglePickingLocation,
}: {
  coords?: [number, number];
  onCoordsChange?: (coords: [number, number]) => void;
  onSnapBorder?: () => void;
  onSnapCoast?: () => void;
  isPickingLocation?: boolean;
  onTogglePickingLocation?: () => void;
}) {
  const [lng, setLng] = useState(coords ? coords[0].toString() : "");
  const [lat, setLat] = useState(coords ? coords[1].toString() : "");

  React.useEffect(() => {
    if (coords) {
      setLng(coords[0].toString());
      setLat(coords[1].toString());
    }
  }, [coords]);

  const handleApply = () => {
    const lngN = parseFloat(lng);
    const latN = parseFloat(lat);
    if (!isNaN(lngN) && !isNaN(latN) && onCoordsChange) {
      onCoordsChange([lngN, latN]);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={labelClass}>Coord</span>
      <input
        type="text"
        placeholder="Lng"
        value={lng}
        onChange={(e) => setLng(e.target.value)}
        onBlur={handleApply}
        className={`${selectClass} w-16 text-[10px]`}
      />
      <input
        type="text"
        placeholder="Lat"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
        onBlur={handleApply}
        className={`${selectClass} w-16 text-[10px]`}
      />

      {onTogglePickingLocation && (
        <button
          type="button"
          onClick={onTogglePickingLocation}
          className={isPickingLocation ? activeBtnClass : btnClass}
          title="Reposition with crosshair teleport tool"
        >
          <Crosshair className="h-3 w-3" />
          Teleport
        </button>
      )}

      {onSnapBorder && (
        <button
          type="button"
          onClick={onSnapBorder}
          className={btnClass}
          title="Snap to CONTAINING region border"
        >
          Snap to Border
        </button>
      )}

      {onSnapCoast && (
        <button
          type="button"
          onClick={onSnapCoast}
          className={btnClass}
          title="Snap to nearest coastline"
        >
          Snap to Coast
        </button>
      )}
    </div>
  );
}
