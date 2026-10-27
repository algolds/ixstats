/**
 * The "eurth-map" layout: a community map repository with
 *   - a JavaScript nation table (`const <binding> = { <key>: { <field>: value, … }, … }`),
 *   - optionally a JavaScript organisation list (`export const <binding> = [ { id, name, color, members }, … ]`),
 *   - optionally a GeoJSON FeatureCollection of nation borders (lon/lat), each feature naming its nation key.
 * Which files, which bindings and which field holds what are all the realm's settings (a preset fills them).
 * The JavaScript files are read with the literal-only reader, never evaluated.
 */
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { z } from "zod";
import { ALLIANCE_TYPES, repoPathSchema, sourceKeySchema, type AllianceType } from "../config";
import { isLiteralObject, readBoundLiteral, type LiteralValue } from "../js-literal";
import type {
  SourceAdapter,
  SourceFeature,
  SourceFigureField,
  SourceNation,
  SourceOrganization,
  SourceSnapshot,
} from "./types";

const fieldName = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z_$][\w$-]*$/, "A field name: letters, digits, _ $ -");
const bindingName = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z_$][\w$]*$/, "A JavaScript identifier");

export const jsNationTableSettingsSchema = z.object({
  files: z.object({
    nations: repoPathSchema,
    organizations: repoPathSchema.optional(),
    borders: repoPathSchema.optional(),
  }),
  bindings: z.object({
    nations: bindingName,
    organizations: bindingName.optional(),
  }),
  /** Which field of a nation entry holds each value; a field left out is not read. */
  nationFields: z.object({
    officialName: fieldName.optional(),
    population: fieldName.optional(),
    gdpPerCapita: fieldName.optional(),
    landArea: fieldName.optional(),
    capital: fieldName.optional(),
    wikiLink: fieldName.optional(),
    color: fieldName.optional(),
    /** The entry's list of field names whose values came from a less-trusted secondary source. */
    secondaryFields: fieldName.optional(),
  }),
  organizationFields: z
    .object({
      key: fieldName,
      name: fieldName,
      color: fieldName.optional(),
      members: fieldName,
    })
    .optional(),
  featureFields: z
    .object({
      /** The property holding the nation key; the feature's own `id` when left out. */
      key: fieldName.optional(),
      area: fieldName.optional(),
    })
    .optional(),
  /** "Full Name (ACR)": take ACR as the alliance's short name and drop it from the name. */
  acronymInName: z.boolean().optional(),
  /** First rule whose keyword appears in an organisation's name (whole word, any case) gives its type. */
  allianceTypeRules: z
    .array(
      z.object({
        keywords: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
        type: z.enum(ALLIANCE_TYPES),
      })
    )
    .max(20)
    .optional(),
  defaultAllianceType: z.enum(ALLIANCE_TYPES).optional(),
  /** The wiki the nations' pages live on (a WikiOS source id) and the URL prefixes of its page links. */
  wikiSource: z.string().trim().min(1).max(40).optional(),
  wikiLinkPrefixes: z.array(z.string().trim().url().max(200)).max(10).optional(),
  attribution: z.string().trim().max(300).optional(),
});
export type JsNationTableSettings = z.infer<typeof jsNationTableSettingsSchema>;

const MAX = { population: 20_000_000_000, gdpPerCapita: 10_000_000, landArea: 200_000_000 };
const MAX_TEXT = 200;
const MAX_FEATURES = 5000;

function text(value: LiteralValue | undefined): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, MAX_TEXT) : null;
}

function colour(value: LiteralValue | undefined): string | null {
  return typeof value === "string" && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}

