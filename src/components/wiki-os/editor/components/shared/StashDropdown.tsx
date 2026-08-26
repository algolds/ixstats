/**
 * StashDropdown.tsx — Reusable Popover dropdown for exploring stashes and inserting Commons images.
 */
"use client";

import React, { memo } from "react";
import { Bookmark, MediaImage as ImageIcon } from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { StashImageCard } from "../StashImageCard";
import { useEditorModalContext } from "../../context/EditorModalContext";

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
      <PopoverTrigger
        className="wikios-editor-format-btn"
        title="Stashed Images"
        onClick={onBeforeOpen}
      >
        <Bookmark className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="glass-none z-[10001] flex w-80 flex-col gap-2 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-3 text-[var(--wikios-text)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--wikios-border)] pb-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--wikios-text-muted)]">
            <Bookmark className="h-3.5 w-3.5 text-amber-400" />
            <span>Stash Explorer</span>
          </span>
          {modal.stashes.length > 1 && (
            <select
              value={modal.activeStashId}
              onChange={(e) => modal.setSelectedStashId(e.target.value)}
              className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300 outline-none"
            >
              {modal.stashes.map((s) => (
                <option key={s.id} value={s.id} className="bg-zinc-900 text-white">
                  {s.name} ({s.itemCount})
                </option>
              ))}
            </select>
          )}
        </div>

        {modal.imageItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-400">
            <ImageIcon className="mb-2 h-6 w-6 opacity-40" />
            <div className="text-xs">No media files in this stash</div>
            <div className="mt-1 text-[10px] text-zinc-500">
              Stash Commons images from the repository to quickly insert them here.
            </div>
          </div>
        ) : (
          <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto p-1">
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
