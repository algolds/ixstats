"use client";

interface FlagBannerProps {
  /** The country's flag; nothing renders without one. */
  src: string | null | undefined;
  /**
   * The image failed to load. The owner decides what that means (the MyCountry header drops the
   * plates that only exist to sit over art), so the failure is reported rather than kept here.
   */
  onError?: () => void;
}

/**
 * The country's flag as the MyCountry header's cover art, for `PageHeader`'s `backdrop` slot. It
 * spans the header and fades into the canvas at the bottom and sides instead of ending at the
 * header's box. The flag keeps its own palette (content art, never tinted); readability comes from
 * the plates behind the text (see `BACKDROP_PLATE`). Hovering the header (`group/hero`) drifts it.
 *
 * `object-[center_35%]`: the flag is cropped by height in a wide header, and a 3:2 flag would
 * otherwise show only its middle stripe. Biasing up keeps cantons, top bands and emblems.
 */
export function FlagBanner({ src, onError }: FlagBannerProps) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      decoding="async"
      onError={onError}
      className="duration-drift ease-out-facet absolute inset-0 size-full scale-105 mask-x-from-95% mask-b-from-30% object-cover object-[center_35%] transition-transform select-none motion-safe:group-hover/hero:-translate-x-[2%] motion-safe:group-hover/hero:-translate-y-[1%]"
    />
  );
}
