/**
 * The source adapter interface: an adapter knows one repository layout (which files, which fields) and turns
 * their text into a SourceSnapshot. Every path and field name comes from the realm's own settings, which the
 * adapter validates with its schema; adapters never fetch, write or evaluate anything.
 */
import type { MultiPolygon, Polygon } from "geojson";
import type { z } from "zod";
import type { AllianceType } from "../config";

/** The figures a source nation carries, each of which the source may mark as from a less-trusted secondary source. */
export type SourceFigureField =
  "officialName" | "population" | "gdpPerCapita" | "landArea" | "capital";

export interface SourceNation {
  /** Stable key in the source (becomes Country.externalSourceKey and the map feature id). */
  key: string;
  /** Short name to show: the wiki title when the source links one, else the key made readable. */
  displayName: string;
  /** The nation's wiki page title, from its wiki link, when the link points at the realm's wiki. */
  wikiTitle: string | null;
  officialName: string | null;
  population: number | null;
  gdpPerCapita: number | null;
  /** Stated land area in km². */
  landArea: number | null;
  capital: string | null;
  color: string | null;
  /**
   * Figures the source took from a secondary source (older, less trusted): they rank below the wiki infobox on a
   * new nation and never change an existing one.
   */
  secondary: SourceFigureField[];
}

export interface SourceOrganization {
  key: string;
  name: string;
  shortName: string | null;
  color: string | null;
  /** Nation keys, as the source lists them (unknown keys are reported, not guessed). */
  members: string[];
  /** The alliance type the realm's name rules give. Staff overrides win over it. */
  suggestedType: AllianceType;
}

export interface SourceFeature {
  key: string;
  geometry: Polygon | MultiPolygon;
  /** The source's own measured area in km², when it has one. */
  areaKm2: number | null;
}

export interface SourceSnapshot {
  nations: SourceNation[];
  organizations: SourceOrganization[];
  features: SourceFeature[];
  /** Entries skipped while reading (bad values, duplicates), for the run summary. */
  warnings: string[];
}

export interface SourceFile {
  /** What the adapter calls the file ("nations", "organizations", "borders"). */
  role: string;
  path: string;
  required: boolean;
}

/** What every adapter's settings share: the attribution line and the wiki the nations' pages live on. */
export interface CommonSourceSettings {
  attribution?: string;
  wikiSource?: string;
}

export interface SourceAdapter<S extends CommonSourceSettings = CommonSourceSettings> {
  id: string;
  label: string;
  settingsSchema: z.ZodType<S>;
  files(settings: S): SourceFile[];
  /** File text by role; an optional file that is missing is null. Throws on a malformed required file. */
  parse(files: Record<string, string | null>, settings: S): SourceSnapshot;
}
