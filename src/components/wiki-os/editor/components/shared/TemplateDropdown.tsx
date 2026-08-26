/**
 * TemplateDropdown.tsx — Reusable Popover dropdown for quick template triggers.
 */
"use client";

import React, { memo } from "react";
import {
  Puzzle,
  Sparks as Sparkles,
  Map as MapIcon,
} from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { useEditorModalContext } from "../../context/EditorModalContext";

export interface TemplateDropdownProps {
  /** Invoked after the popover closes, before the target modal opens (e.g. restoreSelection in visual mode). */
  onSelect?: () => void;
  /** Invoked on trigger click before the popover opens (e.g. saveSelection in visual mode). */
  onBeforeOpen?: () => void;
  /** Extra trigger content (source mode renders an icon + "Templates" label + chevron). */
  triggerContent?: React.ReactNode;
  triggerClassName?: string;
  align?: "start" | "end";
}

const itemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]";

export const TemplateDropdown = memo(function TemplateDropdown({
  onSelect,
  onBeforeOpen,
  triggerContent,
  triggerClassName = "wikios-editor-format-btn",
  align = "end",
}: TemplateDropdownProps) {
  const modal = useEditorModalContext();

  const handleSelect = (openModal: (open: boolean) => void) => {
    modal.setTemplatesOpen(false);
    onSelect?.();
    openModal(true);
  };

  return (
    <Popover open={modal.templatesOpen} onOpenChange={modal.setTemplatesOpen}>
      <PopoverTrigger
        className={triggerClassName}
        title="Insert Template"
        onClick={onBeforeOpen}
      >
        {triggerContent ?? <Puzzle className="h-3.5 w-3.5" />}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="glass-none z-[10001] w-56 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-1 text-[var(--wikios-text)] shadow-2xl"
      >
        <div className="flex flex-col gap-0.5 text-xs">
          <button type="button" onClick={() => handleSelect(modal.setShowInfoboxModal)} className={itemClass}>
            <Puzzle className="h-3.5 w-3.5 text-blue-400" />
            <span>Infobox Country</span>
          </button>
          <button type="button" onClick={() => handleSelect(modal.setShowCountryStatsModal)} className={itemClass}>
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Country Stats</span>
          </button>
          <button type="button" onClick={() => handleSelect(modal.setShowBusinessStatsModal)} className={itemClass}>
            <Sparkles className="h-3.5 w-3.5 text-teal-400" />
            <span>Business Stats</span>
          </button>
          <button type="button" onClick={() => handleSelect(modal.setShowMapCoordsModal)} className={itemClass}>
            <MapIcon className="h-3.5 w-3.5 text-emerald-400" />
            <span>Map Coords &amp; Embeds</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
});
