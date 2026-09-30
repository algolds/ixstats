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

export function MapKeyboardControls({
  mapRef,
  onEscapePress,
  projectionMode,
  onProjectionChange,
  measureAvailable = true,
  sidePanelOpen = false,
}: MapKeyboardControlsProps) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(OWN_KEYS_SELECTOR)) return;

      const map = mapRef.current?.getMap();
      if (!map) return;

      switch (e.key) {
        // Pan
        case "w":
        case "W":
        case "ArrowUp":
          e.preventDefault();
          map.panBy([0, -PAN_AMOUNT], { duration: 200 });
          break;
        case "s":
        case "S":
        case "ArrowDown":
          e.preventDefault();
          map.panBy([0, PAN_AMOUNT], { duration: 200 });
          break;
        case "a":
        case "A":
        case "ArrowLeft":
          e.preventDefault();
          map.panBy([-PAN_AMOUNT, 0], { duration: 200 });
          break;
        case "d":
        case "D":
        case "ArrowRight":
          e.preventDefault();
          map.panBy([PAN_AMOUNT, 0], { duration: 200 });
          break;

        // Zoom
        case "+":
        case "=":
          e.preventDefault();
          map.zoomIn({ duration: 200 });
          break;
        case "-":
        case "_":
          e.preventDefault();
          map.zoomOut({ duration: 200 });
          break;

        // Reset
        case "r":
        case "R":
          e.preventDefault();
          map.flyTo({
            center: MAP_DEFAULTS.center,
            zoom: MAP_DEFAULTS.zoom,
            duration: 1200,
          });
          break;

        // Cycle projection
        case "p":
        case "P":
          e.preventDefault();
          if (onProjectionChange && projectionMode) {
            const modes: ProjectionMode[] = ["dynamic", "globe", "mercator"];
            const nextIdx = (modes.indexOf(projectionMode) + 1) % modes.length;
            onProjectionChange(modes[nextIdx]);
          }
          break;

        // Help
        case "?":
          e.preventDefault();
          setShowHelp((v) => !v);
          break;

        // Esc closes panels and overlays
        case "Escape":
          e.preventDefault();
          if (showHelp) {
            setShowHelp(false);
          } else {
            onEscapePress?.();
          }
          break;
      }
    },
    [mapRef, showHelp, onEscapePress, projectionMode, onProjectionChange]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <>
      {/* Bottom-right: copyright + keyboard shortcut button. Sits left of MapLibre's compact
          attribution button and moves clear of the desktop side panel when one is open. */}
      <div
        className={`absolute right-12 bottom-2.5 z-10 flex items-center gap-1.5 ${
          sidePanelOpen ? "max-sm:hidden sm:right-[25rem]" : ""
        }`}
      >
        <span className="text-muted-foreground/60 text-right text-xs leading-tight select-none">
          © 2026 Ixnay
          <br />
          Powered by IxStates
        </span>
        {/* Desktop only — keyboard shortcuts are irrelevant on touch devices */}
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="bg-card text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring hidden items-center gap-1 rounded-lg px-2 py-1.5 text-xs shadow-md transition-colors focus-visible:ring-2 focus-visible:outline-none sm:flex"
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          aria-expanded={showHelp}
        >
          <Keyboard className="h-3.5 w-3.5" aria-hidden />
          <span>?</span>
        </button>
      </div>

      {/* Help overlay */}
      {showHelp && (
        <div
          role="region"
          aria-label="Keyboard shortcuts"
          className={`bg-card/95 ring-border absolute right-12 bottom-12 z-20 w-56 rounded-xl p-3 shadow-lg ring-1 backdrop-blur-sm ${
            sidePanelOpen ? "sm:right-[25rem]" : ""
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-foreground text-xs font-semibold">Keyboard Shortcuts</span>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Close keyboard shortcuts"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="space-y-1">
            {SHORTCUTS.filter((sc) => sc.keys !== "M" || measureAvailable).map(({ keys, desc }) => (
              <div key={keys} className="flex items-center justify-between text-xs">
                <kbd className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs">
                  {keys}
                </kbd>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
