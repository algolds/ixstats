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
 * The country's flag as the MyCountry header's cover art, for `PageHeader`'s `backdrop` slot. The
 * flag keeps its own palette (content art, never tinted) and stays vivid under a 10% page-background
 * wash; readability comes from the plates behind the text (see `BACKDROP_PLATE`), not from the art.
 *
 * `object-[center_35%]`: the image fills the header's width, so only the height is cropped, and
 * a 3:2 flag in a wide header would otherwise show only its middle stripe. Biasing up keeps
 * cantons, top bands and the upper half of centred emblems.
 */
export function FlagBanner({ src, onError }: FlagBannerProps) {
  if (!src) return null;
  return (
    <>
      <img
        src={src}
        alt=""
        decoding="async"
        onError={onError}
        className="size-full object-cover object-[center_35%] select-none"
      />
      <div data-slot="flag-banner-wash" className="bg-grouped/10 absolute inset-0" />
    </>
  );
}
