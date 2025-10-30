/**
 * MediaWiki Country Infobox to IxStats Database Mapping
 *
 * Maps Wikipedia/IxWiki Template:Infobox_country parameters to IxStats database schema
 *
 * Usage:
 * const wikiData = parseInfoboxTemplate(wikitext);
 * const mappedData = mapInfoboxToIxStats(wikiData);
 * await importCountryData(mappedData);
 */

export interface WikiInfoboxData {
  [key: string]: string | number | null;
}

export interface IxStatsCountryData {
  // Country Basic Info
  name?: string;
  slug?: string;

  // National Identity (NationalIdentity model)
  nationalIdentity?: {
    officialName?: string;
    countryName?: string;
    governmentType?: string;
    motto?: string;
    mottoNative?: string;
    capitalCity?: string;
    largestCity?: string;
    demonym?: string;
    currency?: string;
    currencySymbol?: string;
    officialLanguages?: string;
    nationalLanguage?: string;
    nationalAnthem?: string;
    nationalDay?: string;
    callingCode?: string;
    internetTLD?: string;
    drivingSide?: string;
    timeZone?: string;
    isoCode?: string;
    coordinatesLatitude?: string;
    coordinatesLongitude?: string;
  };

  // Geography
  continent?: string;
  region?: string;
  landArea?: number;
  areaSqMi?: number;

  // Demographics (Country model)
  currentPopulation?: number;
  baselinePopulation?: number;
  populationDensity?: number;
  religion?: string;
  leader?: string;

  // Metadata
  flag?: string;
  coatOfArms?: string;
}

/**
 * Mapping configuration from Wiki infobox parameters to IxStats fields
 */
export const INFOBOX_FIELD_MAPPING: Record<
  string,
  {
    ixStatsField: string;
    model: "Country" | "NationalIdentity";
    transform?: (value: string) => any;
  }
> = {
  // === NATIONAL IDENTITY FIELDS === //
  conventional_long_name: {
    ixStatsField: "nationalIdentity.officialName",
    model: "NationalIdentity",
  },
  native_name: {
    ixStatsField: "nationalIdentity.officialName", // Fallback if conventional_long_name not present
    model: "NationalIdentity",
  },
  common_name: {
    ixStatsField: "name",
    model: "Country",
  },
  national_motto: {
    ixStatsField: "nationalIdentity.motto",
    model: "NationalIdentity",
  },
  englishmotto: {
    ixStatsField: "nationalIdentity.motto", // English version takes precedence
    model: "NationalIdentity",
  },
  national_anthem: {
    ixStatsField: "nationalIdentity.nationalAnthem",
    model: "NationalIdentity",
  },
  capital: {
    ixStatsField: "nationalIdentity.capitalCity",
    model: "NationalIdentity",
  },
  largest_city: {
    ixStatsField: "nationalIdentity.largestCity",
    model: "NationalIdentity",
  },
  official_languages: {
    ixStatsField: "nationalIdentity.officialLanguages",
    model: "NationalIdentity",
  },
  national_languages: {
    ixStatsField: "nationalIdentity.nationalLanguage",
    model: "NationalIdentity",
  },
  demonym: {
    ixStatsField: "nationalIdentity.demonym",
    model: "NationalIdentity",
  },
  government_type: {
    ixStatsField: "nationalIdentity.governmentType",
    model: "NationalIdentity",
    transform: (value) => {
      // Normalize government types to IxStats standard values
      const normalized = value.toLowerCase();
      if (normalized.includes("republic")) return "republic";
      if (normalized.includes("kingdom") || normalized.includes("monarchy")) return "kingdom";
      if (normalized.includes("federation")) return "federation";
      if (normalized.includes("empire")) return "empire";
      if (normalized.includes("sultanate")) return "sultanate";
      if (normalized.includes("emirate")) return "emirate";
      return "republic"; // default
    },
  },

  // === COUNTRY MODEL FIELDS === //
  religion: {
    ixStatsField: "religion",
    model: "Country",
  },
  leader_name1: {
    ixStatsField: "leader",
    model: "Country",
  },
  area_km2: {
    ixStatsField: "landArea",
    model: "Country",
    transform: (value) => parseFloat(value.replace(/,/g, "")),
  },
  area_sq_mi: {
    ixStatsField: "areaSqMi",
    model: "Country",
    transform: (value) => parseFloat(value.replace(/,/g, "")),
  },
  population_estimate: {
    ixStatsField: "currentPopulation",
    model: "Country",
    transform: (value) => parseInt(value.replace(/,/g, "")),
  },
  population_census: {
    ixStatsField: "currentPopulation",
    model: "Country",
    transform: (value) => parseInt(value.replace(/,/g, "")),
  },
  population_density_km2: {
    ixStatsField: "populationDensity",
    model: "Country",
    transform: (value) => parseFloat(value.replace(/,/g, "")),
  },

  // === IMAGES === //
  image_flag: {
    ixStatsField: "flag",
    model: "Country",
    transform: (value) => {
      // Convert wiki file reference to URL
      if (value.startsWith("File:") || value.startsWith("Image:")) {
        return `https://upload.wikimedia.org/wikipedia/commons/${value.replace("File:", "").replace("Image:", "")}`;
      }
      return value;
    },
  },
  image_coat: {
    ixStatsField: "coatOfArms",
    model: "Country",
    transform: (value) => {
      if (value.startsWith("File:") || value.startsWith("Image:")) {
        return `https://upload.wikimedia.org/wikipedia/commons/${value.replace("File:", "").replace("Image:", "")}`;
      }
      return value;
    },
  },

  // === GEOGRAPHY (parsed from map or location data) === //
  // These would need custom parsing from map_caption or other location fields

  // === CURRENCY (needs parsing from GDP or economy sections) === //
  // Currency info often in "currency" parameter or economy section
};

