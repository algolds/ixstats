"use client";

import React, { memo } from "react";
import { Ruler, Trash2 } from "lucide-react";
import { formatDistanceMetrics } from "~/lib/maps/geo-analytics";
import {
  ToolLabel,
  btnClass,
  dividerClass,
  labelClass,
} from "./CoordinateSnappingControls";

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
      <span className={labelClass}>
        {pointsCount < 2 ? "Click on the map to place measurement points." : "Total Distance:"}
      </span>
      {pointsCount >= 2 && (
        <>
          <span className="font-mono text-[11px] font-semibold text-cyan-500">
            {metrics.km} km
          </span>
          <span className="text-muted-foreground text-[10px]">
            ({metrics.mi} mi / {metrics.nm} nm)
          </span>
          <span className="text-muted-foreground text-[10px]">
            • {pointsCount} points
          </span>
        </>
      )}
      {pointsCount > 0 && onClearRuler && (
        <>
          <div className={dividerClass} />
          <button onClick={onClearRuler} className={btnClass} title="Clear measurement">
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        </>
      )}
    </>
  );
});
