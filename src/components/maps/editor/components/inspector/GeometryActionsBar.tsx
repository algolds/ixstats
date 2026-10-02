"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import {
  Eye,
  Copy,
  Trash,
  Crown,
  SeaWaves as Waves,
  RefreshDouble as Reverse,
  Magnet,
  Maximize,
} from "iconoir-react";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { Card } from "~/components/ui/card";

interface GeometryActionsBarProps {
  feature: EditorFeature;
  onCenter?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onPromoteCapital?: () => void;
  onSnapCoastline?: () => void;
  onReverseRoute?: () => void;
  onPathfinderOperation?: (op: "union" | "subtract" | "intersect") => void;
  disabled?: boolean;
}

export const GeometryActionsBar = React.memo(function GeometryActionsBar({
  feature,
  onCenter,
  onDuplicate,
  onDelete,
  onPromoteCapital,
  onSnapCoastline,
  onReverseRoute,
  onPathfinderOperation,
  disabled = false,
}: GeometryActionsBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isCity = feature.type === "city";
  const isRegion = feature.type === "subdivision";
  const isRoute = feature.type === "route";
  const isCapital = isCity && feature.properties?.isNationalCapital === true;

  return (
    <div className="space-y-2 select-none">
      <div className="grid grid-cols-2 gap-2">
        {/* Center on Map */}
        {onCenter && (
          <Button
            variant="outline"
            size="sm"
            className="justify-center"
            type="button"
            onClick={onCenter}
            disabled={disabled}
          >
            <Eye className="text-tint h-3.5 w-3.5" />
            <span>Center on map</span>
          </Button>
        )}

        {/* Duplicate Feature */}
        {onDuplicate && (
          <Button
            variant="outline"
            size="sm"
            className="justify-center"
            type="button"
            onClick={onDuplicate}
            disabled={disabled}
          >
            <Copy className="h-3.5 w-3.5 opacity-70" />
            <span>Duplicate</span>
          </Button>
        )}

        {/* City: Promote to Capital */}
        {isCity && onPromoteCapital && !isCapital && (
          <Button
            variant="outline"
            size="sm"
            className="justify-center"
            type="button"
            onClick={onPromoteCapital}
            disabled={disabled}
          >
            <Crown className="h-3.5 w-3.5" />
            <span>Make Capital</span>
          </Button>
        )}

        {/* City: Snap to Coastline */}
        {isCity && onSnapCoastline && (
          <Button
            variant="outline"
            size="sm"
            className="justify-center"
            type="button"
            onClick={onSnapCoastline}
            disabled={disabled}
          >
            <Waves className="text-cyan h-3.5 w-3.5" />
            <span>Snap Coast</span>
          </Button>
        )}

        {/* Route: Reverse Direction */}
        {isRoute && onReverseRoute && (
          <Button
            variant="outline"
            size="sm"
            className="justify-center"
            type="button"
            onClick={onReverseRoute}
            disabled={disabled}
          >
            <Reverse className="text-blue h-3.5 w-3.5" />
            <span>Reverse</span>
          </Button>
        )}

        {/* Delete button (with 2-click confirmation) */}
        {onDelete && (
          <div className={confirmDelete ? "col-span-2" : "col-span-1"}>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 justify-center"
                  type="button"
                  onClick={() => {
                    onDelete();
                    setConfirmDelete(false);
                  }}
                  disabled={disabled}
                >
                  <Trash className="h-3.5 w-3.5" />
                  <span>Confirm Delete</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full justify-center"
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={disabled}
              >
                <Trash className="h-3.5 w-3.5" />
                <span>Delete</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Region Pathfinder Operations */}
      {isRegion && onPathfinderOperation && (
        <Card className="space-y-2 p-2">
          <Eyebrow>Combine regions</Eyebrow>
          <div className="grid grid-cols-3 gap-1">
            <Button
              variant="outline"
              size="xs"
              type="button"
              onClick={() => onPathfinderOperation("union")}
              disabled={disabled}
            >
              Union
            </Button>
            <Button
              variant="outline"
              size="xs"
              type="button"
              onClick={() => onPathfinderOperation("subtract")}
              disabled={disabled}
            >
              Subtract
            </Button>
            <Button
              variant="outline"
              size="xs"
              type="button"
              onClick={() => onPathfinderOperation("intersect")}
              disabled={disabled}
            >
              Intersect
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
});
