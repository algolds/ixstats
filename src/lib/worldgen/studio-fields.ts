/**
 * World Studio's parameter rail as data: every `WorldGenParams` field (but the seed, which has a control of its own)
 * in the group of the stage that reads it, with its range, step, label and readout. Ranges are the bounds of the zod
 * schema in `world-bundle.ts`; a test pins the two together, so a bound that moves there cannot drift here.
 */

import { DEFAULT_PARAMS } from "./v2/config";
import type { DevelopmentLevel, WorldGenParams, WorldPresetParams } from "./v2/types";

/** What the rail edits: the generator's parameters without the seed. */
export type StudioParams = Omit<WorldGenParams, "seed">;
export type StudioKey = keyof StudioParams;

type StudioGroupId = "mesh" | "land" | "climate" | "nations" | "output";

export interface StudioGroup {
  id: StudioGroupId;
  label: string;
  fields: readonly StudioKey[];
  /** Open when the Studio first shows */
  open: boolean;
}

/** The spec's table: a field belongs to the group of the first stage that reads it. */
export const STUDIO_GROUPS: readonly StudioGroup[] = [
  { id: "mesh", label: "Mesh", fields: ["cellCount", "lloydIterations"], open: true },
  {
    id: "land",
    label: "Land",
    fields: [
      "plateCount",
      "oceanPercentage",
      "continentCount",
      "continentLatitudeRange",
      "continentSizeVariance",
      "islandShare",
      "polarLand",
      "terrainRoughness",
      "coastlineComplexity",
      "hypsometry",
    ],
    open: true,
  },
  {
    id: "climate",
    label: "Climate",
    fields: [
      "temperatureOffset",
      "precipitationScale",
      "riverDensity",
      "lakeCoverage",
      "hasRivers",
      "hasLakes",
    ],
    open: false,
  },
  {
    id: "nations",
    label: "Nations",
    fields: ["countryCountRange", "useMarkovNaming", "developmentLevel"],
    open: false,
  },
  { id: "output", label: "Output", fields: ["hasIcecaps"], open: false },
];

interface NumberRange {
  min: number;
  max: number;
  step: number;
}

/** The bounds of every numeric parameter (and of each end of a range pair). */
export const PARAM_RANGES = {
  cellCount: { min: 1000, max: 150000, step: 1000 },
  lloydIterations: { min: 0, max: 5, step: 1 },
  plateCount: { min: 3, max: 30, step: 1 },
  oceanPercentage: { min: 0.2, max: 0.95, step: 0.01 },
  continentCount: { min: 1, max: 12, step: 1 },
  continentLatitudeRange: { min: -90, max: 90, step: 5 },
  continentSizeVariance: { min: 0, max: 2, step: 0.05 },
  islandShare: { min: 0, max: 0.5, step: 0.01 },
  terrainRoughness: { min: 0, max: 1, step: 0.05 },
  coastlineComplexity: { min: 0, max: 1, step: 0.05 },
  temperatureOffset: { min: -20, max: 20, step: 0.5 },
  precipitationScale: { min: 0.1, max: 5, step: 0.05 },
  riverDensity: { min: 0, max: 5, step: 0.1 },
  lakeCoverage: { min: 0, max: 0.1, step: 0.001 },
  countryCountRange: { min: 1, max: 500, step: 1 },
} as const satisfies Partial<Record<StudioKey, NumberRange>>;

type SliderKey = Exclude<keyof typeof PARAM_RANGES, "continentLatitudeRange" | "countryCountRange">;
type RangeKey = "continentLatitudeRange" | "countryCountRange";
type SwitchKey = "hasRivers" | "hasLakes" | "useMarkovNaming" | "hasIcecaps";

export const DEVELOPMENT_LEVELS: ReadonlyArray<{ value: DevelopmentLevel; label: string }> = [
  { value: "developing", label: "Developing" },
  { value: "industrial", label: "Industrial" },
  { value: "modern", label: "Modern" },
];

export type FieldSpec =
  | {
      kind: "slider";
      key: SliderKey;
      label: string;
      format: (value: number) => string;
      ends?: readonly [string, string];
      /** The realm's own map decides it, so a world fitted to that map ignores it */
      fromMap?: boolean;
    }
  | {
      kind: "range";
      key: RangeKey;
      label: string;
      /** Names of the two ends */
      ends: readonly [string, string];
      format: (value: number) => string;
      fromMap?: boolean;
    }
  | { kind: "switch"; key: SwitchKey; label: string }
  | { kind: "polar"; key: "polarLand"; label: string; fromMap?: boolean }
  | { kind: "hypsometry"; key: "hypsometry"; label: string }
  | { kind: "choice"; key: "developmentLevel"; label: string };

const whole = (value: number) => Math.round(value).toLocaleString("en-US");
const percent = (digits: number) => (value: number) => `${(value * 100).toFixed(digits)}%`;
const fixed =
  (digits: number, unit = "") =>
  (value: number) =>
    `${value.toFixed(digits)}${unit}`;
