"use client";

/**
 * MobileEditorToolbar - Floating action button (FAB) with radial tool menu.
 *
 * Mobile-only (hidden on sm+). Provides touch-friendly access to editor tools
 * without consuming screen real estate when collapsed.
 *
 * Layout: FAB in bottom-right → expands upward with tool buttons.
 */

import { useState, useCallback, useEffect } from "react";
import { Plus, X, MapPin, Hexagon, Landmark, FileUp, List } from "lucide-react";
import type { EditorMode } from "~/hooks/useMapEditor";

interface MobileEditorToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  disabled?: boolean;
  featureCount: number;
  onToggleFeatureList: () => void;
}

const TOOLS: { mode: EditorMode; icon: typeof MapPin; label: string; color: string }[] = [
  { mode: "add-city", icon: MapPin, label: "City", color: "bg-blue-500" },
  { mode: "add-subdivision", icon: Hexagon, label: "Region", color: "bg-purple-500" },
  { mode: "add-poi", icon: Landmark, label: "POI", color: "bg-amber-500" },
];

export function MobileEditorToolbar({
  mode,
  onModeChange,
  disabled,
  featureCount,
  onToggleFeatureList,
}: MobileEditorToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isToolActive = mode !== "view" && !mode.startsWith("edit");

  const handleToggle = useCallback(() => {
    if (isToolActive) {
      // Cancel active tool
      onModeChange("view");
    } else {
      setIsExpanded((v) => !v);
    }
  }, [isToolActive, onModeChange]);

  const handleSelectTool = useCallback(
    (toolMode: EditorMode) => {
      onModeChange(toolMode);
      setIsExpanded(false);
    },
    [onModeChange]
  );

  // Close menu when a tool becomes active externally
  useEffect(() => {
    if (isToolActive) setIsExpanded(false);
  }, [isToolActive]);

  return (
    <div className="absolute right-4 bottom-6 z-20 flex flex-col items-end gap-3 sm:hidden">
      {/* Feature list button */}
      <button
        onClick={onToggleFeatureList}
        className="bg-card flex h-11 items-center gap-2 rounded-full px-4 shadow-lg transition-transform active:scale-95"
      >
        <List className="text-foreground h-5 w-5" />
        <span className="text-foreground text-sm font-medium">Features</span>
        {featureCount > 0 && (
          <span className="bg-primary/10 text-primary rounded-full px-1.5 text-xs font-semibold tabular-nums">
            {featureCount}
          </span>
        )}
      </button>

      {/* Expanded tool menu — slides up */}
      {isExpanded && (
        <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col items-end gap-2 duration-150">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.mode}
                onClick={() => handleSelectTool(tool.mode)}
                disabled={disabled}
                className="bg-card flex h-11 items-center gap-2.5 rounded-full pr-3 pl-4 shadow-lg transition-transform active:scale-95 disabled:opacity-40"
              >
                <span className="text-foreground text-sm font-medium">{tool.label}</span>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${tool.color}`}
                >
                  <Icon className="h-4.5 w-4.5 text-white" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={handleToggle}
        disabled={disabled && !isToolActive}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all active:scale-90 disabled:opacity-40 ${
          isToolActive
            ? "bg-red-500 text-white"
            : isExpanded
              ? "bg-muted text-foreground rotate-45"
              : "bg-primary text-primary-foreground"
        }`}
        aria-label={isToolActive ? "Cancel tool" : isExpanded ? "Close menu" : "Add feature"}
      >
        {isToolActive ? (
          <X className="h-6 w-6" />
        ) : (
          <Plus className={`h-6 w-6 transition-transform ${isExpanded ? "rotate-45" : ""}`} />
        )}
      </button>
    </div>
  );
}
