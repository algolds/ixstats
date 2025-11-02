/**
 * EditorToolbar Component
 *
 * Floating toolbar with drawing and editing controls for the map editor.
 * Provides tools for creating and manipulating geographic features.
 *
 * Features:
 * - Polygon drawing tool (subdivisions)
 * - Point drawing tool (cities, POIs)
 * - Edit mode (modify existing features)
 * - Delete mode
 * - Save/Cancel actions with undo/redo
 * - Keyboard shortcuts (Esc to cancel, Ctrl+S to save)
 * - Responsive design with glass physics styling
 */

"use client";

import React, { useEffect, useState } from "react";
import {
  Pentagon,
  MapPin,
  Edit3,
  Trash2,
  Save,
  X,
  Undo,
  Redo,
  type LucideIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface EditorToolbarProps {
  activeMode?: "polygon" | "point" | "edit" | "delete" | null;
  onModeChange?: (mode: "polygon" | "point" | "edit" | "delete" | null) => void;
  onCancel?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  hasUnsavedChanges?: boolean;
}

type DrawingMode = "polygon" | "point" | "edit" | "delete";

interface ToolButton {
  mode: DrawingMode;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
}

const DRAWING_TOOLS: ToolButton[] = [
  { mode: "polygon", icon: Pentagon, label: "Draw Subdivision", shortcut: "P" },
  { mode: "point", icon: MapPin, label: "Place Point", shortcut: "M" },
  { mode: "edit", icon: Edit3, label: "Edit Features", shortcut: "E" },
  { mode: "delete", icon: Trash2, label: "Delete Features", shortcut: "D" },
];

/**
 * EditorToolbar Component (Memoized)
 * Only re-renders when props actually change
 */
export const EditorToolbar = React.memo(function EditorToolbar({
  activeMode,
  onModeChange,
  onCancel,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  hasUnsavedChanges = false,
}: EditorToolbarProps) {
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to cancel/deselect
      if (e.key === "Escape") {
        e.preventDefault();
        if (activeMode) {
          onModeChange?.(null);
        } else {
          onCancel?.();
        }
        return;
      }

      // Ctrl+S is handled by individual editors now

      // Ctrl+Z to undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) onUndo?.();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z to redo
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        if (canRedo) onRedo?.();
        return;
      }

      // Tool shortcuts (P, M, E, D)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key) {
        const tool = DRAWING_TOOLS.find(
          (t) => t.shortcut && t.shortcut.toLowerCase() === e.key.toLowerCase()
        );
        if (tool) {
          e.preventDefault();
          onModeChange?.(activeMode === tool.mode ? null : tool.mode);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeMode, canUndo, canRedo, onModeChange, onCancel, onUndo, onRedo]);

  const handleToolClick = (mode: DrawingMode) => {
    // Toggle off if already active, otherwise activate
    onModeChange?.(activeMode === mode ? null : mode);
  };

  return (
    <div className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2">
      <div className="glass-panel shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-1 px-2 py-2">
          {/* Drawing Tools */}
          <div className="flex items-center gap-1 border-r border-white/10 pr-2">
            {DRAWING_TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeMode === tool.mode;

              return (
                <Tooltip key={tool.mode}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="icon"
                      onClick={() => handleToolClick(tool.mode)}
                      className={cn(
                        "relative transition-all duration-200",
                        isActive && [
                          "glass-interactive",
                          "bg-blue-500/20 text-blue-300",
                          "border border-blue-400/30",
                          "shadow-lg shadow-blue-500/20",
                        ],
                        !isActive && [
                          "text-slate-300 hover:text-white",
                          "hover:bg-white/10",
                        ]
                      )}
                      aria-label={tool.label}
                      aria-pressed={isActive}
                    >
                      <Icon className="size-4" />
                      {isActive && (
                        <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-blue-400" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="font-medium">{tool.label}</p>
                    {tool.shortcut && (
                      <p className="text-xs text-slate-400">
                        Press <kbd className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-xs">{tool.shortcut}</kbd>
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Undo/Redo */}
          {(onUndo ?? onRedo) && (
            <div className="flex items-center gap-1 border-r border-white/10 pr-2">
              {onUndo && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onUndo}
                      disabled={!canUndo}
                      className={cn(
                        "text-slate-300 transition-all duration-200",
                        canUndo && "hover:bg-white/10 hover:text-white",
                        !canUndo && "opacity-40"
                      )}
                      aria-label="Undo"
                    >
                      <Undo className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="font-medium">Undo</p>
                    <p className="text-xs text-slate-400">
                      <kbd className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-xs">Ctrl+Z</kbd>
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}

              {onRedo && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onRedo}
                      disabled={!canRedo}
                      className={cn(
                        "text-slate-300 transition-all duration-200",
                        canRedo && "hover:bg-white/10 hover:text-white",
                        !canRedo && "opacity-40"
                      )}
                      aria-label="Redo"
                    >
                      <Redo className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="font-medium">Redo</p>
                    <p className="text-xs text-slate-400">
                      <kbd className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-xs">Ctrl+Y</kbd>
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-1 pl-1">
            {onCancel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size={isMobile ? "icon" : "sm"}
                    onClick={onCancel}
                    className={cn(
                      "transition-all duration-200",
                      "text-red-300 hover:bg-red-500/20 hover:text-red-200",
                      "border border-transparent hover:border-red-400/30"
                    )}
                    aria-label="Cancel"
                  >
                    <X className="size-4" />
                    {!isMobile && <span className="ml-1">Close</span>}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-medium">Close Editor</p>
                  <p className="text-xs text-slate-400">
                    <kbd className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-xs">Esc</kbd>
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Active Mode Indicator (Mobile only) */}
          {isMobile && activeMode && (
            <div className="border-l border-white/10 pl-2">
              <div className="text-xs font-medium text-blue-300">
                {DRAWING_TOOLS.find((t) => t.mode === activeMode)?.label}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Mode Indicator */}
        {!isMobile && activeMode && (
          <div className="border-t border-white/10 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <div className="size-1.5 animate-pulse rounded-full bg-blue-400" />
              <span className="text-xs font-medium text-blue-300">
                {DRAWING_TOOLS.find((t) => t.mode === activeMode)?.label}
              </span>
              <span className="text-xs text-slate-400">
                (Press <kbd className="rounded bg-slate-700 px-1 py-0.5 font-mono text-[10px]">Esc</kbd> to cancel)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
