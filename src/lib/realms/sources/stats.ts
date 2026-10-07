/**
 * Field precedence for a nation the sync creates: the source's figures first (a community map's maintainer
 * checks them), then the nation's wiki infobox, then the baseline defaults (buildBaselineCountryData fills
 * whatever is still missing). Identity follows the same order: the source's official name and capital, then the
 * infobox's. Flag, coat of arms, leader and government come from the infobox only.
 */
import type { BaselineCountryInitial } from "~/lib/countries/baseline-country";
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
  Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined && v !== null && v !== "")) as T;

export function newNationFields(planned: PlannedNation, infobox: InfoboxFacts | null): NewNationFields {
  const box = infobox?.country ?? {};
  const initial = definedOnly<BaselineCountryInitial>({
    baselinePopulation: planned.population ?? box.baselinePopulation,
    baselineGdpPerCapita: planned.gdpPerCapita ?? box.baselineGdpPerCapita,
    landArea: planned.landArea ?? box.landArea,
    continent: planned.continent ?? box.continent,
    government: box.government,
    flag: box.flag,
    coatOfArms: box.coatOfArms,
    leader: box.leader,
  });
  const identity = definedOnly<Record<string, string>>({
    ...(infobox?.identity as Record<string, string> | undefined),
    officialName: planned.officialName ?? infobox?.identity.officialName,
    capitalCity: planned.capital ?? infobox?.identity.capitalCity,
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
