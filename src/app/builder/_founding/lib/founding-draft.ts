/**
 * The founding draft: the whole state of the founding flow (realm, start, identity, government,
 * size and wealth, the wiki import and the step), stored as one server draft. Pure functions only,
 * so the step gating and the archetype rules are testable without React.
 */

import type { ComponentType } from "@prisma/client";
import {
  DEFAULT_GOVERNMENT_FORM_ID,
  GOVERNMENT_FORM_IDS,
  getGovernmentForm,
  type GovernmentFormId,
  type GovernmentInstitutions,
} from "~/lib/government/forms";
import {
  POPULATION_BAND_IDS,
  WEALTH_BAND_IDS,
  bandForGdpPerCapita,
  bandForPopulation,
  type PopulationBandId,
  type WealthBandId,
} from "~/lib/builder/founding-bands";
import { isRealmImageUrl } from "~/lib/realms/realm-region";
import { getArchetypeOption, suggestArchetype } from "./founding-archetypes";

// ---------------------------------------------------------------------------------------------
// Steps

export const FOUNDING_STEP_IDS = [
  "realm",
  "start",
  "identity",
  "government",
  "economy",
  "review",
] as const;
export type FoundingStepId = (typeof FOUNDING_STEP_IDS)[number];

export const FOUNDING_STEP_LABELS: Record<FoundingStepId, string> = {
  realm: "Realm",
  start: "Start",
  identity: "Identity",
  government: "Government",
  economy: "Economy",
  review: "Review",
};

export function isFoundingStepId(value: unknown): value is FoundingStepId {
  return typeof value === "string" && (FOUNDING_STEP_IDS as readonly string[]).includes(value);
}

/** The steps a player sees: the realm step only when they can found in more than one realm. */
export function visibleSteps(chooseRealm: boolean): FoundingStepId[] {
  return FOUNDING_STEP_IDS.filter((step) => chooseRealm || step !== "realm");
}

// ---------------------------------------------------------------------------------------------
// Draft shape

export const MAX_GOVERNMENT_COMPONENTS = 15;

/** What a founding sends when the player gives no exact figure and no band (a blank start). */
export const DEFAULT_POPULATION = 10_000_000;
export const DEFAULT_GDP_PER_CAPITA = 25_000;

export const POPULATION_RANGE = { min: 10_000, max: 2_000_000_000 } as const;
export const GDP_PER_CAPITA_RANGE = { min: 500, max: 250_000 } as const;

export interface FoundingIdentity {
  name: string;
  flagUrl: string;
  capitalCity: string;
  officialLanguages: string;
  currency: string;
  motto: string;
  officialName: string;
  demonym: string;
  nationalAnimal: string;
  nationalFlower: string;
  nationalReligion: string;
  nationalAnthem: string;
  callingCode: string;
  internetTLD: string;
  isoCode: string;
  /** "", "left" or "right". */
  drivingSide: string;
  /** "", or a lowercase day name. */
  weekStartDay: string;
}

export type IdentityFieldId = keyof FoundingIdentity;

export const WIKI_SITE_IDS = ["iiwiki", "althistory"] as const;
export type WikiSiteId = (typeof WIKI_SITE_IDS)[number];

/** What the wiki import found and the player kept; applied once, never re-fetched. */
export interface FoundingImport {
  site: WikiSiteId;
  title: string;
  /** The infobox's government value as written, shown next to the form it maps to. */
  governmentRaw: string | null;
  formId: GovernmentFormId | null;
  population: number | null;
  gdpPerCapita: number | null;
  suggestedArchetype: string | null;
}

export interface FoundingDraft {
  kind: "founding";
  version: 1;
  /** When the player last changed something (ms); the newer of the server and local copy wins. */
  updatedAt: number;
  step: FoundingStepId;
  realmId: string | null;
  start: {
    /** The card selected on the Start step; Continue applies it. */
    selection: string | null;
    /** True once a start (an archetype or blank) has been applied. */
    applied: boolean;
    /** The applied archetype; null for a blank start. */
    archetypeKey: string | null;
  };
  identity: FoundingIdentity;
  government: {
    formId: GovernmentFormId;
    /** Null while the form's own component set is used. */
    components: ComponentType[] | null;
    /** Only the institution names the player changed. */
    institutions: Partial<GovernmentInstitutions>;
  };
  economy: {
    populationBand: PopulationBandId | null;
    wealthBand: WealthBandId | null;
    exactPopulation: number | null;
    exactGdpPerCapita: number | null;
  };
  imported: FoundingImport | null;
  /** Set by a Review "Edit" link: Continue goes back to Review. */
  returnToReview: boolean;
}

