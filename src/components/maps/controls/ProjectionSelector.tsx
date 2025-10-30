import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import type { ProjectionMode } from "~/hooks/maps/useProjectionTransition";
import type { ProjectionType } from "~/types/maps";

interface ProjectionSelectorProps {
  currentProjection: ProjectionType;
  projectionMode: ProjectionMode;
  currentZoom: number;
  onModeChange: (mode: ProjectionMode) => void;
  isTransitioning: boolean;
  compact?: boolean;
}

export function ProjectionSelector({
  currentProjection,
  projectionMode,
  currentZoom,
  onModeChange,
  isTransitioning,
  compact = false,
}: ProjectionSelectorProps) {
  return (
    <Card className="border-gray-200 bg-white shadow-lg">
      <CardContent className="p-3">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-700">Projection Mode</h3>
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant={projectionMode === "auto" ? "default" : "outline"}
              onClick={() => onModeChange("auto")}
              disabled={isTransitioning}
              className="justify-start text-xs"
              title="Google Maps-style: Globe at zoom 0-2, Mercator at zoom 3+"
            >
              Auto (Zoom: {currentZoom.toFixed(1)})
            </Button>
            <Button
              size="sm"
              variant={projectionMode === "mercator" ? "default" : "outline"}
              onClick={() => onModeChange("mercator")}
              disabled={isTransitioning}
              className="justify-start text-xs"
              title="Standard web map projection"
            >
              Mercator
            </Button>
            <Button
              size="sm"
              variant={projectionMode === "globe" ? "default" : "outline"}
              onClick={() => onModeChange("globe")}
              disabled={isTransitioning}
              className="justify-start text-xs"
              title="3D globe view"
            >
              Globe
            </Button>
          </div>
          {!compact && (
            <div className="border-t pt-2">
              <p className="text-xs text-gray-600">
                Current: <span className="font-medium capitalize">{currentProjection}</span>
              </p>
              {isTransitioning && <p className="mt-1 text-xs text-blue-600">Transitioning...</p>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
