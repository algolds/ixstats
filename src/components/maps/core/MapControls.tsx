"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Component as Layers,
  StatsReport as BarChart3,
  Label as Tag,
  Ruler,
  MapPin,
  EditPencil as PenTool,
  EyeClosed as EyeOff,
  Eye,
  Globe,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetMaterial } from "~/components/ui/facet";
import { cn } from "~/lib/utils/cn";
import { LAYER_CONFIGS, getClimateLegend, type MapLayerType } from "~/lib/maps/map-config";
import { overlaysByCategory } from "~/lib/maps/overlay-registry";
import type { OverlayVisibility } from "./IxWorldMap";

interface MapControlsProps {
  visibleLayers: Set<MapLayerType>;
  onToggleLayer: (layer: MapLayerType) => void;
  overlayVisibility?: OverlayVisibility;
  onToggleOverlay?: (key: keyof OverlayVisibility) => void;
  labelsVisible?: boolean;
  onToggleLabels?: () => void;
  /** Measure tool active state */
  isMeasuring?: boolean;
  onToggleMeasure?: () => void;
  /** Pin tool active state */
  isPinActive?: boolean;
  onTogglePin?: () => void;
  /** Whether tools should be shown */
  toolsVisible?: boolean;
  /** Whether the user can edit their country map */
  canEdit?: boolean;
  /** Open map editor for user's country */
  onEditMap?: () => void;
  /** Whether to show the world editor button (admin or system owner) */
  showWorldEditor?: boolean;
  /** Route/callback to open world editor */
  onOpenWorldEditor?: () => void;
  /** Responsive layout variant: desktop horizontal bar, mobile FAB, or auto */
  variant?: "desktop" | "mobile" | "auto";
}

const TOGGLEABLE_LAYERS: MapLayerType[] = ["political", "climate", "rivers", "lakes"];

// Overlay toggles come from the registry: "feature" overlays live in the Layers panel,
// "fill" + "analytics" overlays in the Analytics panel.
const OVERLAY_GROUPS = overlaysByCategory();
const FEATURE_OVERLAYS: { key: keyof OverlayVisibility; label: string }[] = (
  OVERLAY_GROUPS.feature ?? []
).map((o) => ({ key: o.id as keyof OverlayVisibility, label: o.label }));

const ANALYTICS_OVERLAYS: { key: keyof OverlayVisibility; label: string }[] = [
  ...(OVERLAY_GROUPS.fill ?? []),
  ...(OVERLAY_GROUPS.analytics ?? []),
].map((o) => ({ key: o.id as keyof OverlayVisibility, label: o.label }));

type PanelId = "layers" | "analytics" | null;

export function MapControls({
  visibleLayers,
  onToggleLayer,
  overlayVisibility,
  onToggleOverlay,
  labelsVisible,
  onToggleLabels,
  isMeasuring,
  onToggleMeasure,
  isPinActive,
  onTogglePin,
  toolsVisible = true,
  canEdit,
  onEditMap,
  showWorldEditor,
  onOpenWorldEditor,
}: MapControlsProps) {
  const [openPanel, setOpenPanel] = useState<PanelId>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close panel on click/tap outside or Escape
  useEffect(() => {
    if (!openPanel) return;
    function handlePointer(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Stop the map's Escape handler from also clearing the selection.
      e.preventDefault();
      e.stopPropagation();
      setOpenPanel(null);
    }
    document.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKey, { capture: true });
    };
  }, [openPanel]);

  const toggle = useCallback((panel: PanelId) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  }, []);

  const hasActiveAnalytics =
    !!overlayVisibility && ANALYTICS_OVERLAYS.some((item) => overlayVisibility[item.key]);

  return (
    <div
      ref={containerRef}
      className="absolute top-16 left-3 z-10 sm:top-3"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <FacetMaterial
        material="regular"
        role="toolbar"
        aria-label="Map controls"
        className="rounded-row flex w-fit items-center gap-0.5 p-1"
      >
        <IconButton
          icon={<Layers className="h-4 w-4" />}
          label="Layers"
          isActive={openPanel === "layers"}
          controls="map-controls-panel"
          expanded={openPanel === "layers"}
          onClick={() => toggle("layers")}
        />

        <IconButton
          icon={<BarChart3 className="h-4 w-4" />}
          label="Analytics"
          isActive={openPanel === "analytics"}
          controls="map-controls-panel"
          expanded={openPanel === "analytics"}
          hasIndicator={!!hasActiveAnalytics}
          onClick={() => toggle("analytics")}
        />

        {/* Labels — direct toggle, no panel */}
        {onToggleLabels && (
          <IconButton
            icon={<Tag className="h-4 w-4" />}
            label="Labels"
            isActive={labelsVisible ?? true}
            onClick={onToggleLabels}
          />
        )}

        {toolsVisible && onToggleMeasure && (
          <IconButton
            icon={<Ruler className="h-4 w-4" />}
            label="Measure"
            isActive={!!isMeasuring}
            variant={isMeasuring ? "active-tool" : "default"}
            onClick={onToggleMeasure}
          />
        )}
        {toolsVisible && onTogglePin && (
          <IconButton
            icon={<MapPin className="h-4 w-4" />}
            label="Pin"
            isActive={!!isPinActive}
            variant={isPinActive ? "active-tool" : "default"}
            onClick={onTogglePin}
          />
        )}

        {canEdit && onEditMap && (
          <IconButton
            icon={<PenTool className="h-4 w-4" />}
            label="Edit map"
            isActive={false}
            variant="default"
            onClick={onEditMap}
          />
        )}

        {showWorldEditor && onOpenWorldEditor && (
          <IconButton
            icon={<Globe className="h-4 w-4" />}
            label="World editor"
            isActive={false}
            variant="default"
            onClick={onOpenWorldEditor}
          />
        )}
      </FacetMaterial>

      {openPanel === "layers" && (
        <DropdownPanel label="Map layers">
          <PanelSection title="Map layers">
            {TOGGLEABLE_LAYERS.map((layer) => (
              <CheckboxRow
                key={layer}
                label={LAYER_CONFIGS[layer].label}
                checked={visibleLayers.has(layer)}
                onChange={() => onToggleLayer(layer)}
              />
            ))}
          </PanelSection>

          {overlayVisibility && onToggleOverlay && (
            <PanelSection title="Features">
              <OverlayRows
                items={FEATURE_OVERLAYS}
                overlayVisibility={overlayVisibility}
                onToggleOverlay={onToggleOverlay}
              />
              <ToggleAllRow
                overlayVisibility={overlayVisibility}
                onToggleOverlay={onToggleOverlay}
              />
            </PanelSection>
          )}

          {visibleLayers.has("climate") && (
            <PanelSection title="Climate zones">
              <div className="max-h-40 overflow-y-auto">
                {getClimateLegend().map((entry) => (
                  <div key={entry.code} className="flex items-center gap-2 py-0.5">
                    <span
                      className="border-separator inline-block h-2.5 w-2.5 shrink-0 rounded-xs border"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-label text-footnote">{entry.label}</span>
                  </div>
                ))}
              </div>
            </PanelSection>
          )}
        </DropdownPanel>
      )}

      {openPanel === "analytics" && overlayVisibility && onToggleOverlay && (
        <DropdownPanel label="Analytics overlays">
          <PanelSection title="Analytics overlays">
            <OverlayRows
              items={ANALYTICS_OVERLAYS}
              overlayVisibility={overlayVisibility}
              onToggleOverlay={onToggleOverlay}
            />
          </PanelSection>
        </DropdownPanel>
      )}
    </div>
  );
}

