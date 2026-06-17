/**
 * City Import Parser
 *
 * Pure functions (no React, no DB) for parsing and validating
 * city import files in CSV, TSV, or JSON format.
 */

import * as Papa from "papaparse";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RawCityRow {
  name: string;
  lat: number;
  lng: number;
  cityType?: string;
  population?: number;
  foundedYear?: number;
  elevation?: number;
  isNationalCapital?: boolean;
  isSubdivisionCapital?: boolean;
  subdivisionId?: string;
  wikiPageTitle?: string;
  /** Original row index (1-based) for error messages */
  _rowIndex?: number;
  /** Per-row parse-time errors */
  _parseErrors?: string[];
}

export interface ParsedCityImport {
  rows: RawCityRow[];
  errors: string[];
  warnings: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseBooleanish(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const s = String(value).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

function parseInteger(value: unknown): number | undefined {
  const n = parseNumber(value);
  if (n === undefined) return undefined;
  return Math.trunc(n);
}

function resolveField(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in row && row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return undefined;
}

// ── Row normalizer ───────────────────────────────────────────────────────────

function normalizeRow(raw: Record<string, unknown>, rowIndex: number): RawCityRow {
  const parseErrors: string[] = [];

  // name
  const rawName = resolveField(raw, "name");
  const name = rawName !== undefined ? String(rawName).trim() : "";
  if (!name) {
    parseErrors.push(`Row ${rowIndex}: missing required field "name"`);
  } else if (name.length > 100) {
    parseErrors.push(`Row ${rowIndex}: name exceeds 100 characters`);
  }

  // lat
  const rawLat = resolveField(raw, "lat", "latitude");
  const lat = parseNumber(rawLat);
  if (rawLat === undefined || rawLat === null || rawLat === "") {
    parseErrors.push(`Row ${rowIndex}: missing required field "lat" / "latitude"`);
  } else if (lat === undefined) {
    parseErrors.push(`Row ${rowIndex}: invalid lat "${rawLat}" — must be a number`);
  } else if (lat < -90 || lat > 90) {
    parseErrors.push(`Row ${rowIndex}: lat ${lat} out of range [-90, 90]`);
  }

  // lng
  const rawLng = resolveField(raw, "lng", "lon", "longitude");
  const lng = parseNumber(rawLng);
  if (rawLng === undefined || rawLng === null || rawLng === "") {
    parseErrors.push(`Row ${rowIndex}: missing required field "lng" / "lon" / "longitude"`);
  } else if (lng === undefined) {
    parseErrors.push(`Row ${rowIndex}: invalid lng "${rawLng}" — must be a number`);
  } else if (lng < -180 || lng > 180) {
    parseErrors.push(`Row ${rowIndex}: lng ${lng} out of range [-180, 180]`);
  }

  // cityType
  const rawType = resolveField(raw, "type", "cityType");
  const cityType = rawType !== undefined ? String(rawType).trim() : undefined;

  // population
  const rawPop = resolveField(raw, "population");
  let population: number | undefined;
  if (rawPop !== undefined) {
    const p = parseInteger(rawPop);
    if (p === undefined) {
      parseErrors.push(`Row ${rowIndex}: invalid population "${rawPop}" — must be an integer`);
    } else if (p < 0) {
      parseErrors.push(`Row ${rowIndex}: population ${p} must be >= 0`);
    } else {
      population = p;
    }
  }

  // foundedYear
  const rawFounded = resolveField(raw, "foundedYear", "founded");
  let foundedYear: number | undefined;
  if (rawFounded !== undefined) {
    const y = parseInteger(rawFounded);
    if (y === undefined) {
      parseErrors.push(`Row ${rowIndex}: invalid foundedYear "${rawFounded}" — must be an integer`);
    } else {
      foundedYear = y;
    }
  }

  // elevation
  const rawElev = resolveField(raw, "elevation");
  let elevation: number | undefined;
  if (rawElev !== undefined) {
    const e = parseNumber(rawElev);
    if (e === undefined) {
      parseErrors.push(`Row ${rowIndex}: invalid elevation "${rawElev}" — must be a number`);
    } else {
      elevation = e;
    }
  }

  // isNationalCapital
  const rawCapital = resolveField(raw, "isNationalCapital", "capital");
  const isNationalCapital = rawCapital !== undefined ? parseBooleanish(rawCapital) : undefined;

  // isSubdivisionCapital
  const rawRegCapital = resolveField(raw, "isSubdivisionCapital", "regionalCapital");
  const isSubdivisionCapital =
    rawRegCapital !== undefined ? parseBooleanish(rawRegCapital) : undefined;

  // subdivisionId
  const rawSubId = resolveField(raw, "subdivisionId", "regionId");
  const subdivisionId = rawSubId !== undefined ? String(rawSubId).trim() : undefined;

  // wikiPageTitle
  const rawWiki = resolveField(raw, "wikiPageTitle");
  let wikiPageTitle: number | string | undefined;
  if (rawWiki !== undefined) {
    const w = String(rawWiki).trim();
    if (w.length > 200) {
      parseErrors.push(`Row ${rowIndex}: wikiPageTitle exceeds 200 characters`);
    } else {
      wikiPageTitle = w;
    }
  }

  return {
    name,
    lat: lat ?? 0,
    lng: lng ?? 0,
    cityType: cityType || undefined,
    population,
    foundedYear,
    elevation,
    isNationalCapital: isNationalCapital ?? undefined,
    isSubdivisionCapital: isSubdivisionCapital ?? undefined,
    subdivisionId: subdivisionId || undefined,
    wikiPageTitle: wikiPageTitle ? String(wikiPageTitle) : undefined,
    _rowIndex: rowIndex,
    _parseErrors: parseErrors,
  };
}

// ── Main export ──────────────────────────────────────────────────────────────

export function parseCityImportText(text: string, fileName: string): ParsedCityImport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: RawCityRow[] = [];

  const trimmed = text.trim();
  const ext = fileName.toLowerCase().split(".").pop() ?? "";

  let rawObjects: Record<string, unknown>[] = [];

  // Detect format
  const isJson = ext === "json" || trimmed.startsWith("[") || trimmed.startsWith("{");
  const isTsv = ext === "tsv";

  if (isJson) {
    // JSON parse
    try {
      let parsed: unknown = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        // Allow single-object JSON
        parsed = [parsed];
      }
      rawObjects = parsed as Record<string, unknown>[];
    } catch (e) {
      errors.push(`JSON parse error: ${e instanceof Error ? e.message : "unknown"}`);
      return { rows, errors, warnings };
    }
  } else if (isTsv) {
    const result = Papa.parse<Record<string, unknown>>(trimmed, {
      header: true,
      delimiter: "\t",
      skipEmptyLines: true,
    });
    if (result.errors.length > 0) {
      result.errors.forEach((err) => errors.push(`TSV parse error: ${err.message}`));
    }
    rawObjects = result.data;
  } else {
    // Default: CSV
    const result = Papa.parse<Record<string, unknown>>(trimmed, {
      header: true,
      skipEmptyLines: true,
    });
    if (result.errors.length > 0) {
      result.errors.forEach((err) => errors.push(`CSV parse error: ${err.message}`));
    }
    rawObjects = result.data;
  }

  if (rawObjects.length === 0) {
    errors.push("No rows found in file");
    return { rows, errors, warnings };
  }

  // Normalize rows
  for (let i = 0; i < rawObjects.length; i++) {
    const row = normalizeRow(rawObjects[i] as Record<string, unknown>, i + 1);
    rows.push(row);
  }

  // Duplicate name warnings
  const nameCount: Record<string, number> = {};
  for (const row of rows) {
    if (row.name) {
      nameCount[row.name] = (nameCount[row.name] ?? 0) + 1;
    }
  }
  for (const [name, count] of Object.entries(nameCount)) {
    if (count > 1) {
      warnings.push(`Duplicate name in batch: "${name}" appears ${count} times`);
    }
  }

  return { rows, errors, warnings };
}
