/** The voices a persona speaks with on the forum. A personal account is the member themself, so it has none. */
export const PERSONA_TYPES = ["government", "media", "citizen"] as const;

export type PersonaType = (typeof PERSONA_TYPES)[number];

/** A ThinkPages account's `accountType` as a forum persona type; null for personal or unknown accounts. */
export function personaTypeOf(accountType: string | null | undefined): PersonaType | null {
  return (PERSONA_TYPES as readonly string[]).includes(accountType ?? "")
    ? (accountType as PersonaType)
    : null;
}
