"use client";

import React, { useState } from "react";
import {
  Compress as Minimize2,
  Train,
  Refresh as RefreshCw,
  Settings,
  Upload as FileUp,
  Magnet,
  Download,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils/cn";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Switch } from "~/components/ui/switch";
import { Slider } from "~/components/ui/slider";
import type { RouteType } from "~/lib/economy/transport-generator";
import type { MapEditorInstance } from "../types/editor-state";

export interface SimplifyAllMutation {
  isPending: boolean;
  mutateAsync: (args: { countryId: string; targetVerticesPerProvince?: number }) => Promise<{
    updated: number;
    total: number;
    verticesBefore: number;
    verticesAfter: number;
    reduction: number;
  }>;
}

export interface TransportMutation {
  isPending: boolean;
  mutateAsync: (args: {
    countryId: string;
    routeTypes?: RouteType[];
    clearExisting?: boolean;
    force?: boolean;
  }) => Promise<{ routesCreated: number; hubsCreated?: number; totalLengthKm: number }>;
}

export interface RecalculateGeoMutation {
  isPending: boolean;
  mutateAsync: (args?: { countryId?: string } | void) => Promise<
    | {
        processed: number;
        failed: number;
        total: number;
        errors: string[];
      }
    | { success?: boolean }
    | void
  >;
}

interface EditorSettingsPopoverProps {
  editor: MapEditorInstance;
  isWorldMode: boolean;
  isAdmin: boolean;
  activeCountryId: string | null;
  generateTransport: TransportMutation;
  recalculateGeo: RecalculateGeoMutation;
  simplifyAll: SimplifyAllMutation;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  snapTolerance: number;
  setSnapTolerance: (v: number) => void;
  panelsLocked: boolean;
  setPanelsLocked: (v: boolean) => void;
  onImportGeoJSON: () => void;
  onExportGeoJSON: () => void;
}

function MenuItem({
  icon,
  label,
  shortcut,
  ...props
}: { icon: React.ReactNode; label: string; shortcut?: string } & Omit<
  React.ComponentProps<typeof Button>,
  "variant" | "size" | "children"
>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-label-secondary w-full justify-start px-2"
      {...props}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {shortcut && (
        <span className="bg-fill-3 text-label-secondary text-footnote rounded-control-sm ml-auto px-1 tabular-nums">
          {shortcut}
        </span>
      )}
    </Button>
  );
}

function SwitchRow({
  icon,
  label,
  checked,
  onCheckedChange,
  ariaLabel,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <>
      <div className="border-separator my-1 border-t" aria-hidden />
      <div className="flex items-center justify-between px-2 py-2">
        <Eyebrow className="flex items-center gap-2">
          {icon}
          {label}
        </Eyebrow>
        <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={ariaLabel} />
      </div>
    </>
  );
}

const ICON = "h-3.5 w-3.5 shrink-0";

