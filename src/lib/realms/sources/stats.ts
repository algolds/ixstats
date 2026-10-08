/**
 * Field precedence for a nation the sync creates: the source's figures first (a community map's maintainer
 * checks them), then the nation's wiki infobox, then the baseline defaults (buildBaselineCountryData fills
 * whatever is still missing). A figure the source took from a secondary source ranks below the infobox instead.
 * Identity follows the same order: the source's official name and capital, then the infobox's. Flag, coat of
 * arms, leader and government come from the infobox only.
 */
import type { BaselineCountryInitial } from "~/lib/countries/baseline-country";
import type { SourceFigureField } from "./adapters/types";
import type { PlannedNation } from "./plan";

/** What a wiki infobox gave (structurally the realms prefill, NationPagePrefill). */
export interface InfoboxFacts {
  country: BaselineCountryInitial;
  identity: Partial<Record<string, string>>;
}

export interface NewNationFields {
  initial: BaselineCountryInitial;
  identity: Record<string, string>;
}

const definedOnly = <T extends object>(record: T): T =>
  Object.fromEntries(
    Object.entries(record).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as T;

export function newNationFields(
  planned: PlannedNation,
  infobox: InfoboxFacts | null
): NewNationFields {
  const box = infobox?.country ?? {};
  const secondary = new Set<SourceFigureField>(planned.secondary ?? []);
  /** The source's value first, unless it is a secondary-source figure: then the infobox's first. */
  const first = <T>(field: SourceFigureField, source: T | null, wiki: T | undefined) =>
    secondary.has(field) ? (wiki ?? source ?? undefined) : (source ?? wiki);
  const initial = definedOnly<BaselineCountryInitial>({
    baselinePopulation: first("population", planned.population, box.baselinePopulation),
    baselineGdpPerCapita: first("gdpPerCapita", planned.gdpPerCapita, box.baselineGdpPerCapita),
    landArea: first("landArea", planned.landArea, box.landArea),
    continent: planned.continent ?? box.continent,
    government: box.government,
    flag: box.flag,
    coatOfArms: box.coatOfArms,
    leader: box.leader,
  });
  const identity = definedOnly<Record<string, string>>({
    ...(infobox?.identity as Record<string, string> | undefined),
    officialName: first("officialName", planned.officialName, infobox?.identity.officialName),
    capitalCity: first("capital", planned.capital, infobox?.identity.capitalCity),
  } as Record<string, string>);
  return { initial, identity };
}

/** True when an infobox read gave nothing at all (the wiki was unreachable, slow, or the page has no infobox). */
export function isEmptyInfobox(infobox: InfoboxFacts | null): boolean {
  return (
    !infobox ||
    (Object.keys(infobox.country).length === 0 && Object.keys(infobox.identity).length === 0)
  );
}
