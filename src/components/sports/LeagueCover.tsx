"use client";

import { useState } from "react";
import { getSportEmoji } from "~/lib/sports/presets";
import { sportCoverUrl } from "~/lib/sports/league-covers";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";

export function LeagueCover({
  sportPreset,
  coverImage,
  seed,
  className,
  alt = "",
}: {
  sportPreset: string;
  coverImage?: string | null;
  seed?: string;
  className?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = coverImage || sportCoverUrl(sportPreset, seed ?? sportPreset);
  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-4xl",
          className
        )}
        aria-label={alt}
      >
        <span>{getSportEmoji(sportPreset)}</span>
      </div>
    );
  }
  return (
    <img src={withBasePath(src)} alt={alt} onError={() => setFailed(true)} className={className} />
  );
}
