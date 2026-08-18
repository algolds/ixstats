/**
 * mediawiki-service.ts — Compatibility facade for MediaWiki country infobox and wikitext retrieval.
 *
 * ponytail: Streamlined lightweight adapter delegating directly to unified-wiki-parser.ts,
 * wiki-bridge.ts, and wiki-image-url.ts. Replaces the legacy 2,500+ line monolith.
 */

import { type WikiSource } from "./config";
import { getArticleWikitext } from "./bridge";
import { parseInfoboxWithTemplates, type UnifiedInfoboxData } from "./unified-parser";
import { resolveImageUrl } from "./image-url";

export interface CountryInfobox {
  name: string;
  rawWikitext?: string;
  parsedTemplateData?: Record<string, string>;
  renderedHtml?: string;

  // Core identification
  conventional_long_name?: string;
  native_name?: string;
  common_name?: string;
  official_name?: string;

  // Visual elements
  image_flag?: string;
  flag?: string;
  image_coat?: string;
  coat_of_arms?: string;
  locator_map?: string;
  image_map?: string;
  flag_caption?: string;
  alt_map?: string;
  image_map2?: string;
  alt_map2?: string;
  map_caption?: string;
  map_caption2?: string;

  // Geographic data
  capital?: string;
  isoCode?: string | null;
  capital_city?: string;
  largest_city?: string;
  area_km2?: string;
  area?: string;
  area_total?: string;
  area_rank?: string;
  continent?: string;

  // Government data
  government_type?: string;
  government?: string;
  leader_title1?: string;
  leader_name1?: string;
  leader_title2?: string;
  leader_name2?: string;
  leader_title3?: string;
  leader_name3?: string;
  leader_title4?: string;
  leader_name4?: string;
  head_of_state?: string;
  deputy_leader?: string;
  leader?: string;
  legislature?: string;
  upper_house?: string;
  lower_house?: string;
  sovereignty_type?: string;

  // Economic data
  GDP_PPP?: string;
  GDP_PPP_per_capita?: string;
  GDP_nominal?: string;
  GDP_nominal_per_capita?: string;
  gdp?: string;
  gdp_ppp?: string;
  gdp_nominal?: string;
  currency?: string;
  currency_code?: string;

  // Population data
  population_estimate?: string;
  population_census?: string;
  population?: string;
  population_density_km2?: string;
  population_density?: string;

  // Cultural data
  official_languages?: string;
  official_language?: string;
  national_language?: string;
  regional_languages?: string;
  recognized_languages?: string;
  languages?: string;
  ethnic_groups?: string;
  religion?: string;
  state_religion?: string;
  demonym?: string;
  national_anthem?: string;
  royal_anthem?: string;
  patron_saint?: string;

  // Historical data
  established_event1?: string;
  established_date1?: string;
  established_event2?: string;
  established_date2?: string;
  established_event3?: string;
  established_date3?: string;
  established_event4?: string;
  established_date4?: string;
  established_event5?: string;
  established_date5?: string;
  established_event6?: string;
  established_date6?: string;
  established_event7?: string;
  established_date7?: string;
  established_event8?: string;
  established_date8?: string;
  established?: string;
  independence_date?: string;
  independence?: string;

  // Technical data
  time_zone?: string;
  timezone?: string;
  drives_on?: string;
  drivingSide?: string;
  driving_side?: string;
  cctld?: string;
  internetTld?: string;
  calling_code?: string;
  callingCode?: string;
  electricity?: string;

  // Miscellaneous
  motto?: string;
  national_motto?: string;
  englishmotto?: string;
}

export type CountryInfoboxWithDynamicProps = CountryInfobox &
  Record<string, string | undefined | Record<string, string>>;

function unifiedToCountryInfobox(
  data: UnifiedInfoboxData,
  rawWikitext: string
): CountryInfoboxWithDynamicProps {
  const info: any = {
    ...data.rawInfobox,
    ...data,
    name: data.name,
    rawWikitext,
    parsedTemplateData: data.rawInfobox,
  };

  // Ensure string representations for common string fields
  if (data.population != null) info.population = String(data.population);
  if (data.population_estimate != null) info.population_estimate = String(data.population_estimate);
  if (data.population_census != null) info.population_census = String(data.population_census);
  if (data.area_km2 != null) info.area_km2 = String(data.area_km2);

  return info as CountryInfoboxWithDynamicProps;
}

export class IxnayWikiService {
  constructor(public wikiSource: WikiSource = "ixwiki") {}

  /**
   * Get country infobox data for a country name
   */
  async getCountryInfobox(
    countryName: string,
    _options?: { skipCache?: boolean }
  ): Promise<CountryInfoboxWithDynamicProps | null> {
    try {
      const article = await getArticleWikitext(countryName, this.wikiSource);
      if (!article?.wikitext) return null;

      const parsed = parseInfoboxWithTemplates(article.wikitext, countryName);
      if (!parsed) return null;

      return unifiedToCountryInfobox(parsed, article.wikitext);
    } catch (err) {
      console.error(`[IxnayWikiService] Error getting infobox for ${countryName}:`, err);
      return null;
    }
  }

  /**
   * Get raw wikitext for a page
   */
  async getPageWikitext(
    pageName: string,
    _options?: { skipCache?: boolean }
  ): Promise<string | null> {
    try {
      const article = await getArticleWikitext(pageName, this.wikiSource);
      return article?.wikitext ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get URL for a media file
   */
  async getFileUrl(fileName: string, _options?: { skipCache?: boolean }): Promise<string | null> {
    return resolveImageUrl(fileName, this.wikiSource) ?? null;
  }

  /**
   * Get canonical wiki URL for a country
   */
  getCountryWikiUrl(countryName: string): string {
    const enc = encodeURIComponent(countryName.replace(/ /g, "_"));
    if (this.wikiSource === "iiwiki") {
      return `https://iiwiki.com/wiki/${enc}`;
    }
    if (this.wikiSource === "althistory") {
      return `https://althistory.fandom.com/wiki/${enc}`;
    }
    const basePath = process.env.BASE_PATH || "";
    return `${basePath}/wiki/${enc}`;
  }

  /**
   * Get flag URL for a country
   */
  async getFlagUrl(
    countryName: string,
    _options?: { skipCache?: boolean }
  ): Promise<string | null> {
    const infobox = await this.getCountryInfobox(countryName);
    const flagName = infobox?.image_flag || infobox?.flag;
    if (flagName) {
      return resolveImageUrl(flagName, this.wikiSource) ?? null;
    }
    return null;
  }

  /**
   * Cache management helpers (no-op since caching is centralized in wiki-bridge / Redis)
   */
  clearCountryCache(_countryName: string): void {}
  clearAllCaches(): void {}
}

export const ixnayWiki = new IxnayWikiService("ixwiki");

export function clearAllMediaWikiCaches(): void {
  // Centralized caches are managed in Redis and wiki-bridge
}
