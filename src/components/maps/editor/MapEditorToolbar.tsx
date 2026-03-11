"use client";

/**
 * MapEditorToolbar - Dropdown "Add New" button for the map editor.
 * Overlays the map (bottom-left). Matches standard map control styling.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, MapPin, Hexagon, Landmark, X } from "lucide-react";
import type { EditorMode } from "~/hooks/useMapEditor";

interface MapEditorToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  disabled?: boolean;
}

const ADD_TOOLS: { mode: EditorMode; icon: typeof MapPin; label: string; desc: string }[] = [
  { mode: "add-city", icon: MapPin, label: "City", desc: "Click map to place" },
  { mode: "add-subdivision", icon: Hexagon, label: "Region", desc: "Draw polygon boundary" },
  { mode: "add-poi", icon: Landmark, label: "POI", desc: "Click map to place" },
];

export function MapEditorToolbar({ mode, onModeChange, disabled }: MapEditorToolbarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAdding = mode !== "view" && mode !== "edit";
  const activeTool = ADD_TOOLS.find((t) => t.mode === mode);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleSelect = useCallback(
    (toolMode: EditorMode) => {
      onModeChange(toolMode);
      setOpen(false);
    },
    [onModeChange]
  );

  const handleCancel = useCallback(() => {
    onModeChange("view");
    setOpen(false);
  }, [onModeChange]);

  return (
    <div ref={ref} className={`relative ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      {/* Dropdown menu (opens upward) */}
      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 w-48 rounded-lg bg-card p-1 shadow-lg ring-1 ring-border">
          <div className="mb-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Add Feature
          </div>
          {ADD_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isActive = mode === tool.mode;
            return (
              <button
                key={tool.mode}
                onClick={() => handleSelect(tool.mode)}
                className={`flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium">{tool.label}</div>
                  <div className={`text-[10px] ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {tool.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Trigger button */}
      {isAdding && activeTool ? (
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-primary p-0.5 shadow-md">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <activeTool.icon className="h-3.5 w-3.5" />
            <span>{activeTool.label}</span>
          </button>
          <button
            onClick={handleCancel}
            className="rounded p-1.5 text-primary-foreground/70 transition-colors hover:bg-primary/90 hover:text-primary-foreground"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm font-medium text-foreground shadow-md transition-colors hover:bg-accent"
        >
          <Plus className="h-4 w-4" />
          <span>Add New</span>
        </button>
      )}
    </div>
  );
}
