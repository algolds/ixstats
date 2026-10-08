"use client";

/**
 * MapKeyboardControls - Keyboard navigation for the map.
 *
 * Shortcuts:
 *   WASD / Arrow keys — Pan
 *   + / =             — Zoom in
 *   - / _             — Zoom out
 *   R                 — Reset view (zoom to world)
 *   M                 — Toggle the measure tool (handled by the measure tool itself)
 *   P                 — Cycle projection
 *   ?                 — Toggle shortcut help overlay
 *
 * Shortcuts are ignored while typing, while focus is inside a dialog/slider/menu/listbox
 * (so arrow keys keep working there), and whenever Ctrl/Cmd/Alt is held (so browser
 * shortcuts like Ctrl+R, Ctrl+D and Ctrl+= are never swallowed).
 */

import { useEffect, useState, useCallback } from "react";
import { Keyframe as Keyboard, Xmark as X } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { IxWorldMapRef } from "./IxWorldMap";
import { MAP_DEFAULTS, type ProjectionMode } from "~/lib/maps/map-config";

interface MapKeyboardControlsProps {
  mapRef: React.RefObject<IxWorldMapRef | null>;
  onEscapePress?: () => void;
  projectionMode?: ProjectionMode;
  onProjectionChange?: (mode: ProjectionMode) => void;
  /** Whether the measure tool (and so its M shortcut, which it handles itself) is available. */
  measureAvailable?: boolean;
  /** A desktop side panel is open: shift the bottom-right controls clear of it. */
  sidePanelOpen?: boolean;
  /** Where R (reset view) flies: the realm's home centre (mapHomeCenter), the origin by default. */
  homeCenter?: [number, number];
  /** The realm's credit line (its map or art), shown with IxStates' own. */
  attribution?: string | null;
}

/** Focus targets whose own keyboard handling must win over map shortcuts. */
const OWN_KEYS_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="slider"], [role="menu"], [role="listbox"], [role="combobox"]';

const PAN_AMOUNT = 100; // pixels per press

const SHORTCUTS = [
  { keys: "W / ↑", desc: "Pan north" },
  { keys: "A / ←", desc: "Pan west" },
  { keys: "S / ↓", desc: "Pan south" },
  { keys: "D / →", desc: "Pan east" },
  { keys: "+ / =", desc: "Zoom in" },
  { keys: "- / _", desc: "Zoom out" },
  { keys: "R", desc: "Reset view" },
  { keys: "M", desc: "Toggle measure" },
  { keys: "P", desc: "Cycle projection" },
  { keys: "Esc", desc: "Clear / close" },
  { keys: "?", desc: "Show shortcuts" },
];

const keyed = <T,>(keys: string[], value: T): [string, T][] => keys.map((k) => [k, value]);

/** Pan direction per key, as a unit vector scaled by PAN_AMOUNT. */
const PAN_STEPS: Record<string, [number, number]> = Object.fromEntries([
  ...keyed<[number, number]>(["w", "W", "ArrowUp"], [0, -1]),
  ...keyed<[number, number]>(["s", "S", "ArrowDown"], [0, 1]),
  ...keyed<[number, number]>(["a", "A", "ArrowLeft"], [-1, 0]),
  ...keyed<[number, number]>(["d", "D", "ArrowRight"], [1, 0]),
]);

type MapAction = (map: MapLibreMap, homeCenter: [number, number]) => void;

const MAP_ACTIONS: Record<string, MapAction> = Object.fromEntries([
  ...keyed<MapAction>(["+", "="], (map) => map.zoomIn({ duration: 200 })),
  ...keyed<MapAction>(["-", "_"], (map) => map.zoomOut({ duration: 200 })),
  ...keyed<MapAction>(["r", "R"], (map, homeCenter) =>
    map.flyTo({ center: homeCenter, zoom: MAP_DEFAULTS.zoom, duration: 1200 })
  ),
]);