function IconButton({
  icon,
  label,
  isActive,
  hasIndicator,
  variant = "default",
  controls,
  expanded,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  hasIndicator?: boolean;
  variant?: "default" | "active-tool";
  /** For panel toggles: id of the panel and whether it is open (disclosure pattern). */
  controls?: string;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn(
        "rounded-control relative h-11 w-11 sm:h-9 sm:w-9",
        variant === "active-tool"
          ? "bg-blue text-on-blue hover:bg-blue/90"
          : isActive
            ? "bg-fill-3 text-label"
            : "text-label-secondary"
      )}
      title={label}
      aria-label={label}
      {...(controls
        ? { "aria-expanded": !!expanded, "aria-controls": expanded ? controls : undefined }
        : { "aria-pressed": !!isActive })}
    >
      {icon}
      {hasIndicator && (
        <span className="ring-card bg-blue absolute top-1 right-1 h-2 w-2 rounded-full ring-1" />
      )}
    </Button>
  );
}

function DropdownPanel({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <FacetMaterial
      material="regular"
      id="map-controls-panel"
      role="region"
      aria-label={label}
      className="animate-in fade-in slide-in-from-top-1 rounded-row mt-2 max-h-[min(70dvh,32rem)] w-56 overflow-y-auto overscroll-contain p-2 duration-150"
    >
      {children}
    </FacetMaterial>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="[&+&]:border-separator [&+&]:mt-2 [&+&]:border-t [&+&]:pt-2">
      <Eyebrow className="block px-2 pb-0.5">{title}</Eyebrow>
      {children}
    </div>
  );
}

function OverlayRows({
  items,
  overlayVisibility,
  onToggleOverlay,
}: {
  items: { key: keyof OverlayVisibility; label: string }[];
  overlayVisibility: OverlayVisibility;
  onToggleOverlay: (key: keyof OverlayVisibility) => void;
}) {
  return items.map((item) => (
    <CheckboxRow
      key={item.key}
      label={item.label}
      checked={overlayVisibility[item.key]}
      onChange={() => onToggleOverlay(item.key)}
    />
  ));
}

function ToggleAllRow({
  overlayVisibility,
  onToggleOverlay,
}: {
  overlayVisibility: OverlayVisibility;
  onToggleOverlay: (key: keyof OverlayVisibility) => void;
}) {
  const anyFeatureOn = FEATURE_OVERLAYS.some((item) => overlayVisibility[item.key]);

  // If any are on, turn all off; if all are off, turn all on
  const handleToggleAll = () => {
    for (const item of FEATURE_OVERLAYS) {
      if (!!overlayVisibility[item.key] === anyFeatureOn) onToggleOverlay(item.key);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleToggleAll}
      className="mt-1 w-full justify-start px-2"
    >
      {anyFeatureOn ? (
        <EyeOff className="text-label-secondary size-3.5" aria-hidden />
      ) : (
        <Eye className="text-label-secondary size-3.5" aria-hidden />
      )}
      <span className="text-label text-caption">
        {anyFeatureOn ? "Hide All Markers" : "Show All Markers"}
      </span>
    </Button>
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
    <label className="hover:bg-fill-4 rounded-control-sm flex cursor-pointer items-center gap-2 px-2 py-2 transition-colors sm:py-1">
      <Checkbox checked={!!checked} onCheckedChange={() => onChange()} />
      <span className="text-label text-footnote">{label}</span>
    </label>
  );
}
