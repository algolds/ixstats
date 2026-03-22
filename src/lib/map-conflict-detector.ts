/**
 * map-conflict-detector.ts — Detect conflicts and suggest improvements
 * for map features within a country.
 *
 * Pure functions — no database access. Takes pre-fetched data as input.
 */

export type ConflictSeverity = "info" | "warning" | "error";
export type ConflictCategory =
  | "duplicate"
  | "coordinate-mismatch"
  | "missing-wiki-link"
  | "orphaned-wiki-link"
  | "coverage-gap"
  | "naming-conflict";

export interface ConflictReport {
  severity: ConflictSeverity;
  category: ConflictCategory;
  message: string;
  featureId?: string;
  featureName?: string;
  suggestion?: string;
}

export interface FeatureData {
  id: string;
  name: string;
  type: "city" | "poi" | "subdivision";
  coordinates?: [number, number] | null;
  wikiPageTitle?: string | null;
  wikiCoordinates?: [number, number] | null;
  population?: number | null;
  areaSqKm?: number | null;
}

export interface CountryConflictInput {
  countryId: string;
  countryName: string;
  totalAreaKm2?: number;
  features: FeatureData[];
}

/**
 * Run all conflict checks and return a sorted list of reports.
 */
export function detectConflicts(input: CountryConflictInput): ConflictReport[] {
  const reports: ConflictReport[] = [];

  reports.push(...checkDuplicateNames(input.features));
  reports.push(...checkCoordinateMismatches(input.features));
  reports.push(...checkMissingWikiLinks(input.features));
  reports.push(...checkCoverageGaps(input.features, input.totalAreaKm2));

  // Sort: errors first, then warnings, then info
  const severityOrder: Record<ConflictSeverity, number> = { error: 0, warning: 1, info: 2 };
  reports.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return reports;
}

/**
 * Check for duplicate feature names within the same type.
 */
function checkDuplicateNames(features: FeatureData[]): ConflictReport[] {
  const reports: ConflictReport[] = [];
  const nameGroups = new Map<string, FeatureData[]>();

  for (const f of features) {
    const key = `${f.type}:${f.name.toLowerCase()}`;
    if (!nameGroups.has(key)) nameGroups.set(key, []);
    nameGroups.get(key)!.push(f);
  }

  for (const [, group] of nameGroups) {
    if (group.length > 1) {
      reports.push({
        severity: "warning",
        category: "duplicate",
        message: `Duplicate ${group[0]!.type} name: "${group[0]!.name}" appears ${group.length} times`,
        featureId: group[0]!.id,
        featureName: group[0]!.name,
        suggestion: `Rename or merge the duplicate ${group[0]!.type} entries`,
      });
    }
  }

  // Also check cross-type duplicates (city and POI with same name)
  const allNames = new Map<string, FeatureData[]>();
  for (const f of features) {
    const lower = f.name.toLowerCase();
    if (!allNames.has(lower)) allNames.set(lower, []);
    allNames.get(lower)!.push(f);
  }

  for (const [, group] of allNames) {
    if (group.length > 1) {
      const types = [...new Set(group.map((f) => f.type))];
      if (types.length > 1) {
        reports.push({
          severity: "info",
          category: "naming-conflict",
          message: `"${group[0]!.name}" exists as both ${types.join(" and ")}`,
          featureName: group[0]!.name,
          suggestion: "Verify these are intentionally separate features",
        });
      }
    }
  }

  return reports;
}

/**
 * Check for mismatches between map coordinates and wiki coordinates.
 */
function checkCoordinateMismatches(features: FeatureData[]): ConflictReport[] {
  const reports: ConflictReport[] = [];

  for (const f of features) {
    if (!f.coordinates || !f.wikiCoordinates) continue;

    const distKm = haversineKm(f.coordinates, f.wikiCoordinates);

    if (distKm > 500) {
      reports.push({
        severity: "error",
        category: "coordinate-mismatch",
        message: `"${f.name}" map position is ${Math.round(distKm)} km from wiki coordinates`,
        featureId: f.id,
        featureName: f.name,
        suggestion: "Update map position or wiki coordinates to match",
      });
    } else if (distKm > 50) {
      reports.push({
        severity: "warning",
        category: "coordinate-mismatch",
        message: `"${f.name}" map position is ${Math.round(distKm)} km from wiki coordinates`,
        featureId: f.id,
        featureName: f.name,
        suggestion: "Verify the coordinates are correct for the IxWorld projection",
      });
    }
  }

  return reports;
}

/**
 * Check for features missing wiki links.
 */
function checkMissingWikiLinks(features: FeatureData[]): ConflictReport[] {
  const reports: ConflictReport[] = [];

  const cities = features.filter((f) => f.type === "city");
  const unlinked = cities.filter((f) => !f.wikiPageTitle);

  if (unlinked.length > 0 && cities.length > 0) {
    const pct = Math.round((unlinked.length / cities.length) * 100);
    if (pct > 50) {
      reports.push({
        severity: "info",
        category: "missing-wiki-link",
        message: `${unlinked.length} of ${cities.length} cities (${pct}%) have no wiki page linked`,
        suggestion: "Use the wiki search in the editor to link cities to their wiki articles",
      });
    }

    // Individual warnings for capitals without wiki links
    for (const f of unlinked) {
      if (f.population && f.population > 1_000_000) {
        reports.push({
          severity: "warning",
          category: "missing-wiki-link",
          message: `Major city "${f.name}" (pop. ${f.population.toLocaleString()}) has no wiki page linked`,
          featureId: f.id,
          featureName: f.name,
          suggestion: `Search for "${f.name}" in the wiki linker`,
        });
      }
    }
  }

  return reports;
}

/**
 * Check for subdivision coverage gaps.
 */
function checkCoverageGaps(features: FeatureData[], totalAreaKm2?: number): ConflictReport[] {
  const reports: ConflictReport[] = [];

  const subdivisions = features.filter((f) => f.type === "subdivision" && f.areaSqKm);
  if (subdivisions.length === 0 || !totalAreaKm2 || totalAreaKm2 <= 0) return reports;

  const coveredArea = subdivisions.reduce((s, f) => s + (f.areaSqKm ?? 0), 0);
  const coveragePct = Math.round((coveredArea / totalAreaKm2) * 100);

  if (coveragePct < 50) {
    reports.push({
      severity: "info",
      category: "coverage-gap",
      message: `Subdivisions cover only ${coveragePct}% of country area (${Math.round(coveredArea).toLocaleString()} of ${Math.round(totalAreaKm2).toLocaleString()} km²)`,
      suggestion: "Add more subdivisions to improve coverage, or import provinces from SVG",
    });
  }

  return reports;
}

// ── Utilities ──────────────────────────────────────────────────────

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