const PROJECTION_CYCLE: ProjectionMode[] = ["dynamic", "globe", "mercator"];

export function MapKeyboardControls({
  mapRef,
  onEscapePress,
  projectionMode,
  onProjectionChange,
  measureAvailable = true,
  sidePanelOpen = false,
  homeCenter = MAP_DEFAULTS.center,
  attribution,
}: MapKeyboardControlsProps) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(OWN_KEYS_SELECTOR)) return;

      const map = mapRef.current?.getMap();
      if (!map) return;

      const pan = PAN_STEPS[e.key];
      const mapAction = MAP_ACTIONS[e.key];
      const cycleProjection = () => {
        if (!onProjectionChange || !projectionMode) return;
        const nextIdx = (PROJECTION_CYCLE.indexOf(projectionMode) + 1) % PROJECTION_CYCLE.length;
        onProjectionChange(PROJECTION_CYCLE[nextIdx]!);
      };
      // Esc closes the help overlay first, then panels
      const escape = () => (showHelp ? setShowHelp(false) : onEscapePress?.());
      const stateActions: Record<string, () => void> = {
        p: cycleProjection,
        P: cycleProjection,
        "?": () => setShowHelp((v) => !v),
        Escape: escape,
      };

      if (pan) {
        e.preventDefault();
        map.panBy([pan[0] * PAN_AMOUNT, pan[1] * PAN_AMOUNT], { duration: 200 });
      } else if (mapAction) {
        e.preventDefault();
        mapAction(map, homeCenter);
      } else if (stateActions[e.key]) {
        e.preventDefault();
        stateActions[e.key]!();
      }
    },
    [mapRef, showHelp, onEscapePress, projectionMode, onProjectionChange, homeCenter]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <>
      {/* Bottom-right: the realm's credit line, copyright + keyboard shortcut button. Sits left of
          MapLibre's compact attribution button and moves clear of the desktop side panel when one is open. */}
      <div
        className={`absolute right-12 bottom-3 z-10 flex items-center gap-2 ${
          sidePanelOpen ? "max-sm:hidden sm:right-[25rem]" : ""
        }`}
      >
        <span className="text-label-secondary text-footnote max-w-[60vw] text-right leading-tight select-none">
          {attribution && (
            <>
              <span>{attribution}</span>
              <br />
            </>
          )}
          © 2026 Ixnay
          <br />
          Powered by IxStates
        </span>
        {/* Desktop only — keyboard shortcuts are irrelevant on touch devices */}
        <FacetMaterial layer="chrome" className="rounded-control hidden sm:block">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setShowHelp((v) => !v)}
            className="text-label-secondary"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            aria-expanded={showHelp}
          >
            <Keyboard aria-hidden />
            <span>?</span>
          </Button>
        </FacetMaterial>
      </div>

      {showHelp && (
        <div
          className={`absolute right-12 bottom-12 z-20 w-56 ${sidePanelOpen ? "sm:right-[25rem]" : ""}`}
        >
          <FacetMaterial
            layer="chrome"
            role="region"
            aria-label="Keyboard shortcuts"
            className="rounded-row p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-label text-headline">Keyboard shortcuts</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowHelp(false)}
                className="text-label-secondary h-7 w-7"
                aria-label="Close keyboard shortcuts"
              >
                <X aria-hidden />
              </Button>
            </div>
            <div className="space-y-1">
              {SHORTCUTS.filter((sc) => sc.keys !== "M" || measureAvailable).map(
                ({ keys, desc }) => (
                  <div key={keys} className="text-footnote flex items-center justify-between">
                    <kbd className="bg-fill-3 text-label text-footnote rounded-control-sm px-2 py-0.5 tabular-nums">
                      {keys}
                    </kbd>
                    <span className="text-label-secondary">{desc}</span>
                  </div>
                )
              )}
            </div>
          </FacetMaterial>
        </div>
      )}
    </>
  );
}
