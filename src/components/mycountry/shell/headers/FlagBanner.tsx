"use client";

import { useState } from "react";

interface FlagBannerProps {
  /** The country's flag; nothing renders without one, or when it fails to load. */
  src: string | null | undefined;
}

/**
 * The country's flag as the MyCountry header's cover art, for `PageHeader`'s `backdrop` slot. The
 * flag keeps its own palette (content art, never tinted); readability comes from the
 * `shell-banner-scrim` layer on top, which is defined in shell.css with its contrast maths.
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
        className="size-full object-cover object-center select-none"
      />
      <div data-slot="flag-banner-scrim" className="shell-banner-scrim absolute inset-0" />
    </>
  );
}
