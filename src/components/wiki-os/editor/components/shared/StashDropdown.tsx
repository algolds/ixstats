"use client";
/**
 * StashDropdown.tsx — Reusable Popover dropdown for exploring stashes and inserting Commons images.
 */

import React, { memo } from "react";
import { Bookmark, MediaImage as ImageIcon } from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { StashImageCard } from "../StashImageCard";
import { useEditorModalContext } from "../../context/EditorModalContext";
import { Button } from "~/components/ui/button";

export interface StashDropdownProps {
  onInsertImage: (filename: string) => void;
  onBeforeOpen?: () => void;
}

export const StashDropdown = memo(function StashDropdown({
  onInsertImage,
  onBeforeOpen,
}: StashDropdownProps) {
  const modal = useEditorModalContext();

  return (
    <Popover open={modal.stashesOpen} onOpenChange={modal.setStashesOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-label-secondary"
          title="Stashed Images"
          aria-label="Stashed Images"
          onClick={onBeforeOpen}
        >
          <Bookmark className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="text-label flex w-80 flex-col gap-2 p-3">
        <div className="border-separator flex items-center justify-between border-b pb-2">
          <span className="text-caption text-label-secondary flex items-center gap-2 font-semibold">
            <Bookmark className="text-yellow h-3.5 w-3.5" />
            <span>Stash Explorer</span>
          </span>
          {modal.stashes.length > 1 && (
            <Select value={modal.activeStashId} onValueChange={modal.setSelectedStashId}>
              <SelectTrigger size="sm" aria-label="Stash" className="max-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modal.stashes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.itemCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {modal.imageItems.length === 0 ? (
          <div className="text-label-secondary flex flex-col items-center justify-center p-6 text-center">
            <ImageIcon className="mb-2 h-6 w-6 opacity-40" />
            <div className="text-footnote">No media files in this stash</div>
            <div className="text-footnote text-label-secondary mt-1">
              Stash Commons images from the repository to quickly insert them here.
            </div>
          </div>
        ) : (
          <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto p-1">
            {modal.imageItems.map((item) => {
              const cleanTitle = item.pageTitle.replace(/^commons:/, "");
              const filename = cleanTitle.replace(/^File:/, "");
              const imgInfo = modal.imagesMap.get(item.pageTitle);
              return (
                <StashImageCard
                  key={item.id}
                  imgInfo={imgInfo}
                  cleanTitle={cleanTitle}
                  filename={filename}
                  onInsert={() => {
                    modal.setStashesOpen(false);
                    onInsertImage(filename);
                  }}
                />
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});
