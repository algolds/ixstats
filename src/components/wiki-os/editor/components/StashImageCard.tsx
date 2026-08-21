// src/components/wiki-os/editor/components/StashImageCard.tsx
// Thumbnail card for Commons images in the Stash Explorer popover.

"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

export interface StashImageCardProps {
  imgInfo: any;
  cleanTitle: string;
  filename: string;
  onInsert: () => void;
}

export function StashImageCard({
  imgInfo,
  cleanTitle,
  filename,
  onInsert,
}: StashImageCardProps) {
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
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-white/5 bg-white/5 text-white transition-all hover:border-white/10 hover:bg-white/10"
      title={`Click to insert [[File:${filename}]]`}
    >
      {imgInfo?.thumbUrl ? (
        <img
          src={imgInfo.thumbUrl}
          alt={cleanTitle}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-3 w-3 animate-spin rounded-full border border-zinc-700 border-t-zinc-400" />
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-white/10 bg-zinc-950/80 p-1 text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
          title="Copy Wikitext Link"
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent p-1 text-[8px] text-zinc-300 group-hover:text-white">
        {cleanTitle}
      </div>
    </div>
  );
}
