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

const PATHFINDER_OPS = [
  { op: "union", label: "Union" },
  { op: "subtract", label: "Subtract" },
  { op: "intersect", label: "Intersect" },
] as const;

function ActionButton({
  icon,
  label,
  ...props
}: { icon: React.ReactNode; label: string } & Omit<
  React.ComponentProps<typeof Button>,
  "variant" | "size" | "children" | "type"
>) {
  return (
    <Button variant="outline" size="sm" className="justify-center" type="button" {...props}>
      {icon}
      <span>{label}</span>
    </Button>
  );
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
  const isCapital = isCity && feature.properties?.isNationalCapital === true;

  return (
    <div className="space-y-2 select-none">
      <div className="grid grid-cols-2 gap-2">
        {onCenter && (
          <ActionButton
            icon={<Eye className="text-tint h-3.5 w-3.5" />}
            label="Center on map"
            onClick={onCenter}
            disabled={disabled}
          />
        )}

        {onDuplicate && (
          <ActionButton
            icon={<Copy className="h-3.5 w-3.5 opacity-70" />}
            label="Duplicate"
            onClick={onDuplicate}
            disabled={disabled}
          />
        )}

        {isCity && onPromoteCapital && !isCapital && (
          <ActionButton
            icon={<Crown className="h-3.5 w-3.5" />}
            label="Make capital"
            onClick={onPromoteCapital}
            disabled={disabled}
          />
        )}

        {isCity && onSnapCoastline && (
          <ActionButton
            icon={<Waves className="text-cyan h-3.5 w-3.5" />}
            label="Snap coast"
            onClick={onSnapCoastline}
            disabled={disabled}
          />
        )}

        {feature.type === "route" && onReverseRoute && (
          <ActionButton
            icon={<Reverse className="text-blue h-3.5 w-3.5" />}
            label="Reverse"
            onClick={onReverseRoute}
            disabled={disabled}
          />
        )}

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
                  <span>Confirm delete</span>
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

      {feature.type === "subdivision" && onPathfinderOperation && (
        <Card className="space-y-2 p-2">
          <Eyebrow>Combine regions</Eyebrow>
          <div className="grid grid-cols-3 gap-1">
            {PATHFINDER_OPS.map(({ op, label }) => (
              <Button
                key={op}
                variant="outline"
                size="xs"
                type="button"
                onClick={() => onPathfinderOperation(op)}
                disabled={disabled}
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
});
