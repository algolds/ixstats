// src/lib/onoma/name-sets.ts
// Onoma — Name Set categorization & full-name composition.
// A "Name Set" is a group of dictionaries sharing a setName, each tagged with a
// role (given/surname/...) and gender, combined via a template to Markov-generate
// full names (e.g. "{given:male} {surname}").

export type NameRole = "given" | "surname" | "particle" | "other";
export type NameGender = "male" | "female" | "any";

export const NAME_ROLES: { value: NameRole; label: string }[] = [
  { value: "given", label: "Given / First name" },
  { value: "surname", label: "Surname / Family name" },
  { value: "particle", label: "Particle (von, de, al-)" },
  { value: "other", label: "Other" },
];

export const NAME_GENDERS: { value: NameGender; label: string }[] = [
  { value: "any", label: "Any / Unisex" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export interface NameSlot {
  role: NameRole;
  gender: NameGender;
}

export interface NameTemplate {
  slots: NameSlot[];
  separator: string;
}

/**
 * Guess a dictionary's role & gender from its filename. Best-effort hint only —
 * the user can re-tag in the Stash editor.
 */
export function guessRoleGenderFromFilename(filename: string): {
  role: NameRole;
  gender: NameGender;
} {
  const s = filename.toLowerCase();
  let role: NameRole = "given";
  if (/sur\b|surname|last|family|clan|dynasty|house/.test(s)) role = "surname";
  else if (/particle|prefix|nobiliary/.test(s)) role = "particle";
  else if (/first|given|fore/.test(s)) role = "given";

  let gender: NameGender = "any";
  if (/(^|[^a-z])(female|fem|women|woman|girl|f)([^a-z]|$)/.test(s)) gender = "female";
  else if (/(^|[^a-z])(male|men|man|boy|m)([^a-z]|$)/.test(s)) gender = "male";

  return { role, gender };
}

/** Canonical ordering for default templates. */
const ROLE_ORDER: NameRole[] = ["particle", "given", "surname", "other"];

/**
 * Build a sensible default template from the roles present in a set.
 */
export function defaultTemplate(roles: NameRole[]): NameTemplate {
  const present = ROLE_ORDER.filter((r) => roles.includes(r));
  const slots: NameSlot[] = (present.length ? present : (["given"] as NameRole[])).map((role) => ({
    role,
    gender: "any",
  }));
  return { slots, separator: " " };
}

/** Does a dictionary tagged `dictGender` satisfy a slot requesting `slotGender`? */
export function genderMatches(slotGender: NameGender, dictGender: NameGender): boolean {
  if (slotGender === "any") return true;
  return dictGender === "any" || dictGender === slotGender;
}

// ponytail: self-check, run with `bun src/lib/onoma/name-sets.ts`
if (import.meta.main) {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL: " + m);
  };
  assert(guessRoleGenderFromFilename("roman_surnames.txt").role === "surname", "surname role");
  assert(guessRoleGenderFromFilename("female_first.txt").gender === "female", "female gender");
  assert(guessRoleGenderFromFilename("male-given.txt").gender === "male", "male gender");
  assert(guessRoleGenderFromFilename("clan.txt").role === "surname", "clan->surname");
  assert(defaultTemplate(["surname", "given"]).slots[0].role === "given", "given first");
  assert(defaultTemplate([]).slots.length === 1, "fallback slot");
  assert(genderMatches("male", "any") && !genderMatches("male", "female"), "gender match");
  console.log("name-sets self-check OK");
}
