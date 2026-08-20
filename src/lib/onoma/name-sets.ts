// src/lib/onoma/name-sets.ts
// Onoma — Name Set categorization & full-name composition.
// A "Name Set" is a group of dictionaries sharing a setName, each tagged with a
// role (given/surname/...) and gender, combined via a template to Markov-generate
// full names (e.g. "{given:male} {surname}").

export type NameRole =
  "given" | "surname" | "particle" | "patronymic" | "matronymic" | "nomen" | "agnomen" | "other";
export type NameGender = "any" | "male" | "female";

export const NAME_ROLES: { value: NameRole; label: string }[] = [
  { value: "given", label: "Given / First name" },
  { value: "surname", label: "Surname / Family name" },
  { value: "particle", label: "Particle (von, de, al-)" },
  { value: "patronymic", label: "Patronymic (father-based)" },
  { value: "matronymic", label: "Matronymic (mother-based)" },
  { value: "nomen", label: "Nomen (Estate name)" },
  { value: "agnomen", label: "Agnomen (Epithet/title)" },
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
  prefix?: string;
  suffix?: string;
  parentName?: string;
  genderMode?: "fixed" | "aligned";
  suffixRule?: "hendalarsk-matronymic" | "yonderian-patronymic" | "caphirian-lineage" | "none";
}

export interface NameTemplate {
  slots: NameSlot[];
  separator: string;
  presetKey?: string;
}

export interface ConventionPreset {
  key: string;
  name: string;
  description: string;
  template: NameTemplate;
}

export const CONVENTION_PRESETS: ConventionPreset[] = [
  {
    key: "custom",
    name: "Custom / Manual",
    description: "Build your own custom slots and rules manually.",
    template: {
      slots: [{ role: "given", gender: "any", genderMode: "aligned" }],
      separator: " ",
      presetKey: "custom",
    },
  },
  {
    key: "hendalarsk",
    name: "Hendalarskara (4-name)",
    description:
      "Fornám (given), Kvalnám (chosen), Muternám (matronymic with child-gender suffix -són/-toschter/-kind), and Erbnám (surname).",
    template: {
      separator: " ",
      presetKey: "hendalarsk",
      slots: [
        { role: "given", gender: "any", genderMode: "aligned" },
        { role: "given", gender: "any", genderMode: "aligned" },
        {
          role: "matronymic",
          gender: "any",
          genderMode: "aligned",
          suffixRule: "hendalarsk-matronymic",
        },
        { role: "surname", gender: "any", genderMode: "aligned" },
      ],
    },
  },
  {
    key: "caphiria",
    name: "Caphirian Quadranomial",
    description:
      "Inscriptio (given), Electi (personal name chosen at 16), Proles/Ramus (patronymic/matronymic), and Cognomina Fluminis (Estate river-surname).",
    template: {
      separator: " ",
      presetKey: "caphiria",
      slots: [
        { role: "given", gender: "any", genderMode: "aligned" },
        { role: "given", gender: "any", genderMode: "aligned" },
        {
          role: "patronymic",
          gender: "any",
          genderMode: "aligned",
          suffixRule: "caphirian-lineage",
        },
        { role: "surname", gender: "any", genderMode: "aligned" },
      ],
    },
  },
  {
    key: "urcea",
    name: "Urcean Tria Nomina",
    description:
      "Praenomen (given), Nomen (Estate name, defaults to 'Julianus' for commoners), and Cognomen (family name) + optional Agnomen (victory title).",
    template: {
      separator: " ",
      presetKey: "urcea",
      slots: [
        { role: "given", gender: "any", genderMode: "aligned" },
        { role: "nomen", gender: "any", genderMode: "aligned" },
        { role: "surname", gender: "any", genderMode: "aligned" },
        { role: "agnomen", gender: "any", genderMode: "aligned" },
      ],
    },
  },
  {
    key: "yonderian-noble",
    name: "Yonderian Noble",
    description:
      "Noble naming pattern: Given name followed by family surname prefixed with 'von' (e.g. von Willing).",
    template: {
      separator: " ",
      presetKey: "yonderian-noble",
      slots: [
        { role: "given", gender: "any", genderMode: "aligned" },
        { role: "surname", gender: "any", genderMode: "aligned", prefix: "von " },
      ],
    },
  },
  {
    key: "yonderian-peasant",
    name: "Yonderian Peasantry",
    description:
      "Peasant naming pattern: Given name followed by patronymic (father's name + child-gender suffix -son/-daughter).",
    template: {
      separator: " ",
      presetKey: "yonderian-peasant",
      slots: [
        { role: "given", gender: "any", genderMode: "aligned" },
        {
          role: "patronymic",
          gender: "any",
          genderMode: "aligned",
          suffixRule: "yonderian-patronymic",
        },
      ],
    },
  },
  {
    key: "khunyer",
    name: "Khunyer Reversed",
    description:
      "Reversed order naming: Surname / Family name comes first, followed by the Given name.",
    template: {
      separator: " ",
      presetKey: "khunyer",
      slots: [
        { role: "surname", gender: "any", genderMode: "aligned" },
        { role: "given", gender: "any", genderMode: "aligned" },
      ],
    },
  },
];

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
