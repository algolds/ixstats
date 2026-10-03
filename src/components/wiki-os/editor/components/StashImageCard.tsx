"use client";
// src/components/wiki-os/editor/components/StashImageCard.tsx
// Thumbnail card for Commons images in the Stash Explorer popover.

import React, { useState } from "react";
import { Copy, Check } from "iconoir-react";
import { Button } from "~/components/ui/button";

export interface StashImageCardProps {
  imgInfo: any;
  cleanTitle: string;
  filename: string;
  onInsert: () => void;
}

export function StashImageCard({ imgInfo, cleanTitle, filename, onInsert }: StashImageCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`[[File:${filename}|thumb|]]`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onInsert}
      className="group rounded-control border-separator bg-fill-4 hover:border-separator hover:bg-fill-4 relative aspect-square cursor-pointer overflow-hidden border text-white transition-[color,background-color,border-color,box-shadow,opacity,transform]"
      title={`Click to insert [[File:${filename}]]`}
    >
      {imgInfo?.thumbUrl ? (
        <img
          src={imgInfo.thumbUrl}
          alt={cleanTitle}
          className="h-full w-full object-cover transition-transform duration-200"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="border-separator border-t-separator h-3 w-3 animate-spin rounded-full border" />
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Copy wikitext link"
          onClick={handleCopy}
          title="Copy wikitext link"
          className="size-6 bg-black/60 text-white hover:bg-black/80"
        >
          {copied ? <Check className="text-green h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>

      <div className="text-footnote absolute inset-x-0 bottom-0 truncate bg-black/60 p-1 text-white">
        {cleanTitle}
      </div>
    </div>
  );
}
