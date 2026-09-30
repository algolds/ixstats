"use client";

import React, { useState } from "react";
import { Archery as Crosshair, Navigator as Navigation } from "iconoir-react";
import { Button, type ButtonProps } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { cn } from "~/lib/utils/cn";

export type ToolbarButtonTone = "default" | "active" | "danger";

/** The compact action button used in the editor tool-options bar (Facet `Button`, xs). */
export const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { tone?: ToolbarButtonTone }
>(function ToolbarButton({ tone = "default", className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant={tone === "active" ? "secondary" : "ghost"}
      size="xs"
      aria-pressed={tone === "active" ? true : undefined}
      className={cn(
        "h-6 gap-1 px-1.5 [&_svg]:size-3",
        tone === "default" && "text-muted-foreground",
        tone === "danger" && "text-destructive hover:bg-destructive/10 hover:text-destructive",
        className
      )}
      {...props}
    />
  );
});

export const dividerClass = "bg-border h-4 w-px";
export const selectClass =
  "h-6 rounded border border-border bg-background px-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/50";

export function ToolLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="border-border mr-2 flex items-center gap-1.5 border-r pr-2">
      <Icon className="text-muted-foreground h-3.5 w-3.5" />
      <span className="text-foreground text-xs font-semibold">{label}</span>
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
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handle();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setLng("");
      setLat("");
      e.currentTarget.blur();
    }
  };
  return (
    <div className="flex items-center gap-1">
      <Eyebrow>Move to</Eyebrow>
      <input
        type="number"
        placeholder="Lng"
        value={lng}
        onChange={(e) => setLng(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`${selectClass} w-16`}
        step="any"
      />
      <input
        type="number"
        placeholder="Lat"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`${selectClass} w-16`}
        step="any"
      />
      <ToolbarButton onClick={handle} title="Go">
        <Navigation className="h-3 w-3" />
      </ToolbarButton>
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
      // oxlint-disable-next-line
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleApply();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      if (coords) {
        setLng(coords[0].toString());
        setLat(coords[1].toString());
      }
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Eyebrow>Coord</Eyebrow>
      <input
        type="text"
        placeholder="Lng"
        value={lng}
        onChange={(e) => setLng(e.target.value)}
        onBlur={handleApply}
        onKeyDown={handleKeyDown}
        className={`${selectClass} w-16 text-xs`}
      />
      <input
        type="text"
        placeholder="Lat"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
        onBlur={handleApply}
        onKeyDown={handleKeyDown}
        className={`${selectClass} w-16 text-xs`}
      />

      {onTogglePickingLocation && (
        <ToolbarButton
          tone={isPickingLocation ? "active" : "default"}

          onClick={onTogglePickingLocation}
          title="Reposition with crosshair teleport tool"
        >
          <Crosshair className="h-3 w-3" />
          Teleport
        </ToolbarButton>
      )}

      {onSnapBorder && (
        <ToolbarButton onClick={onSnapBorder} title="Snap to CONTAINING region border">
          Snap to Border
        </ToolbarButton>
      )}

      {onSnapCoast && (
        <ToolbarButton onClick={onSnapCoast} title="Snap to nearest coastline">
          Snap to Coast
        </ToolbarButton>
      )}
    </div>
  );
}
