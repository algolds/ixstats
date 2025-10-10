/**
 * Wiki Importer Router
 *
 * Handles importing country data from MediaWiki infobox templates
 * Supports multiple wiki sources: IIWiki, IxWiki, AltHistoryWiki
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { parseInfoboxTemplate, mapInfoboxToIxStats } from "~/lib/wiki-infobox-mapper";

/**
 * Wiki source configuration
 */
const WIKI_SOURCES = {
  iiwiki: {
    name: 'IIWiki',
    apiUrl: 'https://iiwiki.com/mediawiki/api.php',
    priority: 1
  },
  ixwiki: {
    name: 'IxWiki',
    apiUrl: 'https://ixwiki.com/mediawiki/api.php',
    priority: 2
  },
  althist: {
    name: 'Alternative History Wiki',
    apiUrl: 'https://althistory.fandom.com/api.php',
    priority: 3
  }
} as const;

type WikiSource = keyof typeof WIKI_SOURCES;

/**
 * Fetch page from a specific wiki source
 */
async function fetchFromWikiSource(pageName: string, source: WikiSource) {
  const wikiConfig = WIKI_SOURCES[source];

  const response = await fetch(
    `${wikiConfig.apiUrl}?action=query&titles=${encodeURIComponent(pageName)}&prop=revisions&rvprop=content&format=json`,
    {
      headers: {
        'User-Agent': 'IxStats-WikiImporter/1.0',
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${wikiConfig.name}`);
  }

  const data = await response.json();
  const pages = data.query?.pages;

  if (!pages) {
    return null;
  }

  const page = Object.values(pages)[0] as any;

  // Check if page exists (missing pages have negative IDs)
  if (page.missing !== undefined || parseInt(page.pageid) < 0) {
    return null;
  }

  const wikitext = page.revisions?.[0]?.['*'];

  if (!wikitext) {
    return null;
  }

  return {
    source: source,
    sourceName: wikiConfig.name,
    pageName: pageName,
    pageId: page.pageid,
    wikitext,
    hasInfobox: wikitext.includes('{{Infobox country') || wikitext.includes('{{Infobox Country'),
    url: source === 'iiwiki'
      ? `https://iiwiki.com/wiki/${encodeURIComponent(pageName.replace(/ /g, '_'))}`
      : source === 'ixwiki'
      ? `https://ixwiki.com/wiki/${encodeURIComponent(pageName.replace(/ /g, '_'))}`
      : `https://althistory.fandom.com/wiki/${encodeURIComponent(pageName.replace(/ /g, '_'))}`
  };
}

/**
 * Search for page across all wiki sources
 */
async function searchAcrossWikis(pageName: string, preferredSource?: WikiSource) {
  const sources: WikiSource[] = preferredSource
    ? [preferredSource, ...Object.keys(WIKI_SOURCES).filter(s => s !== preferredSource) as WikiSource[]]
    : (Object.keys(WIKI_SOURCES) as WikiSource[]).sort((a, b) =>
        WIKI_SOURCES[a].priority - WIKI_SOURCES[b].priority
      );

  const results: Array<{ source: WikiSource; success: boolean; data?: any; error?: string }> = [];

  for (const source of sources) {
    try {
      const data = await fetchFromWikiSource(pageName, source);
      if (data) {
        results.push({ source, success: true, data });
        return data; // Return first successful result
      } else {
        results.push({ source, success: false, error: 'Page not found' });
      }
    } catch (error) {
      results.push({
        source,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // No successful results
  throw new Error(`Page "${pageName}" not found in any wiki source. Tried: ${sources.map(s => WIKI_SOURCES[s].name).join(', ')}`);
}

export const wikiImporterRouter = createTRPCRouter({
  /**
   * Parse wiki infobox text and preview mapped data
   */
  previewImport: publicProcedure
    .input(z.object({
      wikitext: z.string()
    }))
    .query(({ input }) => {
      const parsedData = parseInfoboxTemplate(input.wikitext);
      const mappedData = mapInfoboxToIxStats(parsedData);

      return {
        parsed: parsedData,
        mapped: mappedData,
        fieldCount: Object.keys(parsedData).length,
        mappedFieldCount: Object.keys(mappedData).filter(k => mappedData[k as keyof typeof mappedData]).length
      };
    }),

  /**
   * Import country data from wiki infobox
   */
  importCountry: protectedProcedure
    .input(z.object({
      wikitext: z.string(),
      countryId: z.string().optional(), // If updating existing country
      createNew: z.boolean().default(true)
    }))
    .mutation(async ({ ctx, input }) => {
      const parsedData = parseInfoboxTemplate(input.wikitext);
      const mappedData = mapInfoboxToIxStats(parsedData);

      if (!mappedData.name) {
        throw new Error("Could not extract country name from infobox");
      }

      // Check if updating or creating
      if (input.countryId) {
        // Update existing country
        const country = await ctx.db.country.update({
          where: { id: input.countryId },
          data: {
            name: mappedData.name,
            slug: mappedData.slug,
            continent: mappedData.continent,
            region: mappedData.region,
            landArea: mappedData.landArea,
            areaSqMi: mappedData.areaSqMi,
            currentPopulation: mappedData.currentPopulation,
            baselinePopulation: mappedData.baselinePopulation,
            populationDensity: mappedData.populationDensity,
            religion: mappedData.religion,
            leader: mappedData.leader,
            flag: mappedData.flag,
            coatOfArms: mappedData.coatOfArms,
          }
        });

        // Update or create national identity
        if (mappedData.nationalIdentity) {
          await ctx.db.nationalIdentity.upsert({
            where: { countryId: input.countryId },
            create: {
              countryId: input.countryId,
              ...mappedData.nationalIdentity
            },
            update: {
              ...mappedData.nationalIdentity,
              updatedAt: new Date()
            }
          });
        }

        return {
          success: true,
          countryId: country.id,
          countryName: country.name,
          action: 'updated'
        };

      } else if (input.createNew) {
        // Create new country
        const country = await ctx.db.country.create({
          data: {
            name: mappedData.name,
            slug: mappedData.slug || mappedData.name.toLowerCase().replace(/\s+/g, '-'),
            continent: mappedData.continent || 'Unknown',
            region: mappedData.region,
            landArea: mappedData.landArea,
            areaSqMi: mappedData.areaSqMi,
            currentPopulation: mappedData.currentPopulation || 1000000,
            baselinePopulation: mappedData.baselinePopulation || mappedData.currentPopulation || 1000000,
            populationDensity: mappedData.populationDensity,
            religion: mappedData.religion,
            leader: mappedData.leader,

            // Required defaults
            economicTier: 'Developing',
            populationTier: '1',
            baselineGdpPerCapita: 25000,
            baselineDate: new Date(),
            currentGdpPerCapita: 25000,
            currentTotalGdp: (mappedData.currentPopulation || 1000000) * 25000,
            lastCalculated: new Date(),
            maxGdpGrowthRate: 0.05,
            adjustedGdpGrowth: 0.03,
            populationGrowthRate: 0.01,
            actualGdpGrowth: 0.03,
            realGDPGrowthRate: 0.03,
            inflationRate: 0.02,
            localGrowthFactor: 1.0,
          }
        });

        // Create national identity
        if (mappedData.nationalIdentity) {
          await ctx.db.nationalIdentity.create({
            data: {
              countryId: country.id,
              ...mappedData.nationalIdentity
            }
          });
        }

        return {
          success: true,
          countryId: country.id,
          countryName: country.name,
          action: 'created'
        };
      }

      throw new Error("Must specify countryId for update or createNew=true");
    }),

  /**
   * Fetch wiki page from multiple wiki sources (auto-detect)
   */
  fetchFromWiki: publicProcedure
    .input(z.object({
      pageName: z.string(),
      preferredSource: z.enum(['iiwiki', 'ixwiki', 'althist']).optional()
    }))
    .query(async ({ input }) => {
      try {
        const result = await searchAcrossWikis(input.pageName, input.preferredSource);
        return result;
      } catch (error) {
        throw new Error(`Failed to fetch wiki page: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  /**
   * Search for a country across all wiki sources
   */
  searchAllWikis: publicProcedure
    .input(z.object({
      searchTerm: z.string().min(2)
    }))
    .query(async ({ input }) => {
      const sources: WikiSource[] = ['iiwiki', 'ixwiki', 'althist'];
      const results = [];

      for (const source of sources) {
        try {
          const wikiConfig = WIKI_SOURCES[source];
          const response = await fetch(
            `${wikiConfig.apiUrl}?action=opensearch&search=${encodeURIComponent(input.searchTerm)}&limit=5&format=json`,
            {
              headers: {
                'User-Agent': 'IxStats-WikiImporter/1.0'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            const [, titles, , urls] = data;

            if (titles && titles.length > 0) {
              results.push({
                source,
                sourceName: wikiConfig.name,
                results: titles.map((title: string, idx: number) => ({
                  title,
                  url: urls[idx]
                }))
              });
            }
          }
        } catch (error) {
          console.error(`Failed to search ${source}:`, error);
        }
      }

      return results;
    }),

  /**
   * Get available wiki sources
   */
  getWikiSources: publicProcedure
    .query(() => {
      return Object.entries(WIKI_SOURCES).map(([key, config]) => ({
        id: key,
        name: config.name,
        apiUrl: config.apiUrl,
        priority: config.priority
      }));
    }),
});
