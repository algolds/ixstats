"use client";
import React from "react";
import { MapPin } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

interface CoordinatePickerProps {
  /** [lng, lat] of the feature, or of the point just picked on the map. */
  coordinates: [number, number] | null | undefined;
  isPickingLocation: boolean;
  setIsPickingLocation?: (active: boolean) => void;
}

/** Shows where a feature sits and lets the user re-pick it on the map. */
export function CoordinatePicker({
  coordinates,
  isPickingLocation,
  setIsPickingLocation,
}: CoordinatePickerProps) {
  return (
    <Card className="text-footnote flex items-center justify-between px-3 py-2">
      <div className="text-label-secondary text-left font-medium">
        Coordinates:{" "}
        {coordinates ? (
          <span className="text-label font-semibold tabular-nums">
            {coordinates[1].toFixed(4)}&deg; N, {coordinates[0].toFixed(4)}&deg; E
          </span>
        ) : (
          <span className="italic">Not placed yet</span>
        )}
      </div>
      <Button
        type="button"
        variant={isPickingLocation ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={isPickingLocation}
        onClick={() => setIsPickingLocation?.(!isPickingLocation)}
        className="shrink-0"
      >
        <MapPin className="size-3.5" aria-hidden />
        <span>{isPickingLocation ? "Click on Map..." : "Pick on Map"}</span>
      </Button>
    </Card>
  );
}
