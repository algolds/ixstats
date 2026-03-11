/**
 * Seed script: Import dependencies from "List of Dependencies in Ixnay.xlsx"
 *
 * Creates Country records (wiki-sourced data where available) and
 * CountrySovereignty relationships for all dependency territories.
 *
 * Usage: npx tsx scripts/seed-dependencies.ts
 *        npx tsx scripts/seed-dependencies.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";
import * as path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Constants ───────────────────────────────────────────────────────────────

const WIKI_API_URL = "https://ixwiki.com/api.php";
const USER_AGENT = "IxStats-Builder";
const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 3000;

/** Name corrections for spreadsheet typos / abbreviations */
const NAME_CORRECTIONS: Record<string, string> = {
  Caphira: "Caphiria",
  "Int'l. Nature Preserve": "International Nature Preserve",
  "Int'l Canal Zone": "International Canal Zone",
  LoN: "League of Nations",
};

/** Spreadsheet type → snake_case relationship type */
const TYPE_MAP: Record<string, string> = {
  "Colonial Possession": "colonial_possession",
  "Overseas Collectivity": "overseas_collectivity",
  "Overseas Posession": "overseas_possession",
  State: "state",
  Commonwealth: "commonwealth",
  "Civil Rectory": "civil_rectory",
  "Special Federal District": "special_federal_district",
  "Autonomous District": "autonomous_district",
  Theme: "theme",
  "Overseas Province": "overseas_province",
  "Crowned Protectorate": "crowned_protectorate",
  "Real Union": "real_union",
  "Associated State": "associated_state",
  "Military Directorate": "military_directorate",
  Province: "province",
  "Benefactor Confederacy": "benefactor_confederacy",
  Protectorate: "protectorate",
  "Military Rectory": "military_rectory",
  "LoN Mandate": "lon_mandate",
  "LoN Territory": "lon_territory",
  "Overseas Territory": "overseas_territory",
  "Overseas Country": "overseas_country",
  "Incorporated Territory": "incorporated_territory",
  Metaregion: "metaregion",
  "Overseas State": "overseas_state",
  "Dependent Protectorate": "dependent_protectorate",
  "LoN City": "lon_city",
  "Overseas Region": "overseas_region",
  "Constituent Country": "constituent_country",
  "Twin Associated States": "twin_associated_states",
};

