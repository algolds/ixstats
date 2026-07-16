"use client";

import { useCallback } from "react";
import { Layers, Eye, EyeOff } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { LAYER_CONFIGS, getClimateLegend, type MapLayerType } from "~/lib/map-config";
import { overlaysByCategory } from "~/lib/overlay-registry";
import type { OverlayVisibility } from "../IxWorldMap";

interface MapLayersPopoverProps {
  visibleLayers: Set<MapLayerType>;
  onToggleLayer: (layer: MapLayerType) => void;
  overlayVisibility?: OverlayVisibility;
  onToggleOverlay?: (key: keyof OverlayVisibility) => void;
}

const TOGGLEABLE_LAYERS: MapLayerType[] = ["political", "climate", "rivers", "lakes"];

const OVERLAY_GROUPS = overlaysByCategory();
const FEATURE_OVERLAYS: { key: keyof OverlayVisibility; label: string }[] = (
  OVERLAY_GROUPS.feature ?? []
).map((o) => ({ key: o.id as keyof OverlayVisibility, label: o.label }));

const ANALYTICS_OVERLAYS: { key: keyof OverlayVisibility; label: string }[] = [
  ...(OVERLAY_GROUPS.fill ?? []),
  ...(OVERLAY_GROUPS.analytics ?? []),
].map((o) => ({ key: o.id as keyof OverlayVisibility, label: o.label }));

export function MapLayersPopover({
  visibleLayers,
  onToggleLayer,
  overlayVisibility,
  onToggleOverlay,
}: MapLayersPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 cursor-pointer rounded-full p-1 transition-colors"
        title="Map Layers"
      >
        <Layers className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="glass-none border-border bg-popover mt-2 w-60 max-h-[80vh] overflow-y-auto rounded-2xl border p-3 shadow-2xl z-[100060]"
        sideOffset={8}
      >
        <PanelSection title="Map Layers">
          {TOGGLEABLE_LAYERS.map((layer) => (
            <CheckboxRow
              key={layer}
              label={LAYER_CONFIGS[layer].label}
              checked={visibleLayers.has(layer)}
              onChange={() => onToggleLayer(layer)}
            />
          ))}
        </PanelSection>

        {overlayVisibility && onToggleOverlay && FEATURE_OVERLAYS.length > 0 && (
          <PanelSection title="Features">
            {FEATURE_OVERLAYS.map((item) => (
              <CheckboxRow
                key={String(item.key)}
                label={item.label}
                checked={overlayVisibility[item.key]}
                onChange={() => onToggleOverlay(item.key)}
              />
            ))}
            <ToggleAllRow
              overlayVisibility={overlayVisibility}
              onToggleOverlay={onToggleOverlay}
            />
          </PanelSection>
        )}

        {overlayVisibility && onToggleOverlay && ANALYTICS_OVERLAYS.length > 0 && (
          <PanelSection title="Analytics">
            {ANALYTICS_OVERLAYS.map((item) => (
              <CheckboxRow
                key={String(item.key)}
                label={item.label}
                checked={overlayVisibility[item.key]}
                onChange={() => onToggleOverlay(item.key)}
              />
            ))}
          </PanelSection>
        )}

        {visibleLayers.has("climate") && (
          <PanelSection title="Climate Zones">
            <div className="max-h-32 overflow-y-auto pr-1 space-y-1">
              {getClimateLegend().map((entry) => (
                <div key={entry.code} className="flex items-center gap-2 py-0.5">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-black/10 dark:border-white/10"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-foreground text-[11px] font-medium leading-none">{entry.label}</span>
                </div>
              ))}
            </div>
          </PanelSection>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Helpers/Sub-components ──────────────────────────────────────────

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="[&+&]:border-border [&+&]:mt-2.5 [&+&]:border-t [&+&]:pt-2.5">
      <div className="text-muted-foreground px-1 pb-1 text-[10px] font-semibold tracking-wider uppercase">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="border-border h-3.5 w-3.5 rounded text-blue-500 focus:ring-blue-500"
      />
      <span className="text-foreground text-[12px] font-medium leading-none">{label}</span>
    </label>
  );
}

function ToggleAllRow({
  overlayVisibility,
  onToggleOverlay,
}: {
  overlayVisibility: OverlayVisibility;
  onToggleOverlay: (key: keyof OverlayVisibility) => void;
}) {
  const anyFeatureOn = FEATURE_OVERLAYS.some((item) => overlayVisibility[item.key]);

  const handleToggleAll = useCallback(() => {
    for (const item of FEATURE_OVERLAYS) {
      if (anyFeatureOn && overlayVisibility[item.key]) {
        onToggleOverlay(item.key);
      } else if (!anyFeatureOn && !overlayVisibility[item.key]) {
        onToggleOverlay(item.key);
      }
    }
  }, [anyFeatureOn, overlayVisibility, onToggleOverlay]);

  return (
    <button
      onClick={handleToggleAll}
      className="hover:bg-accent border-border mt-1 flex w-full cursor-pointer items-center gap-2 rounded-lg border-t pt-1.5 px-2 py-1.5 text-left transition-colors"
    >
      {anyFeatureOn ? (
        <EyeOff className="text-muted-foreground h-3.5 w-3.5" />
      ) : (
        <Eye className="text-muted-foreground h-3.5 w-3.5" />
      )}
      <span className="text-foreground text-[12px] font-medium leading-none">
        {anyFeatureOn ? "Hide All Markers" : "Show All Markers"}
      </span>
    </button>
  );
}
