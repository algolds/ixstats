/**
 * Reads a parsed wiki infobox (`countries.parseInfobox`) into the fields the founding flow can
 * use: name, flag, capital, population, GDP per capita, government form, language, currency and
 * motto. Values are cleaned of wiki markup; a field the page does not have is left out.
 */

import {
  cleanWikiValue,
  parseMoney,
  parsePopulation,
} from "~/lib/wiki-os/transformers/infobox-parser";
import { matchGovernmentForm } from "~/lib/government/forms";
import { isRealmImageUrl } from "~/lib/realms/realm-region";
import {
  GDP_PER_CAPITA_RANGE,
  POPULATION_RANGE,
  type ImportFieldId,
  type ImportedNation,
  type WikiSiteId,
} from "./founding-draft";

type Infobox = Record<string, unknown>;

function text(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const clean = cleanWikiValue(value).trim();
    if (clean) return clean;
  }
  return undefined;
}

function count(parse: (raw: string) => number | null, ...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed =
      typeof value === "number" ? value : typeof value === "string" ? parse(value) : null;
    if (parsed !== null && Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

const clamp = (value: number, range: { min: number; max: number }) =>
  Math.round(Math.min(range.max, Math.max(range.min, value)));

export function readInfobox(infobox: Infobox, site: WikiSiteId, title: string): ImportedNation {
  const nation: ImportedNation = { site, title };
  const name = text(infobox.common_name, infobox.name, infobox.conventional_long_name) ?? title;
  if (name) nation.name = name;

  const flag = typeof infobox.flagUrl === "string" ? infobox.flagUrl.trim() : "";
  if (flag && isRealmImageUrl(flag)) nation.flagUrl = flag;

  const capital = text(infobox.capital);
  if (capital) nation.capitalCity = capital;

  const population = count(
    parsePopulation,
    infobox.population,
    infobox.population_estimate,
    infobox.population_census
  );
  if (population) nation.population = clamp(population, POPULATION_RANGE);

  const gdpPerCapita = count(
    parseMoney,
    infobox.gdpPerCapita,
    infobox.GDP_nominal_per_capita,
    infobox.GDP_PPP_per_capita
  );
  if (gdpPerCapita) nation.gdpPerCapita = clamp(gdpPerCapita, GDP_PER_CAPITA_RANGE);

  const government = text(infobox.government_type);
  if (government) nation.government = { raw: government, formId: matchGovernmentForm(government) };

  const languages = text(infobox.official_languages, infobox.languages);
  if (languages) nation.officialLanguages = languages;
  const currency = text(infobox.currency);
  if (currency) nation.currency = currency;
  const motto = text(infobox.motto);
  if (motto) nation.motto = motto;
  return nation;
}

export const IMPORT_FIELD_LABELS: Record<ImportFieldId, string> = {
  name: "Name",
  flagUrl: "Flag",
  capitalCity: "Capital city",
  population: "Population",
  gdpPerCapita: "GDP per person",
  government: "Government",
  officialLanguages: "Official language",
  currency: "Currency",
  motto: "Motto",
};
