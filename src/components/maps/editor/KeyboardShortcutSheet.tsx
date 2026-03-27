"use client";

/**
 * KeyboardShortcutSheet — Modal overlay listing all map editor keyboard shortcuts.
 */

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ShortcutEntry {
  keys: string;
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutEntry[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Tools",
    shortcuts: [
      { keys: "V", description: "Select / View mode" },
      { keys: "C / 1", description: "Add City tool" },
      { keys: "R / 2", description: "Add Region tool" },
      { keys: "P / 3", description: "Add POI tool" },
      { keys: "T / 4", description: "Add Route tool" },
      { keys: "S", description: "Add Story Pin tool" },
      { keys: "L", description: "Add Label tool" },
      { keys: "B", description: "Paint / Brush mode" },
      { keys: "I", description: "Import Provinces" },
    ],
  },
  {
    title: "Selection",
    shortcuts: [
      { keys: "Ctrl+A", description: "Select all visible features" },
      { keys: "Ctrl+D", description: "Deselect all" },
      { keys: "Delete / Backspace", description: "Delete selected feature" },
    ],
  },
  {
    title: "Edit",
    shortcuts: [
      { keys: "Ctrl+Z", description: "Undo last action" },
      { keys: "Ctrl+Shift+Z", description: "Redo last action" },
      { keys: "Ctrl+S", description: "Save current form" },
      { keys: "Escape", description: "Cancel / Exit mode" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: "F", description: "Toggle side panel" },
      { keys: "G", description: "Toggle grid" },
      { keys: "?", description: "Show this shortcut sheet" },
    ],
  },
];

interface KeyboardShortcutSheetProps {
  onClose: () => void;
}

export function KeyboardShortcutSheet({ onClose }: KeyboardShortcutSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="relative mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 p-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
                  >
                    <span className="text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.split(/(\+| \/ )/).map((part, i) => {
                        const trimmed = part.trim();
                        if (trimmed === "+" || trimmed === "/") {
                          return (
                            <span
                              key={i}
                              className="text-[10px] text-muted-foreground"
                            >
                              {trimmed}
                            </span>
                          );
                        }
                        return (
                          <kbd
                            key={i}
                            className="inline-flex min-w-[24px] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-sm"
                          >
                            {trimmed}
                          </kbd>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 text-center text-[11px] text-muted-foreground">
          Press <kbd className="rounded border border-border bg-muted px-1 text-[10px]">Esc</kbd> or click outside to close
        </div>
      </div>
    </div>
  );
}
