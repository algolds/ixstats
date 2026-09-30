"use client";

/**
 * KeyboardShortcutSheet — Modal overlay listing all map editor keyboard shortcuts.
 */

import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";

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
      { keys: "V", description: "Select" },
      { keys: "M", description: "Lasso / marquee select" },
      { keys: "C / 1", description: "Add city" },
      { keys: "R / 2", description: "Draw region" },
      { keys: "P / 3", description: "Add point of interest" },
      { keys: "T / 4", description: "Draw route" },
      { keys: "K", description: "Add mountain peak" },
      { keys: "Y", description: "Draw river" },
      { keys: "J", description: "Draw lake" },
      { keys: "U", description: "Ruler (measure distance & elevation)" },
      { keys: "I", description: "Import provinces (SVG/PNG)" },
    ],
  },
  {
    title: "Selection",
    shortcuts: [
      { keys: "Shift + Click", description: "Add / remove a feature from the selection" },
      { keys: "Shift + Drag", description: "Box-select features" },
      { keys: "Ctrl + A", description: "Select all features" },
      { keys: "Ctrl + D", description: "Deselect all" },
      { keys: "Delete / Backspace", description: "Delete selection (asks first)" },
      { keys: "Ctrl + J", description: "Duplicate selected feature" },
      { keys: "Arrow keys", description: "Nudge selected point (Shift = 10×)" },
    ],
  },
  {
    title: "Drawing",
    shortcuts: [
      { keys: "Enter", description: "Finish route / apply region split" },
      { keys: "Backspace", description: "Remove last vertex while drawing a region or lake" },
      {
        keys: "Ctrl + Z",
        description: "Remove last point while drawing a route, river or split line",
      },
      { keys: "Shift + Drag", description: "Lock vertex drag to an axis" },
      { keys: "Space + Drag", description: "Pan the map in any tool" },
      { keys: "Escape", description: "Cancel drawing, then leave the tool" },
    ],
  },
  {
    title: "Edit",
    shortcuts: [
      { keys: "Ctrl + Z", description: "Undo (all feature edits, moves and bulk operations)" },
      { keys: "Ctrl + Shift + Z / Ctrl + Y", description: "Redo" },
      { keys: "Ctrl + S", description: "Save the open form" },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { keys: "G", description: "Toggle coordinate grid" },
      { keys: "H", description: "Highlight gaps & regions without cities" },
      { keys: "F", description: "Hide / show side panels" },
      { keys: "?", description: "Show this sheet" },
    ],
  },
  {
    title: "Border editor (world editor)",
    shortcuts: [
      { keys: "V", description: "Select" },
      { keys: "P", description: "Edit vertices" },
      { keys: "X", description: "Split borders" },
      { keys: "M", description: "Merge borders" },
      { keys: "T", description: "Trace rivers / coast" },
      { keys: "B", description: "Territory brush" },
      { keys: "Ctrl + Z / Ctrl + Shift + Z", description: "Undo / redo border edits" },
      { keys: "Escape", description: "Leave border editing" },
    ],
  },
];

interface KeyboardShortcutSheetProps {
  onClose: () => void;
}

export function KeyboardShortcutSheet({ onClose }: KeyboardShortcutSheetProps) {
  // Opened from the keyboard (?), so it appears and leaves with no animation (Facet §8).
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="facet-modal max-h-[80vh] gap-0 overflow-y-auto rounded-2xl p-0 duration-0 data-[state=closed]:animate-none data-[state=open]:animate-none sm:max-w-lg">
        {/* Header */}
        <DialogHeader className="border-border border-b px-5 py-3 pr-12">
          <DialogTitle className="text-sm">Keyboard shortcuts</DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="space-y-5 p-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <Eyebrow className="mb-2 block">{group.title}</Eyebrow>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys}
                    className="hover:bg-accent/50 flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
                  >
                    <span className="text-muted-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.split(/( \+ | \/ )/).map((part, i) => {
                        const trimmed = part.trim();
                        if (trimmed === "+" || trimmed === "/") {
                          return (
                            <span key={i} className="text-muted-foreground text-xs">
                              {trimmed}
                            </span>
                          );
                        }
                        return (
                          <kbd
                            key={i}
                            className="border-border bg-muted text-foreground inline-flex min-w-[24px] items-center justify-center rounded border px-1.5 py-0.5 text-xs font-medium shadow-sm"
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
        <div className="border-border text-muted-foreground border-t px-5 py-3 text-center text-xs">
          Press <kbd className="border-border bg-muted rounded border px-1 text-xs">Esc</kbd> to
          close
        </div>
      </DialogContent>
    </Dialog>
  );
}
