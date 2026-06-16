/**
 * wiki-entity-parser.ts — Map a parsed wiki infobox onto an IxStates
 * geographic entity (City / Subdivision / PointOfInterest).
 *
 * Pure functions only — no I/O. The caller fetches the wiki page
 * wikitext and the current entity state, then this module decides
 * which infobox fields are mappable to which entity attributes.
 *
 * Mapping table is intentionally conservative: only fields with
 * unambiguous, high-confidence matches are included. Anything
 * ambiguous (e.g. multiple `population_*` candidates) is reported
 * back so the UI can show the user what was applied and what was
 * skipped.
 */

import { parseInfobox, parsePopulation, type InfoboxField, type ParsedInfobox } from "./wiki-infobox-parser";
import { compareValues, type ContradictionVerdict } from "./country-geo-compliance";

export type EntityKind = "city" | "subdivision" | "poi";

export interface AppliedField {
  /** IxStats entity attribute name (e.g. "population") */
  field: string;
  /** Wiki infobox key the value came from (e.g. "population_total") */
  source: string;
  /** New value that would be written */
  newValue: number | string | null;
  /** Existing entity value (for diff display). `undefined` if not set. */
  oldValue: number | string | null | undefined;
  /** Human-readable label */
  label: string;
  /** Whether the new value matches, soft-mismatches, hard-mismatches, or is new. */
  verdict: ContradictionVerdict;
}

export interface SkippedField {
  field: string;
  reason: string;
}

export interface ParseWikiResult {
  /** True if at least one field was applied. */
  hasChanges: boolean;
  applied: AppliedField[];
  skipped: SkippedField[];
  /** Wiki page title that was parsed. */
  wikiTitle: string;
  /** The raw infobox template name (e.g. "Infobox settlement") */
  templateName: string | null;
  /** Optional friendly error if parsing failed. */
  error?: string;
}

/**
 * Parse wiki wikitext and produce a list of attributes that can be
 * applied to the given entity kind. Existing values are used to flag
 * overwrites so the UI can show a diff.
 */
