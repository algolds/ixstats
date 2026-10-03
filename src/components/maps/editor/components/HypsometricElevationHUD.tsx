"use client";

import { FacetMaterial } from "~/components/ui/facet";
import { Button } from "~/components/ui/button";
import React from "react";
import { ModernTv as Mountain, Xmark as X } from "iconoir-react";
import { useTransientMapStore } from "~/components/maps/editor/utils/transientStore";

interface HypsometricElevationHUDProps {
  onClose?: () => void;
}

/** Live terrain (elevation zone + climate) under the cursor while measuring with the ruler. */
export function HypsometricElevationHUD({ onClose }: HypsometricElevationHUDProps) {
  const liveTerrain = useTransientMapStore((s) => s.terrainInfo);

  if (!liveTerrain) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-9 left-1/2 z-40 -translate-x-1/2">
      <FacetMaterial material="regular" className="text-label rounded-row flex flex-col p-3">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Mountain className="text-label-secondary h-4 w-4" aria-hidden />
            <h4 className="text-caption font-semibold">Terrain at cursor</h4>
          </div>

          <div className="flex items-center gap-2">
            {liveTerrain.elevation && (
              <span className="border-separator bg-fill-3 text-label-secondary rounded-control-sm text-footnote border px-2 py-0.5 tabular-nums">
                {liveTerrain.elevation}
              </span>
            )}
            {liveTerrain.climate && (
              <span className="border-separator text-label rounded-control-sm text-footnote border px-2 py-0.5 tabular-nums">
                {liveTerrain.climate}
              </span>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="text-label-secondary h-6 w-6"
                onClick={onClose}
                aria-label="Close terrain readout"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </FacetMaterial>
    </div>
  );
}
