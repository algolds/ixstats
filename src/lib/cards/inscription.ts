/** Inscription text rules (client-safe: the sign dialog previews with the same check the server applies). */
import type { Prisma } from "@prisma/client";

export const INSCRIPTION_MAX = 60;

/**
 * What a whole copy row a player reads leaves out: who signed it and the name frozen with it. Only the card sheet names a
 * signer, behind their Vault cards switch (`sheet.ts`); the inscription itself travels with the copy.
 */
export const INSCRIPTION_OMIT = {
  inscribedById: true,
  inscribedName: true,
} as const satisfies Prisma.CardOwnershipOmit;

export type InscriptionCheck = { ok: true; text: string } | { ok: false; reason: string };

/**
 * Control and format characters that are neither whitespace nor a joiner: zero-width spaces, direction overrides and
 * isolates, the BOM, tag characters (which can carry hidden text). Whitespace controls (tabs, newlines) are left for
 * the collapse to turn into spaces.
 */
const INVISIBLE = /(?![\p{White_Space}\u200C\u200D])[\p{Cc}\p{Cf}]/gu;
/** Letters that draw as nothing: the Hangul fillers, the braille blank, the combining grapheme joiner. */
const BLANK = /[\u034F\u115F\u1160\u2800\u3164\uFFA0]/gu;
const JOINER = /[\u200C\u200D]/gu;
const LETTER_END = /\p{L}\p{M}*$/u;
const LETTER_START = /^\p{L}/u;
const EMOJI_END = /\p{Extended_Pictographic}[\p{Emoji_Modifier}\uFE0F]*$/u;
const EMOJI_START = /^\p{Extended_Pictographic}/u;
const WHITESPACE = /\p{White_Space}+/gu;
/** Half of a surrogate pair on its own: with the `u` flag it is its own code point, in `Cs`. */
const LONE_SURROGATE = /\p{Cs}/u;
const MARK_RUN = /\p{M}{5,}/u;
/** An angle bracket that can open a tag, a comment or an instruction; "<3", ">_<" and "->" are fine. */
const TAG = /<[\p{L}/!?]/u;
const LINK = /https?:\/\/|www\./i;

/**
 * A joiner (ZWJ, ZWNJ) stays between two letters, where Persian and Indic spelling need it, or between two emoji, where
 * it builds a sequence (a family, the rainbow flag). Anywhere else it only hides.
 */
function keepJoiners(text: string): string {
  return text.replace(JOINER, (joiner: string, at: number) => {
    const before = text.slice(0, at);
    const after = text.slice(at + 1);
    const letters = LETTER_END.test(before) && LETTER_START.test(after);
    return letters || (EMOJI_END.test(before) && EMOJI_START.test(after)) ? joiner : "";
  });
}

/**
 * The text as it is stored and printed, or why it cannot be: cleaned (what cannot be seen goes, whitespace collapses),
 * NFC-normalised last, then checked. Its length is in characters, as the column counts them.
 */
export function sanitizeInscription(raw: string): InscriptionCheck {
  if (LONE_SURROGATE.test(raw)) return { ok: false, reason: "This text has a broken character." };
  const visible = keepJoiners(raw.replace(INVISIBLE, "").replace(BLANK, ""));
  const text = visible.replace(WHITESPACE, " ").trim().normalize("NFC");
  if (!text) return { ok: false, reason: "Write something to sign this card." };
  if ([...text].length > INSCRIPTION_MAX) {
    return { ok: false, reason: `Keep it to ${INSCRIPTION_MAX} characters.` };
  }
  if (MARK_RUN.test(text)) return { ok: false, reason: "Use fewer marks on one letter." };
  if (TAG.test(text)) return { ok: false, reason: "HTML tags aren't allowed." };
  if (LINK.test(text)) return { ok: false, reason: "Links aren't allowed." };
  return { ok: true, text };
}
