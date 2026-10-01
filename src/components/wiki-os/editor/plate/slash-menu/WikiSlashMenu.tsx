"use client";
/**
 * WikiSlashMenu.tsx — Notion-style floating slash-command menu for the WikiOS
 * Plate editor. cmdk-backed with full keyboard navigation.
 */

import React, { useMemo } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import type { BaseEditor } from "slate";
import { SLASH_ITEMS, filterSlashItems, type SlashItem } from "./slash-items";

export interface WikiSlashMenuProps {
  open: boolean;
  query: string;
  anchorRect: { top: number; left: number } | null;
  editor: (BaseEditor & Record<string, any>) | null;
  onSelect: (item: SlashItem) => void;
  onClose: () => void;
}

const CATEGORY_ORDER = [
  "Basic Blocks",
  "Factbooks & Infoboxes",
  "Live Simulation Connectors",
] as const;

export function WikiSlashMenu({
  open,
  query,
  anchorRect,
  editor,
  onSelect,
  onClose,
}: WikiSlashMenuProps) {
  const items = useMemo(() => filterSlashItems(SLASH_ITEMS, query), [query]);
  const grouped = useMemo(() => {
    const map = new Map<string, SlashItem[]>();
    for (const item of items) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const);
  }, [items]);

  return (
    <Popover open={open && items.length > 0}>
      <PopoverTrigger className="hidden" aria-hidden />
      <PopoverContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onClose();
        }}
        style={
          anchorRect
            ? { position: "fixed", top: anchorRect.top, left: anchorRect.left, transform: "none" }
            : undefined
        }
        className="w-72 p-2"
      >
        <Command loop shouldFilter={false} value={query}>
          <CommandInput
            autoFocus
            value={query}
            onValueChange={() => undefined}
            placeholder="Insert…"
            className="hidden"
          />
          <CommandList>
            <CommandEmpty>
              <div className="text-label-secondary text-footnote px-2 py-3">No matches</div>
            </CommandEmpty>
            {grouped.map(([category, catItems]) => (
              <CommandGroup key={category} heading={category} className="text-footnote">
                {catItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.keywords.join(" ")}`}
                    onSelect={() => {
                      if (editor) item.execute(editor);
                      onSelect(item);
                    }}
                    className="rounded-control flex cursor-pointer items-center gap-2 px-3 py-2 active:scale-[0.98]"
                  >
                    <span className="text-label-secondary text-footnote w-5 text-center tabular-nums">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
