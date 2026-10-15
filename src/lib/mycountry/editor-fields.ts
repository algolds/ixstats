/**
 * The national identity fields the country editor edits, by section, with their labels, helpers
 * and checks. Shared by the editor (fields and inline errors) and `countries.saveIdentity` (the
 * same checks on the server), so a value the page accepts is a value the server saves.
 */

export const IDENTITY_SECTION_IDS = ["symbols", "language", "culture", "civic"] as const;
export type IdentitySectionId = (typeof IDENTITY_SECTION_IDS)[number];

/** NationalIdentity text columns the editor writes. */
export const EDITOR_IDENTITY_KEYS = [
  "nationalAnthem",
  "nationalAnimal",
  "nationalFlower",
  "nationalBird",
  "nationalSymbol",
  "capitalCity",
  "largestCity",
  "officialLanguages",
  "nationalLanguage",
  "currency",
  "currencySymbol",
  "motto",
  "mottoNative",
  "officialName",
  "demonym",
  "nationalReligion",
  "nationalDay",
  "founders",
  "nationalSport",
  "nationalDish",
  "nationalDrink",
  "nationalInstrument",
  "isoCode",
  "internetTLD",
  "callingCode",
  "emergencyNumber",
  "timeZone",
  "postalCodeFormat",
  "drivingSide",
  "weekStartDay",
] as const;
export type EditorIdentityKey = (typeof EDITOR_IDENTITY_KEYS)[number];

/** Country columns the Flag and symbols section writes beside the identity. */
export const EDITOR_COUNTRY_IMAGE_KEYS = ["flag", "coatOfArms"] as const;
export type EditorCountryImageKey = (typeof EDITOR_COUNTRY_IMAGE_KEYS)[number];

export const MAX_IDENTITY_TEXT = 300;

export const DRIVING_SIDES = [
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
] as const;

export const WEEK_START_DAYS = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
  { value: "saturday", label: "Saturday" },
] as const;

export interface IdentityFieldSpec {
  key: EditorIdentityKey;
  label: string;
  helper?: string;
  placeholder?: string;
  /** A one-of choice instead of free text. */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Lower or upper case applied as typed. */
  transform?: "upper" | "lower";
  /** Why a non-empty value is not accepted, or null. */
  check?: (value: string) => string | null;
}

const pattern = (re: RegExp, message: string) => (value: string) =>
  re.test(value) ? null : message;

export const IDENTITY_FIELDS: Record<IdentitySectionId, IdentityFieldSpec[]> = {
  symbols: [
    {
      key: "nationalAnthem",
      label: "National anthem",
      helper: "The title of the anthem, as it appears on your wiki page.",
    },
    { key: "nationalAnimal", label: "National animal", placeholder: "Lion" },
    { key: "nationalFlower", label: "National flower", placeholder: "Lotus" },
    { key: "nationalBird", label: "National bird", placeholder: "Falcon" },
    {
      key: "nationalSymbol",
      label: "Other national symbol",
      helper: "Any other emblem your people know the nation by.",
    },
  ],
  language: [
    {
      key: "capitalCity",
      label: "Capital city",
      helper: "Place it on the map in the map editor to show it there.",
    },
    {
      key: "largestCity",
      label: "Largest city",
      helper: "Leave empty when the capital is also the largest city.",
    },
    {
      key: "officialLanguages",
      label: "Official languages",
      helper: "Separate several with commas.",
      placeholder: "English, French",
    },
    {
      key: "nationalLanguage",
      label: "Other languages",
      helper: "A common or regional language that is not official.",
    },
    { key: "currency", label: "Currency", placeholder: "Eldorian crown" },
    {
      key: "currencySymbol",
      label: "Currency symbol",
      placeholder: "₡",
      check: (v) => (v.length <= 5 ? null : "Use 5 characters or fewer."),
    },
    { key: "motto", label: "Motto", helper: "In the language most players read." },
    {
      key: "mottoNative",
      label: "Motto in the national language",
      helper: "Optional. Shown beside the motto.",
    },
  ],
  culture: [
    {
      key: "officialName",
      label: "Official name",
      helper: "The full formal name, such as Republic of Eldoria.",
    },
    {
      key: "demonym",
      label: "Demonym",
      helper: "What your people are called, such as Eldorian.",
    },
    {
      key: "nationalReligion",
      label: "Religion",
      helper: "The main or state religion, or Secular.",
    },
    { key: "nationalDay", label: "National day", placeholder: "4 July" },
    { key: "founders", label: "Founders", helper: "The people or dynasty that founded it." },
    { key: "nationalSport", label: "National sport" },
    { key: "nationalDish", label: "National dish" },
    { key: "nationalDrink", label: "National drink" },
    { key: "nationalInstrument", label: "National instrument" },
  ],
  civic: [
    {
      key: "isoCode",
      label: "Country code",
      helper: "Two or three letters, like an ISO code.",
      placeholder: "EL",
      transform: "upper",
      check: pattern(/^[A-Z]{2,3}$/, "Use 2 or 3 letters."),
    },
    {
      key: "internetTLD",
      label: "Web domain",
      helper: "The internet domain ending for your nation.",
      placeholder: ".el",
      transform: "lower",
      check: pattern(/^\.[a-z]{2,10}$/, "Start with a dot, then 2 to 10 letters, such as .el."),
    },
    {
      key: "callingCode",
      label: "Calling code",
      placeholder: "+35",
      check: pattern(/^\+[0-9][0-9 -]{0,7}$/, "Start with + and use digits, such as +35."),
    },
    {
      key: "emergencyNumber",
      label: "Emergency number",
      placeholder: "112",
      check: pattern(/^[0-9][0-9 ,/]{0,15}$/, "Use digits, such as 112."),
    },
    { key: "timeZone", label: "Time zone", placeholder: "UTC+1" },
    { key: "postalCodeFormat", label: "Postal code format", placeholder: "12345" },
    {
      key: "drivingSide",
      label: "Driving side",
      helper: "The side of the road traffic keeps to.",
      options: DRIVING_SIDES,
    },
    {
      key: "weekStartDay",
      label: "Week starts on",
      options: WEEK_START_DAYS,
    },
  ],
};

const SPEC_BY_KEY = new Map<EditorIdentityKey, IdentityFieldSpec>(
  Object.values(IDENTITY_FIELDS).flatMap((fields) => fields.map((f) => [f.key, f] as const))
);

/** Why a value cannot be saved in this field, or null. Empty always saves (it clears the field). */
export function identityFieldError(key: EditorIdentityKey, raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;
  if (value.length > MAX_IDENTITY_TEXT) return `Use ${MAX_IDENTITY_TEXT} characters or fewer.`;
  const spec = SPEC_BY_KEY.get(key);
  if (spec?.options && !spec.options.some((o) => o.value === value)) return "Pick one option.";
  return spec?.check?.(value) ?? null;
}

/** The message a stale tab gets when the nation changed since the editor loaded it. */
export const STALE_EDITOR_MESSAGE = "This nation changed since you opened it";

/** Defined (described) government components a nation may have at once. */
export const MAX_DEFINED_COMPONENTS = 15;

/** The exact figures the Size section accepts. */
export const POPULATION_LIMITS = { min: 1_000, max: 5_000_000_000 } as const;
export const GDP_PER_CAPITA_LIMITS = { min: 100, max: 500_000 } as const;
