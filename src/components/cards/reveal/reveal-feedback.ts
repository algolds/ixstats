import { isSoundMuted, soundCues } from "~/lib/sound/cuelume";
import { revealFeedbackFor } from "~/lib/cards/face/reveal";
import type { CardRarity } from "~/lib/cards/face/types";

/** A short buzz: the reveal's haptics stay light. */
const HAPTIC_MS = 40;

/**
 * The feedback for one turned card: the site's reveal cue (it follows the sound switch and Reduce Motion itself) and,
 * for Epic and rarer, a light buzz. The site has no haptics setting, so the buzz follows the sound switch too, and
 * Reduce Motion turns it off.
 */
export function playRevealFeedback(rarity: CardRarity, reducedMotion: boolean): void {
  const { sound, haptic } = revealFeedbackFor(rarity);
  if (sound) soundCues?.reveal?.();
  if (!haptic || reducedMotion || isSoundMuted()) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(HAPTIC_MS);
}
