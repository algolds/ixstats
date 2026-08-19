/**
 * country-geo-compliance.ts — Data integrity guards for the geographic
 * bundle returned by `getCountryGeoBundle`.
 *
 * Pure functions: take the bundle, return a list of issues. No I/O.
 * Designed to be called from both the server (tRPC) and the client
 * (live preview) so the same rules apply in both places.
 *
 * Issues are intentionally two-tiered:
 *   - "error"   — clear violation that should block downstream use
 *                  (e.g. city population > national population)
 *   - "warning" — soft inconsistency worth a user-visible flag
 *                  (e.g. orphan capital, coordinates outside bbox)
 *   - "info"    — pure observation (e.g. zero national capitals)
 */

export type ComplianceSeverity = "error" | "warning" | "info";

export type ComplianceCategory =
  | "population"
  | "gdp"
  | "capital"
  | "subdivision-capital"
  | "founded-year"
  | "coordinates"
  | "coverage";

export interface ComplianceIssue {
  /** Stable id so the UI can dedupe / filter. */
  id: string;
  severity: ComplianceSeverity;
  category: ComplianceCategory;
  /** Human-readable description. */
  message: string;
  /** Optional reference to the offending entity. */
  entityRef?: {
    kind: "city" | "subdivision" | "poi" | "country";
    id: string;
    name: string;
  };
  /** Optional numeric context (e.g. observed value, expected value). */
  context?: Record<string, number | string>;
}

export interface ComplianceInput {
  cities: Array<{
    id: string;
    name: string;
    type: string;
    isNationalCapital: boolean;
    isSubdivisionCapital: boolean;
    population: number | null;
    gdpContribution: number | null;
    coordinates: unknown;
    foundedYear: number | null;
  }>;
  subdivisions: Array<{
    id: string;
    name: string;
    type: string;
    population: number | null;
    gdpContribution: number | null;
    capital: string | null;
  }>;
  pois: Array<{ id: string; name: string; coordinates: unknown }>;
  country: {
    id: string;
    name: string;
    currentPopulation: number | null;
    currentTotalGdp: number | null;
    geoRollupMode: string | null;
  };
  rollups: {
    cityPopulationSum: number;
    subdivisionPopulationSum: number;
    cityGdpContributionSum: number;
    subdivisionGdpContributionSum: number;
    populationCoverage: number;
    gdpCoverage: number;
  } | null;
  /** [minLng, minLat, maxLng, maxLat] of the country's bounding box. */
  boundingBox: [number, number, number, number] | null;
}

/** Threshold for treating two values as "the same" when checking contradictions. */
const POPULATION_TOLERANCE = 0.1; // ±10% counts as a soft match
const GDP_TOLERANCE = 0.1;

