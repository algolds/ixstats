"use client";

/**
 * MapKeyboardControls - Keyboard navigation for the map.
 *
 * Shortcuts:
 *   WASD / Arrow keys — Pan
 *   + / =             — Zoom in
 *   - / _             — Zoom out
 *   R                 — Reset view (zoom to world)
 *   ?                 — Toggle shortcut help overlay
 */

import { useEffect, useState, useCallback } from "react";
import { Keyboard, X } from "lucide-react";
import type { IxWorldMapRef } from "./IxWorldMap";
import { MAP_DEFAULTS, type ProjectionMode } from "~/lib/maps/map-config";

interface MapKeyboardControlsProps {
  mapRef: React.RefObject<IxWorldMapRef | null>;
  onEscapePress?: () => void;
  projectionMode?: ProjectionMode;
  onProjectionChange?: (mode: ProjectionMode) => void;
}

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
}: MapKeyboardControlsProps) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

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
      {/* Bottom-right: copyright + keyboard shortcut button */}
      <div className="absolute right-4 bottom-4 z-10 flex items-center gap-1.5">
        <span className="text-muted-foreground/60 text-right text-[10px] leading-tight select-none">
          © 2026 Ixnay
          <br />
          Powered by IxStates
        </span>
        {/* Desktop only — keyboard shortcuts are irrelevant on touch devices */}
        <button
          onClick={() => setShowHelp((v) => !v)}
          className="bg-card text-muted-foreground hover:bg-accent hover:text-foreground hidden items-center gap-1 rounded-lg px-2 py-1.5 text-xs shadow-md transition-colors sm:flex"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="h-3.5 w-3.5" />
          <span>?</span>
        </button>
      </div>

      {/* Help overlay */}
      {showHelp && (
        <div className="bg-card/95 ring-border absolute right-4 bottom-12 z-20 w-56 rounded-xl p-3 shadow-lg ring-1 backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-foreground text-xs font-semibold">Keyboard Shortcuts</span>
            <button
              onClick={() => setShowHelp(false)}
              className="text-muted-foreground hover:text-foreground rounded p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {SHORTCUTS.map(({ keys, desc }) => (
              <div key={keys} className="flex items-center justify-between text-xs">
                <kbd className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
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
