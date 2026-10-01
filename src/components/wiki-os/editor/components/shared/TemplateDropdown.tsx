"use client";
/**
 * TemplateDropdown.tsx — Reusable Popover dropdown for quick template triggers.
 */

import React, { memo } from "react";
import { Puzzle, Sparks as Sparkles, Map as MapIcon } from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { useEditorModalContext } from "../../context/EditorModalContext";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

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

/** A command row in the template popover. */
const itemClass = "text-label w-full justify-start";

export const TemplateDropdown = memo(function TemplateDropdown({
  onSelect,
  onBeforeOpen,
  triggerContent,
  triggerClassName,
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
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={triggerContent ? "sm" : "icon-sm"}
          className={cn("text-label-secondary", triggerClassName)}
          title="Insert Template"
          aria-label={triggerContent ? undefined : "Insert Template"}
          onClick={onBeforeOpen}
        >
          {triggerContent ?? <Puzzle className="size-3.5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="text-label w-56 p-1">
        <div className="text-footnote flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSelect(modal.setShowInfoboxModal)}
            className={itemClass}
          >
            <Puzzle className="text-tint h-3.5 w-3.5" />
            <span>Infobox Country</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSelect(modal.setShowCountryStatsModal)}
            className={itemClass}
          >
            <Sparkles className="text-yellow h-3.5 w-3.5" />
            <span>Country Stats</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSelect(modal.setShowBusinessStatsModal)}
            className={itemClass}
          >
            <Sparkles className="text-teal h-3.5 w-3.5" />
            <span>Business Stats</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSelect(modal.setShowMapCoordsModal)}
            className={itemClass}
          >
            <MapIcon className="text-green h-3.5 w-3.5" />
            <span>Map Coords &amp; Embeds</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
});