export function checkGeoCompliance(input: ComplianceInput): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const { cities, subdivisions, country, rollups, boundingBox } = input;
  const nationalPop = country.currentPopulation ?? 0;
  const nationalGdp = country.currentTotalGdp ?? 0;
  const currentYear = new Date().getUTCFullYear();

  // ── Population guards ────────────────────────────────────────────
  if (nationalPop > 0) {
    for (const city of cities) {
      if (city.population != null && city.population > nationalPop) {
        issues.push({
          id: `city-pop-exceeds-national:${city.id}`,
          severity: "error",
          category: "population",
          message: `${city.name}'s population (${formatNumber(city.population)}) exceeds the national total (${formatNumber(nationalPop)}).`,
          entityRef: { kind: "city", id: city.id, name: city.name },
          context: {
            cityPopulation: city.population,
            nationalPopulation: nationalPop,
          },
        });
      }
    }
    for (const sub of subdivisions) {
      if (sub.population != null && sub.population > nationalPop) {
        issues.push({
          id: `sub-pop-exceeds-national:${sub.id}`,
          severity: "error",
          category: "population",
          message: `${sub.name}'s population (${formatNumber(sub.population)}) exceeds the national total (${formatNumber(nationalPop)}).`,
          entityRef: { kind: "subdivision", id: sub.id, name: sub.name },
        });
      }
    }
    if (rollups && rollups.subdivisionPopulationSum > nationalPop * 1.05) {
      issues.push({
        id: "sub-pop-sum-exceeds-national",
        severity: "error",
        category: "population",
        message: `Subdivision populations sum to ${formatNumber(rollups.subdivisionPopulationSum)}, which exceeds the national total (${formatNumber(nationalPop)}).`,
        context: {
          subSum: rollups.subdivisionPopulationSum,
          national: nationalPop,
        },
      });
    }
    if (rollups && rollups.cityPopulationSum > nationalPop * 1.05) {
      issues.push({
        id: "city-pop-sum-exceeds-national",
        severity: "error",
        category: "population",
        message: `City populations sum to ${formatNumber(rollups.cityPopulationSum)}, which exceeds the national total (${formatNumber(nationalPop)}).`,
        context: {
          citySum: rollups.cityPopulationSum,
          national: nationalPop,
        },
      });
    }
  }

  // ── GDP guards ───────────────────────────────────────────────────
  if (nationalGdp > 0) {
    for (const city of cities) {
      if (city.gdpContribution != null && city.gdpContribution > nationalGdp) {
        issues.push({
          id: `city-gdp-exceeds-national:${city.id}`,
          severity: "error",
          category: "gdp",
          message: `${city.name}'s GDP contribution (${formatNumber(Math.round(city.gdpContribution))}) exceeds the national GDP (${formatNumber(Math.round(nationalGdp))}).`,
          entityRef: { kind: "city", id: city.id, name: city.name },
        });
      }
    }
    for (const sub of subdivisions) {
      if (sub.gdpContribution != null && sub.gdpContribution > nationalGdp) {
        issues.push({
          id: `sub-gdp-exceeds-national:${sub.id}`,
          severity: "error",
          category: "gdp",
          message: `${sub.name}'s GDP contribution exceeds the national GDP.`,
          entityRef: { kind: "subdivision", id: sub.id, name: sub.name },
        });
      }
    }
    if (rollups && rollups.subdivisionGdpContributionSum > nationalGdp * 1.05) {
      issues.push({
        id: "sub-gdp-sum-exceeds-national",
        severity: "error",
        category: "gdp",
        message: `Subdivision GDP sums exceed the national total.`,
      });
    }
    if (rollups && rollups.cityGdpContributionSum > nationalGdp * 1.05) {
      issues.push({
        id: "city-gdp-sum-exceeds-national",
        severity: "error",
        category: "gdp",
        message: `City GDP sums exceed the national total.`,
      });
    }
  }

  // ── Capital uniqueness ───────────────────────────────────────────
  const capitals = cities.filter((c) => c.isNationalCapital);
  if (capitals.length === 0) {
    issues.push({
      id: "no-national-capital",
      severity: "info",
      category: "capital",
      message: "No city is marked as the national capital.",
      entityRef: { kind: "country", id: country.id, name: country.name },
    });
  } else if (capitals.length > 1) {
    issues.push({
      id: "multiple-national-capitals",
      severity: "error",
      category: "capital",
      message: `Multiple cities are marked as the national capital: ${capitals.map((c) => c.name).join(", ")}.`,
    });
  }

  // ── Subdivision capital integrity ────────────────────────────────
  const cityNamesLower = new Set(cities.map((c) => c.name.toLowerCase()));
  for (const sub of subdivisions) {
    if (sub.capital && sub.capital.trim().length > 0) {
      if (!cityNamesLower.has(sub.capital.toLowerCase())) {
        issues.push({
          id: `orphan-sub-capital:${sub.id}`,
          severity: "warning",
          category: "subdivision-capital",
          message: `${sub.name} lists "${sub.capital}" as its capital, but no city with that name is registered.`,
          entityRef: { kind: "subdivision", id: sub.id, name: sub.name },
        });
      }
    }
  }

  // ── Founded year sanity ──────────────────────────────────────────
  for (const city of cities) {
    if (city.foundedYear != null) {
      if (city.foundedYear < 0) {
        issues.push({
          id: `city-founded-negative:${city.id}`,
          severity: "error",
          category: "founded-year",
          message: `${city.name} has a founded year before 0 (${city.foundedYear}).`,
          entityRef: { kind: "city", id: city.id, name: city.name },
        });
      } else if (city.foundedYear > currentYear) {
        issues.push({
          id: `city-founded-future:${city.id}`,
          severity: "error",
          category: "founded-year",
          message: `${city.name}'s founded year (${city.foundedYear}) is in the future.`,
          entityRef: { kind: "city", id: city.id, name: city.name },
        });
      }
    }
  }

  // ── Coordinate bounds ────────────────────────────────────────────
  if (boundingBox) {
    const [minLng, minLat, maxLng, maxLat] = boundingBox;
    const checkCoords = (
      id: string,
      name: string,
      kind: "city" | "subdivision" | "poi",
      raw: unknown
    ) => {
      const coords = extractLngLat(raw);
      if (!coords) return;
      const [lng, lat] = coords;
      // Allow a small margin (5% of span) to account for border straddle.
      const lngMargin = (maxLng - minLng) * 0.05;
      const latMargin = (maxLat - minLat) * 0.05;
      if (
        lng < minLng - lngMargin ||
        lng > maxLng + lngMargin ||
        lat < minLat - latMargin ||
        lat > maxLat + latMargin
      ) {
        issues.push({
          id: `${kind}-outside-bbox:${id}`,
          severity: "warning",
          category: "coordinates",
          message: `${name}'s coordinates (${lat.toFixed(2)}, ${lng.toFixed(2)}) fall outside the country's bounding box.`,
          entityRef: { kind, id, name },
        });
      }
    };
    for (const city of cities) checkCoords(city.id, city.name, "city", city.coordinates);
    for (const poi of input.pois) checkCoords(poi.id, poi.name, "poi", poi.coordinates);
  }

  // ── Coverage warning (bottom-up mode) ────────────────────────────
  if (rollups && country.geoRollupMode === "bottom-up") {
    if (rollups.populationCoverage < 0.5) {
      issues.push({
        id: "low-population-coverage",
        severity: "warning",
        category: "coverage",
        message: `Bottom-up mode is active but only ${Math.round(rollups.populationCoverage * 100)}% of the national population is covered by subdivisions.`,
      });
    }
    if (rollups.gdpCoverage < 0.5) {
      issues.push({
        id: "low-gdp-coverage",
        severity: "warning",
        category: "coverage",
        message: `Bottom-up mode is active but only ${Math.round(rollups.gdpCoverage * 100)}% of the national GDP is covered.`,
      });
    }
  }

  return issues;
}