export function EditorSettingsPopover({
  editor,
  isWorldMode,
  isAdmin,
  activeCountryId,
  generateTransport,
  recalculateGeo,
  simplifyAll,
  snapEnabled,
  setSnapEnabled,
  snapTolerance,
  setSnapTolerance,
  panelsLocked,
  setPanelsLocked,
  onImportGeoJSON,
  onExportGeoJSON,
}: EditorSettingsPopoverProps) {
  const notify = useNotify();
  const [isOpen, setIsOpen] = useState(false);

  /** Closes the popover, then runs a server action, reporting its outcome as a toast. */
  const run = async (errorLabel: string, action: () => Promise<string>) => {
    setIsOpen(false);
    try {
      notify.success(await action());
    } catch (e) {
      notify.error(`${errorLabel}: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };
  const closeThen = (fn: () => void) => () => {
    setIsOpen(false);
    fn();
  };

  const canTransferGeoJSON = !isWorldMode || !!activeCountryId;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", isOpen ? "bg-fill-3 text-label" : "text-label-secondary")}
          title="Map editor settings"
          aria-label="Map editor settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="rounded-row w-64 p-3" align="end">
        <div className="flex flex-col gap-3">
          <Eyebrow className="block select-none">Map editor settings</Eyebrow>

          <div className="flex flex-col gap-1">
            <MenuItem
              icon={<FileUp className={ICON} />}
              label="Import Provinces (SVG/PNG)"
              shortcut="I"
              onClick={closeThen(() => editor.setMode("import-provinces"))}
              title="Import provinces from external GeoJSON"
            />

            {canTransferGeoJSON && (
              <>
                <MenuItem
                  icon={<FileUp className={ICON} />}
                  label="Import GeoJSON…"
                  onClick={closeThen(onImportGeoJSON)}
                  disabled={editor.isMutating}
                  title="Create cities, POIs and regions from a GeoJSON file (points → cities, polygons → regions)"
                />
                <MenuItem
                  icon={<Download className={ICON} />}
                  label="Export GeoJSON"
                  onClick={closeThen(onExportGeoJSON)}
                  title="Download every feature on this map as a GeoJSON FeatureCollection"
                />
              </>
            )}

            {editor.allFeatures.some((f) => f.type === "subdivision") && (
              <MenuItem
                icon={<Minimize2 className={ICON} />}
                label={simplifyAll.isPending ? "Simplifying..." : "Simplify All Regions"}
                onClick={() =>
                  activeCountryId
                    ? run("Simplification error", async () => {
                        const result = await simplifyAll.mutateAsync({
                          countryId: activeCountryId,
                          targetVerticesPerProvince: 100,
                        });
                        return `Simplified ${result.updated}/${result.total} regions (${result.reduction}% vertex reduction)`;
                      })
                    : setIsOpen(false)
                }
                disabled={simplifyAll.isPending || !activeCountryId}
                title="Simplify all regions: reduce vertices while preserving shape"
              />
            )}

            <SwitchRow
              icon={<Magnet className="h-3 w-3" aria-hidden />}
              label="Snap"
              checked={snapEnabled}
              onCheckedChange={setSnapEnabled}
              ariaLabel="Snap to features"
            />
            {snapEnabled && (
              <div className="flex items-center gap-2 px-2 pb-2">
                <Slider
                  aria-label="Snap tolerance"
                  min={0.001}
                  max={0.1}
                  step={0.001}
                  value={[snapTolerance]}
                  onValueChange={([v]) => v !== undefined && setSnapTolerance(v)}
                  className="flex-1 py-2"
                />
                <span className="text-label-secondary text-footnote w-10 text-right font-mono tabular-nums">
                  {snapTolerance.toFixed(3)}°
                </span>
              </div>
            )}

            <SwitchRow
              icon={<Settings className="h-3 w-3" aria-hidden />}
              label="Lock panels"
              checked={panelsLocked}
              onCheckedChange={setPanelsLocked}
              ariaLabel="Lock panels"
            />

            {isAdmin && activeCountryId && (
              <>
                <div className="border-separator my-1 border-t" aria-hidden />
                <Eyebrow className="block px-2 select-none">Admin</Eyebrow>
                <MenuItem
                  icon={<Train className={ICON} />}
                  label={generateTransport.isPending ? "Generating..." : "Gen Transport"}
                  onClick={() =>
                    run("Transport generation error", async () => {
                      const result = await generateTransport.mutateAsync({
                        countryId: activeCountryId,
                        routeTypes: ["rail", "highway"],
                        clearExisting: true,
                      });
                      return `Generated ${result.routesCreated} routes (${result.totalLengthKm} km)`;
                    })
                  }
                  disabled={generateTransport.isPending}
                  title="Generate rail + highway routes procedurally (clears existing transport routes)"
                />
                <MenuItem
                  icon={
                    <RefreshCw className={cn(ICON, recalculateGeo.isPending && "animate-spin")} />
                  }
                  label={recalculateGeo.isPending ? "Recalculating..." : "Recalc"}
                  onClick={() =>
                    run("Recalculation error", async () => {
                      await recalculateGeo.mutateAsync({ countryId: activeCountryId });
                      return "Geographic profile recalculated successfully";
                    })
                  }
                  disabled={recalculateGeo.isPending}
                  title="Recalculate the geographic profile for the active country"
                />
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
