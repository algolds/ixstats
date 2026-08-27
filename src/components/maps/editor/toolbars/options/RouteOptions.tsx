"use client";

import React, { memo } from "react";
import {
  Navigator as Route,
  Check,
  Undo as Undo2,
  ArrowSeparate as ArrowLeftRight,
  Magnet,
} from "iconoir-react";
import { ROUTE_STYLES } from "~/lib/maps/map-config";
import {
  ToolLabel,
  btnClass,
  activeBtnClass,
  labelClass,
  dividerClass,
  selectClass,
} from "./CoordinateSnappingControls";

interface RouteOptionsProps {
  routeTypes?: string[];
  onRouteTypesChange?: (types: string[]) => void;
  onFinishRoute?: () => void;
  onUndoWaypoint?: () => void;
  onReverseRoute?: () => void;
  isSnapEnabled?: boolean;
  onSnapToggle?: () => void;
}

export const RouteOptions = memo(function RouteOptions({
  routeTypes,
  onRouteTypesChange,
  onFinishRoute,
  onUndoWaypoint,
  onReverseRoute,
  isSnapEnabled,
  onSnapToggle,
}: RouteOptionsProps) {
  return (
    <>
      <ToolLabel icon={Route} label="Route" />
      <span className={labelClass}>Type</span>
      <select
        value={routeTypes?.[0] ?? "road"}
        onChange={(e) => onRouteTypesChange?.([e.target.value])}
        className={selectClass}
      >
        {Object.entries(ROUTE_STYLES).map(([key, style]) => (
          <option key={key} value={key}>
            {style.label}
          </option>
        ))}
      </select>
      <div className={dividerClass} />
      {onFinishRoute && (
        <button onClick={onFinishRoute} className={activeBtnClass} title="Finish route (Enter)">
          <Check className="h-3 w-3" /> Finish
        </button>
      )}
      {onUndoWaypoint && (
        <button onClick={onUndoWaypoint} className={btnClass} title="Undo last waypoint (Ctrl+Z)">
          <Undo2 className="h-3 w-3" /> Undo
        </button>
      )}
      {onReverseRoute && (
        <button onClick={onReverseRoute} className={btnClass} title="Reverse route direction">
          <ArrowLeftRight className="h-3 w-3" /> Reverse
        </button>
      )}
      {onSnapToggle && (
        <button
          onClick={onSnapToggle}
          className={isSnapEnabled ? activeBtnClass : btnClass}
          title="Toggle snapping to cities and route nodes"
        >
          <Magnet className="h-3 w-3" /> Snap {isSnapEnabled ? "On" : "Off"}
        </button>
      )}
    </>
  );
});
