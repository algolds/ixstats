"use client";

import { useState } from "react";

interface FlagBannerProps {
  /** The country's flag; nothing renders without one, or when it fails to load. */
  src: string | null | undefined;
}

/**
 * The country's flag as the MyCountry header's cover art, for `PageHeader`'s `backdrop` slot. The
 * flag keeps its own palette (content art, never tinted) and stays vivid under a 10% page-background
 * wash; readability comes from the plates behind the text (see `BACKDROP_PLATE`), not from the art.
 *
 * `object-[center_35%]`: the image fills the header's width, so only the height is cropped, and
 * a 3:2 flag in a wide header would otherwise show only its middle stripe. Biasing up keeps
 * cantons, top bands and the upper half of centred emblems. Call sites pass `key={src}` so a failed
 * load resets when the flag changes.
 */
export function FlagBanner({ src }: FlagBannerProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <>
      <img
        src={src}
        alt=""
        decoding="async"
        onError={() => setFailed(true)}
        className="size-full object-cover object-[center_35%] select-none"
      />
      <div data-slot="flag-banner-wash" className="bg-grouped/10 absolute inset-0" />
    </>
  );
}