export function parseEntityAttributesFromWiki(
  wikitext: string,
  kind: EntityKind,
  wikiTitle: string,
  existing: Record<string, any>
): ParseWikiResult {
  const infobox = parseInfobox(wikitext);
  if (!infobox) {
    return {
      hasChanges: false,
      applied: [],
      skipped: [],
      wikiTitle,
      templateName: null,
      error: "No infobox found on the wiki page.",
    };
  }

  // Build a fast lookup keyed by lowercase field name.
  const fieldsByKey = new Map<string, InfoboxField>();
  for (const f of infobox.fields) {
    fieldsByKey.set(f.key.toLowerCase().trim(), f);
  }

  // First defined wins among candidates. Strings → cleanValue, numbers → typedValue.
  const pickText = (...keys: string[]): { value: string; source: string } | null => {
    for (const k of keys) {
      const f = fieldsByKey.get(k.toLowerCase());
      if (f && f.cleanValue) return { value: f.cleanValue, source: f.key };
    }
    return null;
  };
  const pickNumber = (...keys: string[]): { value: number; source: string } | null => {
    for (const k of keys) {
      const f = fieldsByKey.get(k.toLowerCase());
      if (f && typeof f.typedValue === "number") return { value: f.typedValue, source: f.key };
      // Fallback: try parsePopulation on the cleanValue (handles "12.5 million" etc.)
      if (f && f.cleanValue) {
        const n = parsePopulation(f.cleanValue);
        if (n !== null) return { value: n, source: f.key };
      }
    }
    return null;
  };

  const applied: AppliedField[] = [];
  const skipped: SkippedField[] = [];

  // ── Common: leader / mayor / governor / capital ───────────────────
  const leader = pickText("leader_name1", "leader_name", "leader");
  const leaderTitle = pickText("leader_title1", "leader_title", "leader_name2");

  // ── Kind-specific mappings ────────────────────────────────────────
  if (kind === "city") {
    const pop = pickNumber(
      "population_total",
      "population_metro",
      "population_urban",
      "population",
      "population_estimate",
      "population_census"
    );
    if (pop) {
      applied.push(
        mkApplied("population", "Population", pop.value, pop.source, existing.population)
      );
    } else {
      skipped.push({ field: "population", reason: "no population field on infobox" });
    }

    if (leader) {
      const label = leaderTitle?.value.toLowerCase().includes("mayor") ? "mayorName" : "mayorName";
      applied.push(mkApplied(label, "Mayor", leader.value, leader.source, existing.mayorName));
    } else {
      skipped.push({ field: "mayorName", reason: "no leader_name field on infobox" });
    }

    const gdp = pickNumber("gdp_nominal", "gdp", "gdp_total");
    if (gdp) {
      applied.push(
        mkApplied("gdpContribution", "GDP Contribution", gdp.value, gdp.source, existing.gdpContribution)
      );
    } else {
      skipped.push({ field: "gdpContribution", reason: "no GDP field on infobox" });
    }

    const elev = pickNumber("elevation_m", "elevation");
    if (elev) {
      applied.push(mkApplied("elevation", "Elevation (m)", elev.value, elev.source, existing.elevation));
    }

    const founded = pickText("founded_date", "founded", "established", "established_date");
    if (founded) {
      const year = extractYear(founded.value);
      if (year !== null) {
        applied.push(mkApplied("foundedYear", "Founded year", year, founded.source, existing.foundedYear));
      }
    }

    // Specialization: use the wiki "settlement_type" / "type" only if not set.
    const specialization = pickText("settlement_type", "city_type", "type");
    if (specialization && !existing.specialization) {
      applied.push(
        mkApplied("specialization", "Specialization", specialization.value, specialization.source, existing.specialization)
      );
    }
  } else if (kind === "subdivision") {
    const pop = pickNumber(
      "population_total",
      "population",
      "population_estimate",
      "population_census",
      "pop"
    );
    if (pop) {
      applied.push(
        mkApplied("population", "Population", pop.value, pop.source, existing.population)
      );
    } else {
      skipped.push({ field: "population", reason: "no population field on infobox" });
    }

    if (leader) {
      applied.push(
        mkApplied("governorName", "Governor", leader.value, leader.source, existing.governorName)
      );
    } else {
      skipped.push({ field: "governorName", reason: "no leader_name field on infobox" });
    }

    const gdp = pickNumber("gdp_nominal", "gdp", "gdp_total");
    if (gdp) {
      applied.push(
        mkApplied(
          "gdpContribution",
          "GDP Contribution",
          gdp.value,
          gdp.source,
          existing.gdpContribution
        )
      );
    } else {
      skipped.push({ field: "gdpContribution", reason: "no GDP field on infobox" });
    }

    const area = pickNumber("area_total_km2", "area_km2", "area");
    if (area) {
      applied.push(
        mkApplied("areaSqKm", "Area (km²)", area.value, area.source, existing.areaSqKm)
      );
    } else {
      skipped.push({ field: "areaSqKm", reason: "no area field on infobox" });
    }

    const seat = pickText("seat", "capital", "administrative_center", "headquarters");
    if (seat) {
      applied.push(mkApplied("capital", "Capital / Seat", seat.value, seat.source, existing.capital));
    }
  } else if (kind === "poi") {
    const description = pickText("description", "summary", "abstract");
    if (description) {
      // POI description is the only thing the parser can really fill —
      // everything else is too entity-specific. Apply it even if existing
      // is set, since wiki summaries are usually more authoritative.
      applied.push(
        mkApplied("description", "Description", description.value, description.source, existing.description)
      );
    } else {
      skipped.push({ field: "description", reason: "no description field on infobox" });
    }
  }

  return {
    hasChanges: applied.length > 0,
    applied,
    skipped,
    wikiTitle,
    templateName: infobox.templateName,
  };
}

function mkApplied(
  field: string,
  label: string,
  newValue: number | string,
  source: string,
  oldValue: number | string | null | undefined
): AppliedField {
  return { field, label, source, newValue, oldValue, verdict: compareValues(field, oldValue, newValue) };
}

/** Extract a 4-digit year from strings like "1857", "12 May 1857", "{{start date|1857|5|12}}". */
function extractYear(text: string): number | null {
  // Strip templates first.
  const stripped = text.replace(/\{\{[^}]*\}\}/g, "").trim();
  const m = stripped.match(/\b(\d{3,4})\b/);
  if (!m) return null;
  const y = parseInt(m[1]!, 10);
  if (Number.isFinite(y) && y > 0 && y < 9999) return y;
  return null;
}
