"use client";

/** Row primitives and the guides section shared by LayerPanel.tsx. */

import React, { useState } from "react";
import {
  Eye,
  EyeClosed as EyeOff,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  Trash as Trash2,
  Ruler,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils/cn";

export function IconButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("rounded-control-sm size-5", className)}
      {...props}
    />
  );
}

export function ExpandButton({
  expanded,
  label,
  onClick,
}: {
  expanded: boolean;
  label: string;
  onClick: () => void;
}) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <IconButton
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
      className="text-label-secondary hover:text-label"
    >
      <Chevron className="h-3.5 w-3.5" />
    </IconButton>
  );
}

export function VisibilityButton({
  visible,
  noun,
  onClick,
}: {
  visible: boolean;
  noun: string;
  onClick: () => void;
}) {
  const label = `${visible ? "Hide" : "Show"} ${noun}`;
  return (
    <IconButton
      onClick={onClick}
      title={label}
      aria-label={label}
      className="hover:bg-fill-3 shrink-0"
    >
      {visible ? (
        <Eye className="text-label h-3.5 w-3.5" />
      ) : (
        <EyeOff className="text-label-secondary h-3.5 w-3.5" />
      )}
    </IconButton>
  );
}

export const Spacer = () => <span className="h-5 w-5 shrink-0" />;

export const emptyNote = (text: string) => (
  <div className="text-label-secondary text-footnote py-1 pl-8 italic">{text}</div>
);

export type Guide = { id: string; type: "h" | "v"; value: number };

export function GuidesSection({
  guides,
  showGuides,
  onToggleGuidesVisibility,
  onClearGuides,
  onDeleteGuide,
}: {
  guides: Guide[];
  showGuides: boolean;
  onToggleGuidesVisibility?: (visible: boolean) => void;
  onClearGuides?: () => void;
  onDeleteGuide?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border-separator border-b">
      <div
        className={`group hover:bg-fill-3 flex h-8 items-center gap-1 px-1 ${!showGuides ? "opacity-50" : ""}`}
      >
        <ExpandButton expanded={expanded} label="guides" onClick={() => setExpanded((v) => !v)} />
        <VisibilityButton
          visible={showGuides}
          noun="guides"
          onClick={() => onToggleGuidesVisibility?.(!showGuides)}
        />

        {guides.length > 0 ? (
          <IconButton
            onClick={() => onClearGuides?.()}
            title="Clear all guides"
            aria-label="Clear all guides"
            className="hover:bg-destructive/15 hover:text-destructive shrink-0"
          >
            <Trash2 className="text-label-secondary hover:text-destructive h-3.5 w-3.5" />
          </IconButton>
        ) : (
          <Spacer />
        )}

        <Ruler className="text-label-secondary ml-0.5 h-4 w-4 shrink-0" />

        <span
          onClick={() => setExpanded((v) => !v)}
          className="text-caption ml-1 flex-1 cursor-pointer truncate leading-none"
        >
          Ruler guides
        </span>

        {guides.length > 0 && (
          <Badge variant="default" className="mr-2 tabular-nums">
            {guides.length}
          </Badge>
        )}
      </div>

      {expanded && (
        <div className="bg-fill-4 space-y-0.5 pb-2">
          {guides.length > 0
            ? guides.map((guide) => (
                <div
                  key={guide.id}
                  className="group hover:bg-fill-3 rounded-control-sm flex items-center gap-2 px-2 py-1 pl-8"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="text-label-secondary text-caption shrink-0 font-mono font-semibold">
                      {guide.type === "h" ? "Lat" : "Lng"}
                    </span>
                    <span className="text-label text-footnote truncate">
                      {guide.type === "h" ? "Horizontal" : "Vertical"}: {guide.value.toFixed(5)}°
                    </span>
                  </div>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGuide?.(guide.id);
                    }}
                    title="Delete guide"
                    aria-label="Delete guide"
                    className="text-label-secondary hover:bg-destructive/15 hover:text-destructive opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </IconButton>
                </div>
              ))
            : emptyNote("No guides (drag from rulers to add)")}
        </div>
      )}
    </div>
  );
}
