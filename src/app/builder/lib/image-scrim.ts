/**
 * On-image roles for the builder.
 *
 * Text and actions laid over arbitrary photos, flags and emblems cannot use the label roles —
 * those flip with the theme while the image does not. A fixed white-on-black scrim stays legible
 * over any image in both themes, so every builder image overlay uses these classes and nothing
 * else spells `text-white` / `bg-black/*` by hand.
 */

/** A flat scrim band or full overlay over an image, with its text colour. */
export const IMAGE_SCRIM = "bg-black/60 text-white";

/** A lighter hover scrim for small thumbnails (an icon only, no body text). */
export const IMAGE_SCRIM_LIGHT = "bg-black/40 text-white";

/** A pressable icon action sitting on an `IMAGE_SCRIM`. */
export const IMAGE_SCRIM_ACTION = "bg-white/20 text-white hover:bg-white/30";

/**
 * Touch (coarse pointer — no hover): a hover-reveal action overlay (`absolute inset-0`, `opacity-0`
 * until hover/focus) stays visible, collapsed to a corner cluster so the image still shows. Each
 * action on it adds `IMAGE_SCRIM_TOUCH_ACTION` to carry its own scrim. Buttons keep the 44pt
 * coarse-pointer hit slop (`Button`), so leave ≥ 4px between the cluster and the image edge.
 */
export const IMAGE_SCRIM_TOUCH_CLUSTER =
  "pointer-coarse:opacity-100 pointer-coarse:items-end pointer-coarse:justify-end pointer-coarse:bg-transparent pointer-coarse:p-1";

/** An `IMAGE_SCRIM_ACTION` inside an `IMAGE_SCRIM_TOUCH_CLUSTER`: its own scrim on touch. */
export const IMAGE_SCRIM_TOUCH_ACTION = "pointer-coarse:bg-black/60";

/**
 * Touch (coarse pointer): a hover-reveal overlay on a small thumbnail or emblem becomes an
 * always-visible band along its bottom edge (the iOS "Edit" band on a contact photo), so the
 * image stays readable and the edit affordance is discoverable. The pressable is the whole image.
 */
export const IMAGE_SCRIM_TOUCH_BAND =
  "pointer-coarse:opacity-100 pointer-coarse:top-auto pointer-coarse:h-4";
