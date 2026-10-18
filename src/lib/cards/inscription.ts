/** Inscription text rules (client-safe: the sign dialog previews with the same check the server applies). */

export const INSCRIPTION_MAX = 60;

export type InscriptionCheck = { ok: true; text: string } | { ok: false; reason: string };

/**
 * Control and format characters that are not whitespace: zero-width spaces, direction overrides and isolates, the BOM.
 * Whitespace controls (tabs, newlines) are left for the collapse to turn into spaces.
 */
const INVISIBLE = /(?!\p{White_Space})[\p{Cc}\p{Cf}]/gu;
const WHITESPACE = /\p{White_Space}+/gu;
const LINK = /https?:\/\/|www\./i;

/** The text as it is stored and printed, or why it cannot be. Its length is in characters, as the column counts them. */
export function sanitizeInscription(raw: string): InscriptionCheck {
  const text = raw.normalize("NFC").replace(INVISIBLE, "").replace(WHITESPACE, " ").trim();
  if (!text) return { ok: false, reason: "Write something to sign this card." };
  if ([...text].length > INSCRIPTION_MAX) {
    return { ok: false, reason: `Keep it to ${INSCRIPTION_MAX} characters.` };
  }
  if (/[<>]/.test(text)) return { ok: false, reason: "Angle brackets aren't allowed." };
  if (LINK.test(text)) return { ok: false, reason: "Links aren't allowed." };
  return { ok: true, text };
}