/** Default autonomy levels per relationship type */
const AUTONOMY_DEFAULTS: Record<string, number> = {
  real_union: 0.9,
  constituent_country: 0.9,
  twin_associated_states: 0.85,
  associated_state: 0.8,
  benefactor_confederacy: 0.8,
  overseas_country: 0.8,
  state: 0.75,
  commonwealth: 0.7,
  province: 0.7,
  overseas_state: 0.7,
  overseas_collectivity: 0.65,
  autonomous_district: 0.65,
  overseas_province: 0.6,
  overseas_region: 0.6,
  metaregion: 0.6,
  lon_city: 0.6,
  theme: 0.55,
  special_federal_district: 0.5,
  civil_rectory: 0.5,
  overseas_territory: 0.5,
  crowned_protectorate: 0.45,
  protectorate: 0.45,
  dependent_protectorate: 0.4,
  lon_mandate: 0.4,
  lon_territory: 0.35,
  incorporated_territory: 0.35,
  colonial_possession: 0.3,
  overseas_possession: 0.3,
  military_rectory: 0.25,
  military_directorate: 0.2,
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface SpreadsheetRow {
  dependency: string;
  sovereign: string;
  type: string;
  continent: string;
}

interface WikiData {
  population?: number;
  areaKm2?: number;
  areaSqMi?: number;
  governmentType?: string;
  religion?: string;
  leader?: string;
  capital?: string;
  flag?: string;
}

// ─── Wiki Scraping ───────────────────────────────────────────────────────────

async function fetchWikiInfobox(pageName: string): Promise<WikiData | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      titles: pageName,
      rvsection: "0",
      format: "json",
      formatversion: "2",
    });

    const response = await fetch(`${WIKI_API_URL}?${params}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const pages = data?.query?.pages;
    if (!pages?.length || pages[0].missing) return null;

    const wikitext: string = pages[0]?.revisions?.[0]?.content;
    if (!wikitext) return null;

    return parseInfobox(wikitext);
  } catch (err) {
    console.warn(`  [wiki] Failed to fetch ${pageName}: ${(err as Error).message}`);
    return null;
  }
}

function parseInfobox(wikitext: string): WikiData | null {
  // Find any infobox template (country, political division, settlement, etc.)
  const infoboxStart = wikitext.search(/\{\{\s*Infobox\s+(?:country|political\s+division|settlement|territory|region)/i);
  if (infoboxStart === -1) return null;

  // Extract infobox content using brace counting
  let depth = 0;
  let end = infoboxStart;
  for (let i = infoboxStart; i < wikitext.length - 1; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      depth++;
      i++;
    } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  const infoboxText = wikitext.slice(infoboxStart, end);

  // Parse parameters line by line
  const params: Record<string, string> = {};
  const lines = infoboxText.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*\|\s*([^=]+?)\s*=\s*(.*)/);
    if (match) {
      const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
      const value = cleanWikiValue(match[2].trim());
      if (value) params[key] = value;
    }
  }

  const result: WikiData = {};

  // Population (many possible field names across infobox types)
  const popStr =
    params.population_estimate || params.population_census || params.population ||
    params.population_total || params.pop || params.population_blank1;
  if (popStr) {
    const popNum = parseNumber(popStr);
    if (popNum && popNum > 0) result.population = popNum;
  }

  // Area
  const areaStr = params.area_km2 || params.area || params.area_total || params.area_total_km2;
  if (areaStr) {
    const areaNum = parseNumber(areaStr);
    if (areaNum && areaNum > 0) result.areaKm2 = areaNum;
  }

  const areaSqMiStr = params.area_sq_mi;
  if (areaSqMiStr) {
    const areaNum = parseNumber(areaSqMiStr);
    if (areaNum && areaNum > 0) result.areaSqMi = areaNum;
  }

  // Government type
  if (params.government_type || params.government) {
    result.governmentType = params.government_type || params.government;
  }

  // Religion
  if (params.religion || params.state_religion) {
    result.religion = params.religion || params.state_religion;
  }

  // Leader
  if (params.leader_name1 || params.head_of_state || params.leader) {
    result.leader = params.leader_name1 || params.head_of_state || params.leader;
  }

  // Capital
  if (params.capital || params.capital_city) {
    result.capital = params.capital || params.capital_city;
  }

  // Flag
  if (params.image_flag || params.flag) {
    result.flag = (params.image_flag || params.flag)
      .replace(/^File:/i, "")
      .replace(/^\[\[File:/i, "")
      .replace(/\]\]$/, "")
      .trim();
  }

  return Object.keys(result).length > 0 ? result : null;
}

function cleanWikiValue(value: string): string {
  return value
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2") // [[Page|Display]] → Display
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .replace(/\{\{[^}]*\}\}/g, "") // Remove templates
    .replace(/'''|''/g, "") // Remove bold/italic
    .replace(/<!--.*?-->/g, "") // Remove comments
    .trim();
}

function parseNumber(str: string): number | null {
  // Remove commas, currency symbols, and non-numeric suffixes
  const cleaned = str.replace(/[$,]/g, "").replace(/[^\d.]/g, " ").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function fetchFlagUrl(countryName: string): Promise<string | null> {
  // Try Template:Country_data_<name> first
  try {
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      titles: `Template:Country data ${countryName}`,
      format: "json",
      formatversion: "2",
      redirects: "1",
    });

    const response = await fetch(`${WIKI_API_URL}?${params}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = await response.json();
      const pages = data?.query?.pages;
      if (pages?.length && !pages[0].missing) {
        const content: string = pages[0]?.revisions?.[0]?.content || "";
        const flagMatch = content.match(/flag\s*alias\s*=\s*(.+)/i);
        if (flagMatch) {
          return flagMatch[1].trim();
        }
      }
    }
  } catch {
    // Fall through to pattern matching
  }

  // Try common flag filename patterns
  const patterns = [
    `Flag3 ${countryName}.png`,
    `Flag_of_${countryName}.svg`,
    `Flag_of_${countryName}.png`,
    `Flag ${countryName}.svg`,
    `Flag ${countryName}.png`,
  ];

  for (const pattern of patterns) {
    try {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        titles: `File:${pattern}`,
        prop: "imageinfo",
        iiprop: "url",
        iilimit: "1",
      });

      const response = await fetch(`${WIKI_API_URL}?${params}`, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        const pages = data?.query?.pages;
        if (pages) {
          const page = Object.values(pages)[0] as any;
          if (page?.imageinfo?.[0]?.url) {
            return pattern;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function calculateEconomicTier(gdpPerCapita: number): string {
  if (gdpPerCapita >= 65000) return "Extravagant";
  if (gdpPerCapita >= 55000) return "Very Strong";
  if (gdpPerCapita >= 45000) return "Strong";
  if (gdpPerCapita >= 35000) return "Healthy";
  if (gdpPerCapita >= 25000) return "Developed";
  if (gdpPerCapita >= 10000) return "Developing";
  return "Impoverished";
}

function calculatePopulationTier(population: number): string {
  if (population >= 500_000_000) return "X";
  if (population >= 350_000_000) return "7";
  if (population >= 120_000_000) return "6";
  if (population >= 80_000_000) return "5";
  if (population >= 50_000_000) return "4";
  if (population >= 30_000_000) return "3";
  if (population >= 10_000_000) return "2";
  return "1";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Dependency Seeder ===");
  if (DRY_RUN) console.log("[DRY RUN] No database writes will be performed.\n");

  // Step 1: Parse spreadsheet
  const xlsxPath = path.resolve(__dirname, "../public/List of Dependencies in Ixnay.xlsx");
  const workbook = XLSX.readFile(xlsxPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const rows: SpreadsheetRow[] = rawRows
    .filter((r) => r["Dependency"] && r["Dependency Of"] && r["Dependency Type"])
    .map((r) => ({
      dependency: r["Dependency"].trim(),
      sovereign: r["Dependency Of"].trim(),
      type: r["Dependency Type"].trim(),
      continent: (r["Continent"] || "Unknown").trim(),
    }));

  console.log(`Parsed ${rows.length} dependency rows from spreadsheet.\n`);

  // Step 2: Apply name corrections
  for (const row of rows) {
    if (NAME_CORRECTIONS[row.sovereign]) {
      row.sovereign = NAME_CORRECTIONS[row.sovereign];
    }
    if (NAME_CORRECTIONS[row.dependency]) {
      row.dependency = NAME_CORRECTIONS[row.dependency];
    }
  }

  // Step 3: Load existing countries
  const existingCountries = await prisma.country.findMany({
    select: { id: true, name: true, currentPopulation: true, currentGdpPerCapita: true,
              maxGdpGrowthRate: true, adjustedGdpGrowth: true, populationGrowthRate: true,
              actualGdpGrowth: true },
  });
  const countryMap = new Map(existingCountries.map((c) => [c.name, c]));
  console.log(`Found ${existingCountries.length} existing countries in DB.\n`);

  // Step 4: Identify which countries need creation
  const allSovereignNames = [...new Set(rows.map((r) => r.sovereign))];
  const allDependencyNames = [...new Set(rows.map((r) => r.dependency))];
  const allNeededNames = [...new Set([...allSovereignNames, ...allDependencyNames])];
  const needsCreation = allNeededNames.filter((n) => !countryMap.has(n));

  console.log(`Countries needing creation: ${needsCreation.length}`);
  needsCreation.forEach((n) => console.log(`  - ${n}`));
  console.log();

  // Step 5: Wiki-scrape and create missing countries
  let countriesCreated = 0;
  let wikiHits = 0;
  let wikiFallbacks = 0;

  // Process in batches
  for (let i = 0; i < needsCreation.length; i += BATCH_SIZE) {
    const batch = needsCreation.slice(i, i + BATCH_SIZE);
    if (i > 0) {
      console.log(`  [batch delay ${BATCH_DELAY_MS}ms...]`);
      await sleep(BATCH_DELAY_MS);
    }

    await Promise.all(
      batch.map(async (name) => {
        console.log(`\nProcessing: ${name}`);

        // Find the row to get continent info
        const row = rows.find((r) => r.dependency === name || r.sovereign === name);
        const continent = row?.continent || "Unknown";

        // Find sovereign data for fallback calculations
        const sovereignRow = rows.find((r) => r.dependency === name);
        const sovereignName = sovereignRow?.sovereign;
        const sovereignData = sovereignName ? countryMap.get(sovereignName) : null;

        // Try wiki first
        let wikiData: WikiData | null = null;
        let flagFileName: string | null = null;

        console.log(`  [wiki] Fetching infobox for "${name}"...`);
        wikiData = await fetchWikiInfobox(name);

        if (wikiData) {
          wikiHits++;
          console.log(
            `  [wiki] HIT: pop=${wikiData.population || "?"}, area=${wikiData.areaKm2 || "?"}, ` +
              `gov=${wikiData.governmentType || "?"}, flag=${wikiData.flag || "?"}`
          );
        } else {
          wikiFallbacks++;
          console.log(`  [wiki] MISS: No infobox found, using fallback data`);
        }

        // Try to get flag if not from infobox
        if (!wikiData?.flag) {
          flagFileName = await fetchFlagUrl(name);
          if (flagFileName) {
            console.log(`  [flag] Found: ${flagFileName}`);
          }
        }

        // Calculate economic data
        let population: number;
        let gdpPerCapita: number;
        let maxGdpGrowthRate: number;
        let adjustedGdpGrowth: number;
        let populationGrowthRate: number;
        let actualGdpGrowth: number;
        let landArea: number | undefined;
        let areaSqMi: number | undefined;

        if (wikiData?.population) {
          population = wikiData.population;
        } else if (sovereignData) {
          // 1-3% of sovereign's population
          const fraction = 0.01 + Math.random() * 0.02;
          population = Math.round(sovereignData.currentPopulation * fraction);
        } else {
          population = 50000;
        }

        if (sovereignData) {
          // 60-80% of sovereign's GDP per capita
          gdpPerCapita = sovereignData.currentGdpPerCapita * (0.6 + Math.random() * 0.2);
          maxGdpGrowthRate = sovereignData.maxGdpGrowthRate;
          adjustedGdpGrowth = sovereignData.adjustedGdpGrowth;
          populationGrowthRate = sovereignData.populationGrowthRate;
          actualGdpGrowth = sovereignData.actualGdpGrowth;
        } else {
          // LoN or sovereign without DB data
          gdpPerCapita = 25000;
          maxGdpGrowthRate = 0.035;
          adjustedGdpGrowth = 0.001;
          populationGrowthRate = 0.005;
          actualGdpGrowth = 0.006;
        }

        if (wikiData?.areaKm2) landArea = wikiData.areaKm2;
        if (wikiData?.areaSqMi) areaSqMi = wikiData.areaSqMi;
        else if (landArea) areaSqMi = landArea * 0.386102;

        const totalGdp = population * gdpPerCapita;
        const slug = generateSlug(name);
        const flag = wikiData?.flag || flagFileName || null;

        const countryData = {
          name,
          slug,
          continent,
          flag,
          governmentType: wikiData?.governmentType || null,
          religion: wikiData?.religion || null,
          leader: wikiData?.leader || null,
          landArea: landArea || null,
          areaSqMi: areaSqMi || null,
          baselinePopulation: population,
          baselineGdpPerCapita: gdpPerCapita,
          currentPopulation: population,
          currentGdpPerCapita: gdpPerCapita,
          currentTotalGdp: totalGdp,
          maxGdpGrowthRate,
          adjustedGdpGrowth,
          populationGrowthRate,
          actualGdpGrowth,
          economicTier: calculateEconomicTier(gdpPerCapita),
          populationTier: calculatePopulationTier(population),
        };

        if (DRY_RUN) {
          console.log(`  [dry-run] Would create country: ${name} (slug: ${slug}, pop: ${population}, gdp/c: ${Math.round(gdpPerCapita)})`);
          // Add to map for sovereignty link resolution
          countryMap.set(name, {
            id: `dry-run-${slug}`,
            name,
            currentPopulation: population,
            currentGdpPerCapita: gdpPerCapita,
            maxGdpGrowthRate,
            adjustedGdpGrowth,
            populationGrowthRate,
            actualGdpGrowth,
          });
        } else {
          const created = await prisma.country.upsert({
            where: { name },
            create: countryData,
            update: {
              // Only update wiki-sourced fields if we got wiki data
              ...(wikiData?.governmentType ? { governmentType: wikiData.governmentType } : {}),
              ...(wikiData?.religion ? { religion: wikiData.religion } : {}),
              ...(wikiData?.leader ? { leader: wikiData.leader } : {}),
              ...(wikiData?.population ? { currentPopulation: wikiData.population, baselinePopulation: wikiData.population } : {}),
              ...(wikiData?.areaKm2 ? { landArea: wikiData.areaKm2 } : {}),
              ...(flag ? { flag } : {}),
              continent,
            },
          });
          countryMap.set(name, {
            id: created.id,
            name: created.name,
            currentPopulation: created.currentPopulation,
            currentGdpPerCapita: created.currentGdpPerCapita,
            maxGdpGrowthRate: created.maxGdpGrowthRate,
            adjustedGdpGrowth: created.adjustedGdpGrowth,
            populationGrowthRate: created.populationGrowthRate,
            actualGdpGrowth: created.actualGdpGrowth,
          });
          countriesCreated++;
          console.log(`  [db] Created/updated: ${name} (id: ${created.id})`);
        }
      })
    );
  }

  console.log(`\n--- Country creation summary ---`);
  console.log(`  Created: ${countriesCreated}`);
  console.log(`  Wiki hits: ${wikiHits} / ${needsCreation.length}`);
  console.log(`  Wiki fallbacks: ${wikiFallbacks} / ${needsCreation.length}\n`);

  // Step 6: Create sovereignty records
  let sovereigntyCreated = 0;
  let sovereigntySkipped = 0;
  let sovereigntyErrors = 0;

  for (const row of rows) {
    const sovereignCountry = countryMap.get(row.sovereign);
    const subjectCountry = countryMap.get(row.dependency);

    if (!sovereignCountry || !subjectCountry) {
      console.error(
        `  [error] Missing country for sovereignty: ${row.sovereign} → ${row.dependency} ` +
          `(sovereign: ${!!sovereignCountry}, subject: ${!!subjectCountry})`
      );
      sovereigntyErrors++;
      continue;
    }

    const relationshipType = TYPE_MAP[row.type];
    if (!relationshipType) {
      console.error(`  [error] Unknown dependency type: "${row.type}"`);
      sovereigntyErrors++;
      continue;
    }

    const autonomyLevel = AUTONOMY_DEFAULTS[relationshipType] ?? 0.5;

    if (DRY_RUN) {
      console.log(
        `  [dry-run] Would link: ${row.sovereign} → ${row.dependency} ` +
          `(${relationshipType}, autonomy: ${autonomyLevel})`
      );
      sovereigntyCreated++;
      continue;
    }

    try {
      await prisma.countrySovereignty.upsert({
        where: {
          sovereignId_subjectId: {
            sovereignId: sovereignCountry.id,
            subjectId: subjectCountry.id,
          },
        },
        create: {
          sovereignId: sovereignCountry.id,
          subjectId: subjectCountry.id,
          relationshipType,
          autonomyLevel,
          isActive: true,
        },
        update: {
          relationshipType,
          autonomyLevel,
          isActive: true,
        },
      });
      sovereigntyCreated++;
      console.log(
        `  [sovereignty] ${row.sovereign} → ${row.dependency} (${relationshipType})`
      );
    } catch (err) {
      console.error(
        `  [error] Failed to create sovereignty: ${row.sovereign} → ${row.dependency}: ${(err as Error).message}`
      );
      sovereigntyErrors++;
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Countries created/updated: ${countriesCreated}`);
  console.log(`Wiki data hits: ${wikiHits} / ${needsCreation.length}`);
  console.log(`Sovereignty records created: ${sovereigntyCreated}`);
  console.log(`Sovereignty records skipped: ${sovereigntySkipped}`);
  console.log(`Errors: ${sovereigntyErrors}`);
  if (DRY_RUN) console.log(`\n[DRY RUN] No changes were made to the database.`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
