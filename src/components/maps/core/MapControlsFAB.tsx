"use client";

/**
 * MapControlsFAB — Mobile floating action button with vertical stack.
 *
 * Replaces the horizontal toolbar on mobile with a Google Maps-style FAB:
 * - Single 56px FAB (bottom-right, above safe area)
 * - Tap → vertical stack of labeled action buttons
 * - Actions open half-sheet panels with 44px toggle rows
 * - Auto-hides during map pan gestures
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Layers, BarChart3, Tag, Ruler, MapPin, Menu, X } from "lucide-react";
import { LAYER_CONFIGS, type MapLayerType } from "~/lib/maps/map-config";
import { overlaysByCategory } from "~/lib/maps/overlay-registry";
import type { OverlayVisibility } from "./IxWorldMap";

interface MapControlsFABProps {
  visibleLayers: Set<MapLayerType>;
  onToggleLayer: (layer: MapLayerType) => void;
  overlayVisibility?: OverlayVisibility;
  onToggleOverlay?: (key: keyof OverlayVisibility) => void;
  labelsVisible?: boolean;
  onToggleLabels?: () => void;
  isMeasuring?: boolean;
  onToggleMeasure?: () => void;
  isPinActive?: boolean;
  onTogglePin?: () => void;
  toolsVisible?: boolean;
}

const TOGGLEABLE_LAYERS: MapLayerType[] = ["political", "climate", "rivers", "lakes"];

const OVERLAY_GROUPS = overlaysByCategory();
const FEATURE_OVERLAYS = (OVERLAY_GROUPS.feature ?? []).map((o) => ({
  key: o.id as keyof OverlayVisibility,
  label: o.label,
}));
const ANALYTICS_OVERLAYS = [
  ...(OVERLAY_GROUPS.fill ?? []),
  ...(OVERLAY_GROUPS.analytics ?? []),
].map((o) => ({ key: o.id as keyof OverlayVisibility, label: o.label }));

type PanelType = "layers" | "analytics" | null;

export function MapControlsFAB({
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
}: MapControlsFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [isHidden, setIsHidden] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-hide during map touch/pan
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setIsHidden(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };

    const handleTouchEnd = () => {
      hideTimerRef.current = setTimeout(() => setIsHidden(false), 500);
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Close on outside tap
  useEffect(() => {
    if (!isOpen && !activePanel) return;
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActivePanel(null);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [isOpen, activePanel]);

  const handleAction = useCallback(
    (action: string) => {
      switch (action) {
        case "layers":
          setActivePanel((p) => (p === "layers" ? null : "layers"));
          break;
        case "analytics":
          setActivePanel((p) => (p === "analytics" ? null : "analytics"));
          break;
        case "labels":
          onToggleLabels?.();
          break;
        case "measure":
          onToggleMeasure?.();
          setIsOpen(false);
          break;
        case "pin":
          onTogglePin?.();
          setIsOpen(false);
          break;
      }
    },
    [onToggleLabels, onToggleMeasure, onTogglePin]
  );

  const actions = [
    { key: "layers", icon: Layers, label: "Layers" },
    { key: "analytics", icon: BarChart3, label: "Analytics" },
    { key: "labels", icon: Tag, label: labelsVisible ? "Hide Labels" : "Show Labels" },
    ...(toolsVisible && onToggleMeasure
      ? [{ key: "measure", icon: Ruler, label: isMeasuring ? "Stop Measure" : "Measure" }]
      : []),
    ...(toolsVisible && onTogglePin
      ? [{ key: "pin", icon: MapPin, label: isPinActive ? "Stop Pin" : "Drop Pin" }]
      : []),
  ];

  return (
    <div
      ref={containerRef}
      className="fixed right-3 z-20 transition-opacity duration-200"
      style={{
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? "none" : "auto",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {/* Active panel (bottom sheet style) */}
      {activePanel && (
        <div className="bg-card mb-3 w-56 rounded-2xl border border-white/10 p-3 shadow-xl">
          <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
            {activePanel === "layers" ? "Map Layers" : "Analytics"}
          </div>
          {activePanel === "layers" && (
            <>
              {TOGGLEABLE_LAYERS.map((layer) => (
                <ToggleRow
                  key={layer}
                  label={LAYER_CONFIGS[layer].label}
                  checked={visibleLayers.has(layer)}
                  onChange={() => onToggleLayer(layer)}
                />
              ))}
              {overlayVisibility && onToggleOverlay && FEATURE_OVERLAYS.length > 0 && (
                <>
                  <div className="border-border my-2 border-t" />
                  <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
                    Features
                  </div>
                  {FEATURE_OVERLAYS.map((item) => (
                    <ToggleRow
                      key={item.key}
                      label={item.label}
                      checked={overlayVisibility[item.key]}
                      onChange={() => onToggleOverlay(item.key)}
                    />
                  ))}
                </>
              )}
            </>
          )}
          {activePanel === "analytics" && overlayVisibility && onToggleOverlay && (
            <>
              {ANALYTICS_OVERLAYS.map((item) => (
                <ToggleRow
                  key={item.key}
                  label={item.label}
                  checked={overlayVisibility[item.key]}
                  onChange={() => onToggleOverlay(item.key)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Action stack */}
      {isOpen && !activePanel && (
        <div className="mb-3 flex flex-col items-end gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                onClick={() => handleAction(action.key)}
                className="bg-card text-foreground flex items-center gap-2 rounded-full border border-white/10 px-4 shadow-lg transition-transform active:scale-95"
                style={{ minHeight: "44px" }}
              >
                <span className="text-sm font-medium">{action.label}</span>
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => {
          setIsOpen((o) => !o);
          if (activePanel) setActivePanel(null);
        }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition-transform active:scale-95"
      >
        {isOpen || activePanel ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className="hover:bg-accent flex cursor-pointer items-center justify-between rounded-lg px-2 transition-colors"
      style={{ minHeight: "44px" }}
    >
      <span className="text-foreground text-sm">{label}</span>
      <div
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-blue-500" : "bg-muted"
        }`}
        onClick={(e) => {
          e.preventDefault();
          onChange();
        }}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
    </label>
  );
}
