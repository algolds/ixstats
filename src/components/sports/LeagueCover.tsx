"use client";

import { useState } from "react";
import { sportCoverUrl } from "~/lib/sports/league-covers";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { monogram } from "./monogram";
import { SportGlyph } from "./SportGlyph";

/**
 * A competition's cover. The base is always the app tint with the competition's monogram and sport icon, so a
 * cover that is missing, slow or broken is never an empty block. Over it sits the competition's own cover photo;
 * without one its logo, whole and centred on the tint; without either a stadium photo for its sport.
 */
export function LeagueCover({
  name,
  sportPreset,
  coverImage,
  logo,
  seed,
  className,
}: {
  name: string;
  sportPreset: string;
  coverImage?: string | null;
  logo?: string | null;
  seed?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = !coverImage && Boolean(logo);
  const src = coverImage || (showLogo ? logo : sportCoverUrl(sportPreset, seed ?? sportPreset));

  return (
    <div
      data-slot="league-cover"
      aria-hidden
      className={cn("bg-tint-fill text-tint-ink relative overflow-hidden", className)}
    >
      {!(showLogo && !failed) && (
        <span className="text-display absolute inset-0 flex items-center justify-center select-none">
          {monogram(name)}
        </span>
      )}
      <SportGlyph sportPreset={sportPreset} className="absolute right-3 bottom-3 size-5" />
      {src && !failed && (
        <img
          src={withBasePath(src)}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 h-full w-full",
            showLogo ? "object-contain p-6" : "object-cover"
          )}
        />
      )}
    </div>
  );
}