export const EMPTY_IDENTITY: FoundingIdentity = {
  name: "",
  flagUrl: "",
  capitalCity: "",
  officialLanguages: "",
  currency: "",
  motto: "",
  officialName: "",
  demonym: "",
  nationalAnimal: "",
  nationalFlower: "",
  nationalReligion: "",
  nationalAnthem: "",
  callingCode: "",
  internetTLD: "",
  isoCode: "",
  drivingSide: "",
  weekStartDay: "",
};

export function emptyFoundingDraft(): FoundingDraft {
  return {
    kind: "founding",
    version: 1,
    updatedAt: 0,
    step: "start",
    realmId: null,
    start: { selection: null, applied: false, archetypeKey: null },
    identity: { ...EMPTY_IDENTITY },
    government: { formId: DEFAULT_GOVERNMENT_FORM_ID, components: null, institutions: {} },
    economy: {
      populationBand: null,
      wealthBand: null,
      exactPopulation: null,
      exactGdpPerCapita: null,
    },
    imported: null,
    returnToReview: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Reading a stored draft

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown) => (typeof value === "string" ? value : "");
const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
const oneOf = <T extends string>(list: readonly T[], value: unknown): T | null =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : null;

const INSTITUTION_KEYS: Array<keyof GovernmentInstitutions> = [
  "headOfStateTitle",
  "headOfGovernmentTitle",
  "legislatureName",
  "executiveName",
  "judicialName",
];

/**
 * A stored draft, checked field by field; null for anything that is not a founding draft (an
 * old builder draft, or junk). Unknown or broken fields fall back to their empty value.
 */
export function parseFoundingDraft(value: unknown): FoundingDraft | null {
  if (!isRecord(value) || value.kind !== "founding" || value.version !== 1) return null;
  const empty = emptyFoundingDraft();
  const start = isRecord(value.start) ? value.start : {};
  const identity = isRecord(value.identity) ? value.identity : {};
  const government = isRecord(value.government) ? value.government : {};
  const economy = isRecord(value.economy) ? value.economy : {};
  const imported = isRecord(value.imported) ? value.imported : null;
  const institutions = isRecord(government.institutions) ? government.institutions : {};
  const site = imported ? oneOf(WIKI_SITE_IDS, imported.site) : null;

  return {
    ...empty,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0,
    step: oneOf(FOUNDING_STEP_IDS, value.step) ?? empty.step,
    realmId: str(value.realmId) || null,
    start: {
      selection: getArchetypeOption(str(start.selection)) ? str(start.selection) : null,
      applied: start.applied === true,
      archetypeKey: getArchetypeOption(str(start.archetypeKey)) ? str(start.archetypeKey) : null,
    },
    identity: Object.fromEntries(
      Object.keys(EMPTY_IDENTITY).map((key) => [key, str(identity[key])])
    ) as unknown as FoundingIdentity,
    government: {
      formId: oneOf(GOVERNMENT_FORM_IDS, government.formId) ?? DEFAULT_GOVERNMENT_FORM_ID,
      components: Array.isArray(government.components)
        ? (government.components.filter((c) => typeof c === "string") as ComponentType[])
        : null,
      institutions: Object.fromEntries(
        INSTITUTION_KEYS.flatMap((key) =>
          str(institutions[key]) ? [[key, str(institutions[key])]] : []
        )
      ),
    },
    economy: {
      populationBand: oneOf(POPULATION_BAND_IDS, economy.populationBand),
      wealthBand: oneOf(WEALTH_BAND_IDS, economy.wealthBand),
      exactPopulation: num(economy.exactPopulation),
      exactGdpPerCapita: num(economy.exactGdpPerCapita),
    },
    imported:
      imported && site
        ? {
            site,
            title: str(imported.title),
            governmentRaw: str(imported.governmentRaw) || null,
            formId: oneOf(GOVERNMENT_FORM_IDS, imported.formId),
            population: num(imported.population),
            gdpPerCapita: num(imported.gdpPerCapita),
            suggestedArchetype: getArchetypeOption(str(imported.suggestedArchetype))
              ? str(imported.suggestedArchetype)
              : null,
          }
        : null,
    returnToReview: value.returnToReview === true,
  };
}

/** The draft to resume: the server's, unless the local crash copy is strictly newer. */
export function pickNewerDraft(
  server: FoundingDraft | null,
  local: FoundingDraft | null
): FoundingDraft | null {
  if (!local) return server;
  if (!server) return local;
  return local.updatedAt > server.updatedAt ? local : server;
}

// ---------------------------------------------------------------------------------------------
// Validation

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function validateIdentity(identity: FoundingIdentity): FieldErrors<IdentityFieldId> {
  const errors: FieldErrors<IdentityFieldId> = {};
  const name = identity.name.trim();
  if (!name) errors.name = "Enter a name for your nation.";
  else if (name.length > 100) errors.name = "Use 100 characters or fewer.";
  if (!isRealmImageUrl(identity.flagUrl)) {
    errors.flagUrl =
      "Use an https:// image address, upload an image or pick one from the repository.";
  }
  const iso = identity.isoCode.trim();
  if (iso && !/^[A-Za-z]{2,3}$/.test(iso)) errors.isoCode = "Use two or three letters, like FR.";
  const calling = identity.callingCode.trim();
  if (calling && !/^\+?\d{1,4}$/.test(calling)) {
    errors.callingCode = "Use a plus and up to four digits, like +33.";
  }
  const tld = identity.internetTLD.trim();
  if (tld && !/^\.?[A-Za-z]{2,24}$/.test(tld))
    errors.internetTLD = "Use a dot and letters, like .fr.";
  return errors;
}

export type EconomyFieldId = "exactPopulation" | "exactGdpPerCapita";

export function validateEconomy(economy: FoundingDraft["economy"]): FieldErrors<EconomyFieldId> {
  const errors: FieldErrors<EconomyFieldId> = {};
  const { exactPopulation: people, exactGdpPerCapita: wealth } = economy;
  if (people !== null && (people < POPULATION_RANGE.min || people > POPULATION_RANGE.max)) {
    errors.exactPopulation = "Enter a population between 10,000 and 2 billion.";
  }
  if (wealth !== null && (wealth < GDP_PER_CAPITA_RANGE.min || wealth > GDP_PER_CAPITA_RANGE.max)) {
    errors.exactGdpPerCapita = "Enter a figure between $500 and $250,000 per person.";
  }
  return errors;
}

const hasErrors = (errors: object) => Object.keys(errors).length > 0;

// ---------------------------------------------------------------------------------------------
// Government

/** The components in play: the player's own set, else the form's. */
export function activeComponents(government: FoundingDraft["government"]): ComponentType[] {
  return government.components ?? [...(getGovernmentForm(government.formId)?.components ?? [])];
}

/**
 * Institution names in play: the form's, with the player's renames over them. `forFounding`
 * reads an emptied name as the form's, as the server does.
 */
export function activeInstitutions(
  government: FoundingDraft["government"],
  forFounding = false
): GovernmentInstitutions {
  const form =
    getGovernmentForm(government.formId) ?? getGovernmentForm(DEFAULT_GOVERNMENT_FORM_ID)!;
  const renamed = forFounding
    ? Object.fromEntries(Object.entries(government.institutions).filter(([, v]) => v?.trim()))
    : government.institutions;
  return { ...form.institutions, ...renamed };
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/** Adds or removes a component; back at the form's own set, the draft drops its copy. */
export function toggleComponent(
  government: FoundingDraft["government"],
  type: ComponentType
): FoundingDraft["government"] {
  const current = activeComponents(government);
  const next = current.includes(type)
    ? current.filter((c) => c !== type)
    : current.length >= MAX_GOVERNMENT_COMPONENTS
      ? current
      : [...current, type];
  const formSet = getGovernmentForm(government.formId)?.components ?? [];
  return { ...government, components: sameSet(next, formSet) ? null : next };
}

/**
 * A policy preset replaces the whole component set in one update (spec §4); the form's own set
 * drops the draft's copy, as a toggle back to it does.
 */
export function applyPreset(
  government: FoundingDraft["government"],
  components: readonly ComponentType[]
): FoundingDraft["government"] {
  const next = [...new Set(components)].slice(0, MAX_GOVERNMENT_COMPONENTS);
  const formSet = getGovernmentForm(government.formId)?.components ?? [];
  return { ...government, components: sameSet(next, formSet) ? null : next };
}

/**
 * Sets one institution name; typing the form's own name back clears the rename. An emptied box
 * stays empty while the player types, and founds with the form's name.
 */
export function renameInstitution(
  government: FoundingDraft["government"],
  key: keyof GovernmentInstitutions,
  value: string
): FoundingDraft["government"] {
  const formName = getGovernmentForm(government.formId)?.institutions[key];
  const institutions = { ...government.institutions };
  if (value === formName) delete institutions[key];
  else institutions[key] = value;
  return { ...government, institutions };
}

/** A new form brings its own institutions and component set. */
export function chooseForm(
  government: FoundingDraft["government"],
  formId: GovernmentFormId
): FoundingDraft["government"] {
  return government.formId === formId ? government : { formId, components: null, institutions: {} };
}

export function isGovernmentCustomised(government: FoundingDraft["government"]): boolean {
  return government.components !== null || Object.keys(government.institutions).length > 0;
}

// ---------------------------------------------------------------------------------------------
// Size and wealth

/** The bands shown: the player's, else the archetype's typical ones, else the defaults'. */
export function effectiveBands(draft: FoundingDraft): {
  population: PopulationBandId;
  wealth: WealthBandId;
} {
  const { economy } = draft;
  const typical = getArchetypeOption(draft.start.archetypeKey)?.display;
  return {
    population: economy.exactPopulation
      ? bandForPopulation(economy.exactPopulation)
      : (economy.populationBand ??
        typical?.typicalPopulationBand ??
        bandForPopulation(DEFAULT_POPULATION)),
    wealth: economy.exactGdpPerCapita
      ? bandForGdpPerCapita(economy.exactGdpPerCapita)
      : (economy.wealthBand ??
        typical?.typicalWealthBand ??
        bandForGdpPerCapita(DEFAULT_GDP_PER_CAPITA)),
  };
}

// ---------------------------------------------------------------------------------------------
// Start

/** Applying this start over an earlier one would replace size, wealth and government. */
export function startNeedsConfirm(draft: FoundingDraft, key: string | null): boolean {
  return draft.start.applied && draft.start.archetypeKey !== key;
}

/**
 * Applies an archetype (or a blank start, `null`): its size, wealth and starting government
 * form. Identity is never touched. On the first start after a wiki import, the imported size,
 * wealth and form win over the archetype's.
 */
export function applyStart(draft: FoundingDraft, key: string | null): FoundingDraft {
  const option = getArchetypeOption(key);
  const imported = draft.start.applied ? null : draft.imported;
  const exactPopulation = imported?.population ?? null;
  const exactGdpPerCapita = imported?.gdpPerCapita ?? null;
  return {
    ...draft,
    start: {
      selection: option ? option.key : null,
      applied: true,
      archetypeKey: option?.key ?? null,
    },
    government: {
      formId:
        imported?.formId ?? option?.display.startingGovernmentForm ?? DEFAULT_GOVERNMENT_FORM_ID,
      components: null,
      institutions: {},
    },
    economy: {
      populationBand: exactPopulation
        ? bandForPopulation(exactPopulation)
        : (option?.display.typicalPopulationBand ?? null),
      wealthBand: exactGdpPerCapita
        ? bandForGdpPerCapita(exactGdpPerCapita)
        : (option?.display.typicalWealthBand ?? null),
      exactPopulation,
      exactGdpPerCapita,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Wiki import

export const IMPORT_FIELD_IDS = [
  "name",
  "flagUrl",
  "capitalCity",
  "population",
  "gdpPerCapita",
  "government",
  "officialLanguages",
  "currency",
  "motto",
] as const;
export type ImportFieldId = (typeof IMPORT_FIELD_IDS)[number];

/** What the infobox gave, already cleaned; a field is absent when the page did not have it. */
export interface ImportedNation {
  site: WikiSiteId;
  title: string;
  name?: string;
  flagUrl?: string;
  capitalCity?: string;
  population?: number;
  gdpPerCapita?: number;
  government?: { raw: string; formId: GovernmentFormId };
  officialLanguages?: string;
  currency?: string;
  motto?: string;
}

/** The fields an import found, in display order. */
export function foundImportFields(nation: ImportedNation): ImportFieldId[] {
  return IMPORT_FIELD_IDS.filter((id) => nation[id] !== undefined);
}

/**
 * Writes the kept fields into the draft: identity fields at once; size, wealth and government
 * form when the start is applied. Suggests (and selects) the closest archetype. The start is
 * applied afresh, so the player continues from the Start step.
 */
export function applyImport(
  draft: FoundingDraft,
  nation: ImportedNation,
  keep: ReadonlySet<ImportFieldId>
): FoundingDraft {
  const kept = <K extends ImportFieldId>(id: K) => (keep.has(id) ? nation[id] : undefined);
  const identity = { ...draft.identity };
  const name = kept("name");
  if (name) identity.name = name;
  const flagUrl = kept("flagUrl");
  if (flagUrl) identity.flagUrl = flagUrl;
  const capitalCity = kept("capitalCity");
  if (capitalCity) identity.capitalCity = capitalCity;
  const officialLanguages = kept("officialLanguages");
  if (officialLanguages) identity.officialLanguages = officialLanguages;
  const currency = kept("currency");
  if (currency) identity.currency = currency;
  const motto = kept("motto");
  if (motto) identity.motto = motto;

  const government = kept("government");
  const population = kept("population") ?? null;
  const gdpPerCapita = kept("gdpPerCapita") ?? null;
  const suggestedArchetype = suggestArchetype({
    wealthBand: gdpPerCapita ? bandForGdpPerCapita(gdpPerCapita) : null,
    formId: government?.formId ?? null,
  });
  return {
    ...draft,
    identity,
    imported: {
      site: nation.site,
      title: nation.title,
      governmentRaw: government?.raw ?? null,
      formId: government?.formId ?? null,
      population,
      gdpPerCapita,
      suggestedArchetype,
    },
    start: {
      selection: suggestedArchetype ?? draft.start.selection,
      applied: false,
      archetypeKey: draft.start.archetypeKey,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Gating

export interface StepContext {
  /** Realms the player can found in; null while unknown (the realm step is then not shown). */
  creatableRealmIds: readonly string[] | null;
}

export function isStepComplete(
  draft: FoundingDraft,
  step: FoundingStepId,
  context: StepContext
): boolean {
  switch (step) {
    case "realm":
      return (
        draft.realmId !== null &&
        (context.creatableRealmIds === null || context.creatableRealmIds.includes(draft.realmId))
      );
    case "start":
      return draft.start.applied;
    case "identity":
      return !hasErrors(validateIdentity(draft.identity));
    case "government": {
      const count = activeComponents(draft.government).length;
      return count > 0 && count <= MAX_GOVERNMENT_COMPONENTS;
    }
    case "economy":
      return !hasErrors(validateEconomy(draft.economy));
    case "review":
      return false;
  }
}

/** The first step that still needs something; Review once everything is done. */
export function firstIncompleteStep(
  draft: FoundingDraft,
  steps: readonly FoundingStepId[],
  context: StepContext
): FoundingStepId {
  return steps.find((step) => !isStepComplete(draft, step, context)) ?? "review";
}

/**
 * The step to show for a requested one (a `?step=` link, or the draft's saved step): the request
 * when every step before it is complete, else the first incomplete step.
 */
export function resolveStep(
  draft: FoundingDraft,
  requested: string | null | undefined,
  steps: readonly FoundingStepId[],
  context: StepContext
): FoundingStepId {
  const target: FoundingStepId =
    isFoundingStepId(requested) && steps.includes(requested)
      ? requested
      : steps.includes(draft.step)
        ? draft.step
        : steps[0]!;
  const firstOpen = firstIncompleteStep(draft, steps, context);
  return steps.indexOf(target) <= steps.indexOf(firstOpen) ? target : firstOpen;
}