/** The page title a wiki link names, when it starts with one of the realm wiki's prefixes. */
export function wikiTitleFromLink(link: string | null, prefixes: readonly string[]): string | null {
  if (!link) return null;
  const prefix = prefixes.find((p) => link.startsWith(p));
  if (!prefix) return null;
  const raw = link.slice(prefix.length).split(/[?#]/)[0] ?? "";
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // keep the raw title: a stray % is part of the name
  }
  const title = decoded.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return title && title.length <= 255 && !title.includes("/../") ? title : null;
}

const FIGURE_FIELDS: readonly SourceFigureField[] = [
  "officialName",
  "population",
  "gdpPerCapita",
  "landArea",
  "capital",
];

/** The figures an entry's secondary-field list names, read back through the settings' field names ("gdppc" → gdpPerCapita). */
function secondaryFigures(
  list: LiteralValue | undefined,
  fields: JsNationTableSettings["nationFields"]
): SourceFigureField[] {
  if (!Array.isArray(list)) return [];
  const named = new Set(list.filter((v): v is string => typeof v === "string"));
  return FIGURE_FIELDS.filter((figure) => {
    const sourceField = fields[figure];
    return sourceField !== undefined && named.has(sourceField);
  });
}

/** "Bainbridge-Islands" → "Bainbridge Islands". */
export const readableKey = (key: string) => key.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The type the realm's rules give an organisation's name. */
export function allianceTypeFor(
  name: string,
  rules: JsNationTableSettings["allianceTypeRules"] = [],
  fallback: AllianceType = "political"
): AllianceType {
  for (const rule of rules) {
    if (rule.keywords.some((k) => new RegExp(`\\b${escapeRegExp(k)}\\b`, "i").test(name)))
      return rule.type;
  }
  return fallback;
}

/** "Aurelian League (AL)" → name "Aurelian League", short name "AL". */
export function splitAcronym(name: string): { name: string; shortName: string | null } {
  const match = /^(.*\S)\s*\(([A-Za-z0-9&.\- ]{1,10})\)$/.exec(name.trim());
  return match ? { name: match[1]!, shortName: match[2]!.trim() } : { name, shortName: null };
}

function readNations(
  table: LiteralValue,
  settings: JsNationTableSettings,
  warnings: string[]
): SourceNation[] {
  if (!isLiteralObject(table)) throw new Error("The nation table is not an object of nations");
  const f = settings.nationFields;
  const prefixes = settings.wikiLinkPrefixes ?? [];
  const nations: SourceNation[] = [];
  const number = (key: string, field: keyof typeof MAX, value: LiteralValue | undefined) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX[field]) {
      warnings.push(`${key}: ${field} ${JSON.stringify(value)} is not a usable figure; ignored`);
      return null;
    }
    return value;
  };
  for (const [key, entry] of Object.entries(table)) {
    if (!sourceKeySchema.safeParse(key).success || !isLiteralObject(entry)) {
      warnings.push(`Nation "${key.slice(0, 60)}" skipped: not a nation entry`);
      continue;
    }
    const pick = (field: string | undefined) => (field ? entry[field] : undefined);
    const wikiTitle = wikiTitleFromLink(text(pick(f.wikiLink)), prefixes);
    nations.push({
      key,
      displayName: wikiTitle ?? readableKey(key),
      wikiTitle,
      officialName: text(pick(f.officialName)),
      population: number(key, "population", pick(f.population)),
      gdpPerCapita: number(key, "gdpPerCapita", pick(f.gdpPerCapita)),
      landArea: number(key, "landArea", pick(f.landArea)),
      capital: text(pick(f.capital)),
      color: colour(pick(f.color)),
      secondary: secondaryFigures(pick(f.secondaryFields), f),
    });
  }
  return nations;
}

function readOrganizations(
  list: LiteralValue,
  settings: JsNationTableSettings,
  warnings: string[]
): SourceOrganization[] {
  const f = settings.organizationFields;
  if (!f) return [];
  if (!Array.isArray(list)) throw new Error("The organisation list is not an array");
  const seen = new Set<string>();
  const organizations: SourceOrganization[] = [];
  for (const entry of list) {
    if (!isLiteralObject(entry)) continue;
    const key = text(entry[f.key]);
    const fullName = text(entry[f.name]);
    if (!key || !fullName || !sourceKeySchema.safeParse(key).success || seen.has(key)) {
      warnings.push(
        `Organisation ${JSON.stringify(key ?? fullName ?? "?")} skipped: no id or name, or a repeat`
      );
      continue;
    }
    seen.add(key);
    const members = entry[f.members];
    const { name, shortName } = settings.acronymInName
      ? splitAcronym(fullName)
      : { name: fullName, shortName: null };
    organizations.push({
      key,
      name: name.slice(0, 100),
      shortName,
      color: colour(f.color ? entry[f.color] : undefined),
      members: Array.isArray(members)
        ? [...new Set(members.filter((m): m is string => typeof m === "string"))]
        : [],
      suggestedType: allianceTypeFor(
        fullName,
        settings.allianceTypeRules,
        settings.defaultAllianceType
      ),
    });
  }
  return organizations;
}

