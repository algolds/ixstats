"use client";

/**
 * MapControls - Condensed icon toolbar for map layers, overlays, and tools.
 *
 * Layout: Horizontal row of icon buttons. Each opens a dropdown panel on click.
 * Panels auto-close when clicking outside or switching to another panel.
 *
 * Icons: Layers | Analytics | Tools (measure/pin) | Labels toggle
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Layers, BarChart3, Tag, Ruler, MapPin, PenTool, EyeOff, Eye, Globe } from "lucide-react";
import { LAYER_CONFIGS, getClimateLegend, type MapLayerType } from "~/lib/maps/map-config";
import { overlaysByCategory } from "~/lib/maps/overlay-registry";
import type { OverlayVisibility } from "./IxWorldMap";

export interface MapControlsProps {
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

// Overlay toggle lists are derived from the declarative registry (grouped by
// category) instead of hardcoded arrays. "feature" overlays live in the Layers
// panel; "fill" + "analytics" overlays drive the Analytics panel.
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

  // Close panel on click outside
  useEffect(() => {
    if (!openPanel) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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
      {/* Icon button row */}
      <div className="flex items-center gap-1">
        {/* Layers */}
        <IconButton
          icon={<Layers className="h-4 w-4" />}
          label="Layers"
          isActive={openPanel === "layers"}
          onClick={() => toggle("layers")}
        />

        {/* Analytics */}
        <IconButton
          icon={<BarChart3 className="h-4 w-4" />}
          label="Analytics"
          isActive={openPanel === "analytics"}
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

        {/* Tool buttons */}
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

        {/* Map Editor shortcut */}
        {canEdit && onEditMap && (
          <IconButton
            icon={<PenTool className="h-4 w-4" />}
            label="Edit Map"
            isActive={false}
            variant="default"
            onClick={onEditMap}
          />
        )}

        {/* World Editor button beside edit map icon */}
        {showWorldEditor && onOpenWorldEditor && (
          <IconButton
            icon={<Globe className="h-4 w-4" />}
            label="World Editor"
            isActive={false}
            variant="default"
            onClick={onOpenWorldEditor}
          />
        )}
      </div>

      {/* Layers panel */}
      {openPanel === "layers" && (
        <DropdownPanel>
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

          {overlayVisibility && onToggleOverlay && (
            <PanelSection title="Features">
              {FEATURE_OVERLAYS.map((item) => (
                <CheckboxRow
                  key={item.key}
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

          {/* Climate legend */}
          {visibleLayers.has("climate") && (
            <PanelSection title="Climate Zones">
              <div className="max-h-40 overflow-y-auto">
                {getClimateLegend().map((entry) => (
                  <div key={entry.code} className="flex items-center gap-2 py-0.5">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-black/10"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-foreground text-[11px]">{entry.label}</span>
                  </div>
                ))}
              </div>
            </PanelSection>
          )}
        </DropdownPanel>
      )}

      {/* Analytics panel */}
      {openPanel === "analytics" && overlayVisibility && onToggleOverlay && (
        <DropdownPanel>
          <PanelSection title="Analytics Overlays">
            {ANALYTICS_OVERLAYS.map((item) => (
              <CheckboxRow
                key={item.key}
                label={item.label}
                checked={overlayVisibility[item.key]}
                onChange={() => onToggleOverlay(item.key)}
              />
            ))}
          </PanelSection>
        </DropdownPanel>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function IconButton({
  icon,
  label,
  isActive,
  hasIndicator,
  variant = "default",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  hasIndicator?: boolean;
  variant?: "default" | "active-tool";
  onClick: () => void;
}) {
  const base =
    "relative flex items-center justify-center rounded-lg shadow-md transition-all duration-150 min-h-[40px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px]";
  const colors =
    variant === "active-tool"
      ? "bg-blue-500 text-white hover:bg-blue-600"
      : isActive
        ? "bg-accent text-foreground"
        : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <button onClick={onClick} className={`${base} ${colors}`} title={label}>
      {icon}
      {hasIndicator && (
        <span className="ring-card absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500 ring-1" />
      )}
    </button>
  );
}

function DropdownPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-top-1 bg-card mt-1.5 w-48 rounded-lg p-2 shadow-lg duration-150">
      {children}
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="[&+&]:border-border [&+&]:mt-1.5 [&+&]:border-t [&+&]:pt-1.5">
      <div className="text-muted-foreground px-1.5 pb-0.5 text-[10px] font-semibold tracking-wider uppercase">
        {title}
      </div>
      {children}
    </div>
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
      // If any are on, we want to turn all off; if all are off, turn all on
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
      className="hover:bg-accent border-border mt-1 flex w-full cursor-pointer items-center gap-2 rounded border-t px-1.5 py-1.5 text-left transition-colors sm:py-1"
    >
      {anyFeatureOn ? (
        <EyeOff className="text-muted-foreground h-3.5 w-3.5" />
      ) : (
        <Eye className="text-muted-foreground h-3.5 w-3.5" />
      )}
      <span className="text-foreground text-[12px] font-medium">
        {anyFeatureOn ? "Hide All Markers" : "Show All Markers"}
      </span>
    </button>
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
    <label className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 transition-colors sm:py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="border-border h-3.5 w-3.5 rounded text-blue-500 focus:ring-blue-500"
      />
      <span className="text-foreground text-[12px]">{label}</span>
    </label>
  );
}
