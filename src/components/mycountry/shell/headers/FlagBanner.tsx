"use client";

import type { CSSProperties } from "react";
import { assetUrl, withBasePath } from "~/lib/base-path";

interface FlagBannerProps {
  /** The country's flag (an upload's root path gets the base path); nothing renders without one. */
  src: string | null | undefined;
  /**
   * The image failed to load. The owner decides what that means (the MyCountry header swaps in its
   * monogram and drops the action pill plates), so the failure is reported rather than kept here.
   */
  onError?: () => void;
}

const MYCOUNTRY_MONOGRAM = {
  "--monogram": `url("${withBasePath("/images/ix-monogram-mycountry.svg")}")`,
} as CSSProperties;

/**
 * The country's flag as the MyCountry header's cover art, for `PageHeader`'s `backdrop` slot. It
 * spans the header and fades into the canvas at the bottom and sides instead of ending at the
 * header's box. The flag keeps its own palette (content art, never tinted); readability comes from
 * the frosted Lens behind the title and the plates behind the action pills (see `BACKDROP_PLATE`).
 * Hovering the header (`group/hero`) drifts it.
 *
 * `object-[center_35%]`: the flag is cropped by height in a wide header, and a 3:2 flag would
 * otherwise show only its middle stripe. Biasing up keeps cantons, top bands and emblems.
 */
export function FlagBanner({ src, onError }: FlagBannerProps) {
  const resolved = assetUrl(src);
  if (!resolved) return null;
  return (
    <img
      src={resolved}
      alt=""
      decoding="async"
      onError={onError}
      className="duration-drift ease-out-facet absolute inset-0 size-full scale-105 mask-x-from-95% mask-b-from-30% object-cover object-[center_35%] transition-transform select-none motion-safe:group-hover/hero:-translate-x-[2%] motion-safe:group-hover/hero:-translate-y-[1%]"
    />
  );
}

/**
 * The MyCountry monogram behind the header when the country has no flag (or its flag failed to
 * load), so the title Lens still has a decorative pattern to sit over and bend. Inherits the gold
 * tint from MyCountry's `data-app` scope.
 */
export function MonogramBanner() {
  return (
    <div
      aria-hidden
      data-slot="monogram-banner"
      className="facet-monogram absolute inset-0"
      style={MYCOUNTRY_MONOGRAM}
    />
  );
}