function validRing(ring: unknown): ring is Position[] {
  return (
    Array.isArray(ring) &&
    ring.length >= 4 &&
    ring.every(
      (p) =>
        Array.isArray(p) &&
        p.length >= 2 &&
        typeof p[0] === "number" &&
        typeof p[1] === "number" &&
        Math.abs(p[0]) <= 180 &&
        Math.abs(p[1]) <= 90
    )
  );
}

function validGeometry(geometry: unknown): geometry is Polygon | MultiPolygon {
  const g = geometry as { type?: unknown; coordinates?: unknown } | null;
  if (!g || !Array.isArray(g.coordinates)) return false;
  if (g.type === "Polygon") return g.coordinates.length > 0 && g.coordinates.every(validRing);
  if (g.type === "MultiPolygon")
    return (
      g.coordinates.length > 0 &&
      g.coordinates.every((poly) => Array.isArray(poly) && poly.length > 0 && poly.every(validRing))
    );
  return false;
}

function readFeatures(
  json: string,
  settings: JsNationTableSettings,
  warnings: string[]
): SourceFeature[] {
  const collection = JSON.parse(json) as { type?: string; features?: unknown };
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features))
    throw new Error("The borders file is not a GeoJSON FeatureCollection");
  if (collection.features.length > MAX_FEATURES)
    throw new Error(`The borders file has more than ${MAX_FEATURES} features`);
  const keyField = settings.featureFields?.key;
  const areaField = settings.featureFields?.area;
  const seen = new Set<string>();
  const features: SourceFeature[] = [];
  for (const raw of collection.features as Feature[]) {
    const properties = (raw?.properties ?? {}) as Record<string, unknown>;
    const rawKey = keyField ? properties[keyField] : raw?.id;
    const key = typeof rawKey === "string" || typeof rawKey === "number" ? String(rawKey) : "";
    if (!sourceKeySchema.safeParse(key).success || seen.has(key)) {
      warnings.push(`Border feature ${JSON.stringify(key)} skipped: no key, or a repeat`);
      continue;
    }
    if (!validGeometry(raw.geometry)) {
      warnings.push(`Border feature ${key} skipped: not a lon/lat Polygon or MultiPolygon`);
      continue;
    }
    seen.add(key);
    const area = areaField ? properties[areaField] : undefined;
    features.push({
      key,
      geometry: raw.geometry,
      areaKm2: typeof area === "number" && Number.isFinite(area) && area > 0 ? area : null,
    });
  }
  return features;
}

export const jsNationTableAdapter: SourceAdapter<JsNationTableSettings> = {
  id: "eurth-map",
  label: "JavaScript nation table, organisations and GeoJSON borders (the eurth-map layout)",
  settingsSchema: jsNationTableSettingsSchema,
  files(settings) {
    return [
      { role: "nations", path: settings.files.nations, required: true },
      ...(settings.files.organizations && settings.bindings.organizations
        ? [{ role: "organizations", path: settings.files.organizations, required: false }]
        : []),
      ...(settings.files.borders
        ? [{ role: "borders", path: settings.files.borders, required: false }]
        : []),
    ];
  },
  parse(files, settings): SourceSnapshot {
    const warnings: string[] = [];
    const nationsText = files.nations;
    if (!nationsText) throw new Error("The nation table could not be read");
    const nations = readNations(
      readBoundLiteral(nationsText, settings.bindings.nations),
      settings,
      warnings
    );
    const organizations =
      files.organizations && settings.bindings.organizations
        ? readOrganizations(
            readBoundLiteral(files.organizations, settings.bindings.organizations),
            settings,
            warnings
          )
        : [];
    const features = files.borders ? readFeatures(files.borders, settings, warnings) : [];
    return { nations, organizations, features, warnings };
  },
};
