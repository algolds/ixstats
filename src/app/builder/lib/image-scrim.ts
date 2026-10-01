/**
 * On-image roles for the builder (Facet 3 has no on-image colour role yet, spec §2.1).
 *
 * Text and actions laid over arbitrary photos, flags and emblems cannot use the label roles —
 * those flip with the theme while the image does not. A fixed white-on-black scrim stays legible
 * over any image in both themes, so every builder image overlay uses these classes and nothing
 * else spells `text-white` / `bg-black/*` by hand.
 */

/** A flat scrim band or full overlay over an image, with its text colour (≥ 4.5:1 over any image). */
export const IMAGE_SCRIM = "bg-black/60 text-white";

/** A lighter hover scrim for small thumbnails (an icon only, no body text). */
export const IMAGE_SCRIM_LIGHT = "bg-black/40 text-white";

/** A pressable icon action sitting on an `IMAGE_SCRIM`. */
export const IMAGE_SCRIM_ACTION = "bg-white/20 text-white hover:bg-white/30";
