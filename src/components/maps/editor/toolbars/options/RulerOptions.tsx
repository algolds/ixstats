"use client";

import React, { memo } from "react";
import { Ruler, Trash as Trash2 } from "iconoir-react";
import { formatDistanceMetrics } from "~/lib/maps/geo-analytics";
import { ToolLabel, ToolbarButton, dividerClass } from "./CoordinateSnappingControls";

interface RulerOptionsProps {
  rulerPoints?: [number, number][];
  rulerDistance?: number;
  onClearRuler?: () => void;
}

export const RulerOptions = memo(function RulerOptions({
  rulerPoints = [],
  rulerDistance = 0,
  onClearRuler,
}: RulerOptionsProps) {
  const pointsCount = rulerPoints.length;
  const metrics = formatDistanceMetrics(rulerDistance);

  return (
    <>
      <ToolLabel icon={Ruler} label="Ruler / Distance" />
      <span className="text-label-secondary text-footnote">
        {pointsCount < 2 ? "Click on the map to place measurement points." : "Total distance:"}
      </span>
      {pointsCount >= 2 && (
        <>
          <span className="text-caption text-cyan font-semibold tabular-nums">{metrics.km} km</span>
          <span className="text-label-secondary text-footnote">
            ({metrics.mi} mi / {metrics.nm} nm)
          </span>
          <span className="text-label-secondary text-footnote">• {pointsCount} points</span>
        </>
      )}
      {pointsCount > 0 && onClearRuler && (
        <>
          <div className={dividerClass} />
          <ToolbarButton onClick={onClearRuler} title="Clear measurement">
            <Trash2 className="h-3 w-3" /> Clear
          </ToolbarButton>
        </>
      )}
    </>
  );
});