const signedDegrees = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)} °C`;
const latitude = (value: number) => `${Math.abs(value)}°${value < 0 ? "S" : "N"}`;

export const STUDIO_FIELDS: Record<StudioKey, FieldSpec> = {
  cellCount: { kind: "slider", key: "cellCount", label: "Cells", format: whole },
  lloydIterations: {
    kind: "slider",
    key: "lloydIterations",
    label: "Relaxation passes",
    format: whole,
  },
  plateCount: { kind: "slider", key: "plateCount", label: "Tectonic plates", format: whole },
  oceanPercentage: {
    kind: "slider",
    key: "oceanPercentage",
    label: "Ocean",
    format: percent(0),
    fromMap: true,
  },
  continentCount: {
    kind: "slider",
    key: "continentCount",
    label: "Continents",
    format: whole,
    fromMap: true,
  },
  continentLatitudeRange: {
    kind: "range",
    key: "continentLatitudeRange",
    label: "Continent latitudes",
    ends: ["Southern edge", "Northern edge"],
    format: latitude,
    fromMap: true,
  },
  continentSizeVariance: {
    kind: "slider",
    key: "continentSizeVariance",
    label: "Size spread",
    format: fixed(2),
    ends: ["Equal", "A few dominate"],
    fromMap: true,
  },
  islandShare: {
    kind: "slider",
    key: "islandShare",
    label: "Islands",
    format: percent(0),
    fromMap: true,
  },
  polarLand: { kind: "polar", key: "polarLand", label: "Polar land", fromMap: true },
  terrainRoughness: {
    kind: "slider",
    key: "terrainRoughness",
    label: "Terrain roughness",
    format: percent(0),
    ends: ["Gentle", "Rugged"],
  },
  coastlineComplexity: {
    kind: "slider",
    key: "coastlineComplexity",
    label: "Coast complexity",
    format: percent(0),
    ends: ["Smooth", "Ragged"],
    fromMap: true,
  },
  hypsometry: { kind: "hypsometry", key: "hypsometry", label: "Hypsometry" },
  temperatureOffset: {
    kind: "slider",
    key: "temperatureOffset",
    label: "Temperature",
    format: signedDegrees,
  },
  precipitationScale: {
    kind: "slider",
    key: "precipitationScale",
    label: "Rainfall",
    format: fixed(2, "×"),
  },
  riverDensity: {
    kind: "slider",
    key: "riverDensity",
    label: "River density",
    format: (value) => (value === 0 ? "None" : fixed(1, "×")(value)),
  },
  lakeCoverage: {
    kind: "slider",
    key: "lakeCoverage",
    label: "Lake coverage",
    format: (value) => (value === 0 ? "None" : percent(1)(value)),
  },
  hasRivers: { kind: "switch", key: "hasRivers", label: "Rivers" },
  hasLakes: { kind: "switch", key: "hasLakes", label: "Lakes" },
  countryCountRange: {
    kind: "range",
    key: "countryCountRange",
    label: "Nations",
    ends: ["Fewest", "Most"],
    format: whole,
    fromMap: true,
  },
  useMarkovNaming: { kind: "switch", key: "useMarkovNaming", label: "Generated names" },
  developmentLevel: { kind: "choice", key: "developmentLevel", label: "Development level" },
  hasIcecaps: { kind: "switch", key: "hasIcecaps", label: "Ice caps" },
};

/** The generator's parameters for `preset`: the defaults, with the preset's own values over them. */
export function paramsForPreset(preset: WorldPresetParams): StudioParams {
  const { seed: _seed, ...defaults } = DEFAULT_PARAMS;
  return cloneParams({ ...defaults, ...preset });
}

/** A copy that shares no array or object with `params` (the generator and the rail each keep their own). */
export function cloneParams(params: StudioParams): StudioParams {
  return {
    ...params,
    continentLatitudeRange: [...params.continentLatitudeRange],
    countryCountRange: [...params.countryCountRange],
    polarLand: { ...params.polarLand },
    hypsometry: [...params.hypsometry],
  };
}

/** Whether two values of a parameter are the same (arrays and the polar pair by content). */
export function sameValue(a: StudioParams[StudioKey], b: StudioParams[StudioKey]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Whether `patch` changes nothing in `params`. */
export function isNoChange(params: StudioParams, patch: Partial<StudioParams>): boolean {
  return Object.entries(patch).every(([key, value]) => sameValue(params[key as StudioKey], value));
}

/** A patch of one parameter. */
export function patchOf<K extends StudioKey>(
  key: K,
  value: StudioParams[K]
): Partial<StudioParams> {
  return { [key]: value } as Partial<StudioParams>;
}

/** The values `keys` have in `base`, as a patch. */
export function pickParams(base: StudioParams, keys: readonly StudioKey[]): Partial<StudioParams> {
  const copy = cloneParams(base);
  return Object.fromEntries(keys.map((key) => [key, copy[key]]));
}

/** The hypsometry's total; the generator normalises it, so it need not be 100 but must not be 0. */
export const hypsometrySum = (shares: readonly number[]): number =>
  shares.reduce((total, share) => total + share, 0);