/**
 * Parse MediaWiki infobox template text into key-value pairs
 */
export function parseInfoboxTemplate(wikitext: string): WikiInfoboxData {
  const data: WikiInfoboxData = {};

  // Match {{Infobox country ... }}
  const infoboxMatch = wikitext.match(/\{\{Infobox country\s*([\s\S]*?)\}\}/i);
  if (!infoboxMatch) return data;

  const infoboxContent = infoboxMatch[1];

  // Parse parameter lines
  const paramRegex = /\|\s*(\w+)\s*=\s*([^\|]*)/g;
  let match;

  while ((match = paramRegex.exec(infoboxContent)) !== null) {
    const [, key, value] = match;
    // Clean up value (remove wiki markup, extra whitespace)
    const cleanValue = value
      .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2") // Remove wiki links
      .replace(/<[^>]+>/g, "") // Remove HTML tags
      .replace(/\{\{[^}]+\}\}/g, "") // Remove templates
      .trim();

    if (cleanValue) {
      data[key.trim()] = cleanValue;
    }
  }

  return data;
}

/**
 * Map parsed wiki infobox data to IxStats database structure
 */
export function mapInfoboxToIxStats(wikiData: WikiInfoboxData): IxStatsCountryData {
  const result: IxStatsCountryData = {
    nationalIdentity: {},
  };

  // Apply mappings
  for (const [wikiParam, mapping] of Object.entries(INFOBOX_FIELD_MAPPING)) {
    const wikiValue = wikiData[wikiParam];
    if (wikiValue === null || wikiValue === undefined || wikiValue === "") continue;

    // Transform value if needed
    const transformedValue = mapping.transform ? mapping.transform(String(wikiValue)) : wikiValue;

    // Set value in appropriate location
    const fieldPath = mapping.ixStatsField.split(".");
    if (fieldPath.length === 1) {
      // Top-level field
      (result as any)[fieldPath[0]] = transformedValue;
    } else if (fieldPath.length === 2) {
      // Nested field (e.g., nationalIdentity.motto)
      const [parent, child] = fieldPath;
      if (!result[parent as keyof IxStatsCountryData]) {
        (result as any)[parent] = {};
      }
      (result as any)[parent][child] = transformedValue;
    }
  }

  // Generate slug from name
  if (result.name) {
    result.slug = result.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  // Set baseline population same as current if we have it
  if (result.currentPopulation) {
    result.baselinePopulation = result.currentPopulation;
  }

  // Copy common_name to nationalIdentity.countryName if not set
  if (result.name && result.nationalIdentity) {
    result.nationalIdentity.countryName = result.nationalIdentity.countryName || result.name;
  }

  return result;
}

/**
 * Parse coordinates from Wikipedia format to lat/long
 */
export function parseCoordinates(
  coordString: string
): { latitude: string; longitude: string } | null {
  // Match formats like "51°30′N 0°7′W" or "40.7128°N, 74.0060°W"
  const dmsMatch = coordString.match(
    /(\d+)[°º](\d+)?['′]?(\d+)?["″]?([NS])\s*[,\s]*(\d+)[°º](\d+)?['′]?(\d+)?["″]?([EW])/
  );

  if (dmsMatch) {
    const [
      ,
      latDeg,
      latMin = "0",
      latSec = "0",
      latDir,
      lonDeg,
      lonMin = "0",
      lonSec = "0",
      lonDir,
    ] = dmsMatch;

    let lat = parseInt(latDeg) + parseInt(latMin) / 60 + parseInt(latSec) / 3600;
    let lon = parseInt(lonDeg) + parseInt(lonMin) / 60 + parseInt(lonSec) / 3600;

    if (latDir === "S") lat = -lat;
    if (lonDir === "W") lon = -lon;

    return {
      latitude: lat.toFixed(6),
      longitude: lon.toFixed(6),
    };
  }

  // Try decimal format
  const decimalMatch = coordString.match(
    /(-?\d+\.?\d*)[°º]?\s*([NS])[,\s]+(-?\d+\.?\d*)[°º]?\s*([EW])/
  );
  if (decimalMatch) {
    let [, lat, latDir, lon, lonDir] = decimalMatch;
    let latitude = parseFloat(lat);
    let longitude = parseFloat(lon);

    if (latDir === "S") latitude = -Math.abs(latitude);
    if (lonDir === "W") longitude = -Math.abs(longitude);

    return {
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
    };
  }

  return null;
}

/**
 * Example usage and test data
 */
export const EXAMPLE_WIKI_INFOBOX = `
{{Infobox country
| conventional_long_name = Republic of Example
| common_name = Example
| native_name = République d'Exemple
| image_flag = Flag of Example.svg
| image_coat = Coat of arms of Example.svg
| national_motto = "Unity and Progress"
| national_anthem = "Our Homeland"
| capital = Example City
| largest_city = capital
| official_languages = English, French
| demonym = Examplean
| government_type = Federal Republic
| leader_title1 = President
| leader_name1 = John Smith
| area_km2 = 500000
| population_estimate = 25000000
| population_estimate_year = 2024
| population_density_km2 = 50
| religion = Christianity (60%), Islam (30%), Other (10%)
}}
`;