/** Extract [lng, lat] from a stored coordinates value (array or GeoJSON-like). */
function extractLngLat(raw: unknown): [number, number] | null {
  if (Array.isArray(raw) && raw.length >= 2) {
    const a = Number(raw[0]);
    const b = Number(raw[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) return [a, b];
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if ("coordinates" in obj && Array.isArray((obj as any).coordinates)) {
      return extractLngLat((obj as any).coordinates);
    }
    if ("lng" in obj && "lat" in obj) {
      const lng = Number((obj as any).lng);
      const lat = Number((obj as any).lat);
      if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    }
  }
  return null;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Compare a parsed wiki field to the entity's existing value and return
 * a "match", "soft-mismatch", or "hard-mismatch" verdict. Used by the
 * UI to flag contradictions when populating from a wiki page.
 */
export type ContradictionVerdict = "match" | "soft-mismatch" | "hard-mismatch" | "new";

export function compareValues(
  field: string,
  existing: number | string | null | undefined,
  parsed: number | string
): ContradictionVerdict {
  if (existing == null || existing === "") return "new";

  // Numeric comparison with tolerance.
  if (typeof existing === "number" && typeof parsed === "number") {
    if (existing === 0) {
      return parsed === 0 ? "match" : "hard-mismatch";
    }
    const ratio = Math.abs(parsed - existing) / Math.abs(existing);
    if (ratio <= 0.05) return "match";
    const tol = field.startsWith("population") ? POPULATION_TOLERANCE : GDP_TOLERANCE;
    if (ratio <= tol) return "soft-mismatch";
    return "hard-mismatch";
  }

  // String comparison (case-insensitive, whitespace-normalized).
  if (typeof existing === "string" && typeof parsed === "string") {
    const a = existing.trim().toLowerCase();
    const b = parsed.trim().toLowerCase();
    if (a === b) return "match";
    // Soft mismatch: same prefix/contains.
    if (a.includes(b) || b.includes(a)) return "soft-mismatch";
    return "hard-mismatch";
  }

  // Mismatched types.
  return "hard-mismatch";
}
