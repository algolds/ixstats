/**
 * AT-3: a claimed nation page prefills the nation its approval creates (ruling E-f). The page's infobox, read
 * with the builder's wiki import parser (`parseInfoboxWithTemplates`), gives the new Country's baseline
 * (population, GDP per capita, area, continent, government, leader, flag, coat of arms) and its national identity
 * (official name, capital, motto, currency, languages…), so MyCountry and the builder's editor open on the
 * page's facts instead of placeholders. Best effort: an unreachable page or a page without an infobox gives the
 * plain baseline.
 */
import { withBasePath } from "~/lib/base-path";
import type { BaselineCountryInitial } from "~/lib/countries/baseline-country";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import {
  parseInfoboxWithTemplates,
  resolveImageUrl,
  type UnifiedInfoboxData,
} from "~/lib/wiki-os/adapters/ixstates/unified-parser";
import { parseWikiSource } from "~/lib/wiki-os/config";

/** The NationalIdentity fields an infobox can give. */
export interface NationIdentityPrefill {
  officialName?: string;
  governmentType?: string;
  capitalCity?: string;
  largestCity?: string;
  motto?: string;
  currency?: string;
  officialLanguages?: string;
  demonym?: string;
  nationalAnthem?: string;
  nationalReligion?: string;
}

export interface NationPagePrefill {
  country: BaselineCountryInitial;
  identity: NationIdentityPrefill;
}

export const EMPTY_PREFILL: NationPagePrefill = { country: {}, identity: {} };

/** How long an approval waits for the wiki before creating the nation with the plain baseline. */
const PREFILL_TIMEOUT_MS = 8000;

const MAX_TEXT = 200;

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, MAX_TEXT) : undefined;
}

/** A finite number from `min` (above zero) to `max` (an infobox typo must not found a nation of 10^15 people). */
function amount(value: unknown, max: number, min = 0): number | undefined {
  const n = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(n) && n > 0 && n >= min && n <= max ? n : undefined;
}

/**
 * The lowest GDP per capita a prefill believes. Below it the figure is a misread (a year, a rank, a GDP in the
 * wrong unit) and the nation gets the baseline default instead of an economy of a few dollars a head.
 */
const MIN_GDP_PER_CAPITA = 100;

/** Where this app proxies wiki media (`resolveImageUrl`'s paths for a sister wiki's files, and IxWiki's). */
const MEDIA_PROXY_PREFIX = "/api/mediawiki/";

/**
 * An image URL a country may store: an https URL, or a path on this app's own wiki media proxy, which is what
 * `resolveImageUrl` gives and what the builder's wiki import stores as a flag too. Anything else
 * (`javascript:`, `http:`, another relative path) is dropped.
 */
function imageUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^https:\/\//i.test(value)) return value;
  const proxied = value.startsWith(withBasePath(MEDIA_PROXY_PREFIX)) && !value.includes("..");
  return proxied ? value : undefined;
}

/** Drop the keys an infobox did not give, so they fall back to the baseline defaults. */
function defined<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined)) as T;
}

/** Pure: the prefill an infobox gives. Image fields become wiki image URLs on the page's own wiki. */
export function prefillFromInfobox(
  data: UnifiedInfoboxData | null,
  wikiSource: string
): NationPagePrefill {
  if (!data) return EMPTY_PREFILL;
  const source = parseWikiSource(wikiSource);
  const population = amount(
    data.population ?? data.population_estimate ?? data.population_census,
    20_000_000_000
  );
  const gdpPerCapita =
    amount(data.gdpPerCapita, 10_000_000, MIN_GDP_PER_CAPITA) ??
    (population && amount(data.gdp_nominal, 1e15)
      ? amount(data.gdp_nominal! / population, 10_000_000, MIN_GDP_PER_CAPITA)
      : undefined);
  const flag = data.flagUrl ?? resolveImageUrl(data.image_flag ?? data.flag, source);
  const coatOfArms =
    data.coatOfArmsUrl ?? resolveImageUrl(data.image_coat ?? data.coat_of_arms, source);
  return {
    country: defined({
      baselinePopulation: population,
      baselineGdpPerCapita: gdpPerCapita,
      landArea: amount(data.area_km2, 200_000_000),
      continent: text(data.continent),
      government: text(data.government_type),
      flag: imageUrl(flag),
      coatOfArms: imageUrl(coatOfArms),
      leader: text(data.head_of_state ?? data.leader_name1),
    }),
    identity: defined({
      officialName: text(data.official_name ?? data.conventional_long_name),
      governmentType: text(data.government_type),
      capitalCity: text(data.capital),
      largestCity: text(data.largest_city),
      motto: text(data.motto),
      currency: text(data.currency),
      officialLanguages: text(data.official_languages ?? data.languages),
      demonym: text(data.demonym),
      nationalAnthem: text(data.national_anthem),
      nationalReligion: text(data.religion),
    }),
  };
}

/** The prefill a nation page gives, read from its wiki; the plain baseline when the wiki fails or is slow. */
export async function fetchNationPagePrefill(
  wikiSource: string,
  title: string
): Promise<NationPagePrefill> {
  const read = async () => {
    const article = await getArticleWikitextShadow(title, parseWikiSource(wikiSource));
    if (!article?.wikitext) return EMPTY_PREFILL;
    return prefillFromInfobox(parseInfoboxWithTemplates(article.wikitext, title), wikiSource);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<NationPagePrefill>((resolve) => {
    timer = setTimeout(() => resolve(EMPTY_PREFILL), PREFILL_TIMEOUT_MS);
  });
  try {
    return await Promise.race([read(), timeout]);
  } catch (error) {
    console.warn("[realms] nation page prefill failed; using the baseline:", error);
    return EMPTY_PREFILL;
  } finally {
    clearTimeout(timer);
  }
}
