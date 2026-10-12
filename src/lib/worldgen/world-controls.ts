/**
 * The World tab's controls and what they ask of the generator.
 *
 * A control set is the whole recipe except the seed: every slider, switch and segment, with the values the chosen
 * preset gives them until the founder moves one. `paramsFromControls` turns a set into the `WorldGenParams` the
 * worker merges over the generator's defaults; the parameters no control names (cell count, plate count, roughness,
 * ice caps) stay at those defaults. Pure, so it is shared by the panel, the draft recipe and the tests.
 */

import { DEFAULT_PARAMS, WORLD_PRESETS, type WorldPreset } from "./v2/config";
import type { DevelopmentLevel, WorldGenParams } from "./v2/types";

export type WorldSource = "preset" | "realm-map";

export interface WorldControls {
  source: WorldSource;
  /** The preset the values started from; with the "preset" source, the world it stands for */
  preset: WorldPreset;
  continents: number;
  /** Share of the surface that is land (0-1) */
  landShare: number;
  /** Target number of nations */
  nations: number;
  /** Shift of the global temperature, in degrees C */
  temperature: number;
  /** Multiplier of the global rainfall */
  rainfall: number;
  developmentLevel: DevelopmentLevel;
  /** Where continents are centred: [south, north] in degrees of latitude, in either order */
  latitudeBand: [number, number];
  /** How unequal continent sizes are (0 = equal) */
  sizeSpread: number;
  /** Share of the land budget placed as islands and archipelagos */
  islands: number;
  polarNorth: boolean;
  polarSouth: boolean;
  /** The elevation profile of the land: one of the presets' */
  hypsometry: WorldPreset;
  /** River density (0 = no rivers) */
  rivers: number;
  /** Lake surface as a share of land (0 = no lakes) */
  lakes: number;
  coastComplexity: number;
}

export const WORLD_PRESET_IDS = [
  "earthlike",
  "ixnay",
  "eurth",
] as const satisfies readonly WorldPreset[];

interface Limit {
  min: number;
  max: number;
  step: number;
}

/** The slider bounds; each sits inside what a world bundle accepts (`worldGenParamsSchema`). */
export const CONTROL_LIMITS = {
  continents: { min: 1, max: 12, step: 1 },
  landShare: { min: 0.15, max: 0.6, step: 0.01 },
  nations: { min: 5, max: 300, step: 5 },
  temperature: { min: -10, max: 10, step: 0.5 },
  rainfall: { min: 0.4, max: 2.5, step: 0.05 },
  latitude: { min: -80, max: 80, step: 5 },
  sizeSpread: { min: 0, max: 1.5, step: 0.05 },
  islands: { min: 0, max: 0.3, step: 0.01 },
  rivers: { min: 0, max: 2.5, step: 0.1 },
  lakes: { min: 0, max: 0.05, step: 0.001 },
  coastComplexity: { min: 0, max: 1, step: 0.05 },
} as const satisfies Record<string, Limit>;

const clampTo = ({ min, max }: Limit, value: number, fallback: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** The values a preset gives the controls (the generator's defaults where the preset says nothing). */
export function controlsForPreset(preset: WorldPreset): WorldControls {
  const params: WorldGenParams = { ...DEFAULT_PARAMS, ...WORLD_PRESETS[preset] };
  const [fewest, most] = params.countryCountRange;
  return {
    source: "preset",
    preset,
    continents: params.continentCount,
    landShare: 1 - params.oceanPercentage,
    nations: Math.round((fewest + most) / 2),
    temperature: params.temperatureOffset,
    rainfall: params.precipitationScale,
    developmentLevel: params.developmentLevel,
    latitudeBand: [...params.continentLatitudeRange],
    sizeSpread: params.continentSizeVariance,
    islands: params.islandShare,
    polarNorth: params.polarLand.north,
    polarSouth: params.polarLand.south,
    hypsometry: preset,
    rivers: params.hasRivers ? params.riverDensity : 0,
    lakes: params.hasLakes ? params.lakeCoverage : 0,
    coastComplexity: params.coastlineComplexity,
  };
}

const EARTHLIKE = controlsForPreset("earthlike");

/** The controls with every number inside its limit (a stored recipe may hold anything). */
export function clampControls(controls: WorldControls): WorldControls {
  const { continents, landShare, nations, temperature, rainfall, latitude } = CONTROL_LIMITS;
  const { sizeSpread, islands, rivers, lakes, coastComplexity } = CONTROL_LIMITS;
  return {
    ...controls,
    continents: Math.round(clampTo(continents, controls.continents, EARTHLIKE.continents)),
    landShare: clampTo(landShare, controls.landShare, EARTHLIKE.landShare),
    nations: Math.round(clampTo(nations, controls.nations, EARTHLIKE.nations)),
    temperature: clampTo(temperature, controls.temperature, EARTHLIKE.temperature),
    rainfall: clampTo(rainfall, controls.rainfall, EARTHLIKE.rainfall),
    latitudeBand: [
      clampTo(latitude, controls.latitudeBand[0], EARTHLIKE.latitudeBand[0]),
      clampTo(latitude, controls.latitudeBand[1], EARTHLIKE.latitudeBand[1]),
    ],
    sizeSpread: clampTo(sizeSpread, controls.sizeSpread, EARTHLIKE.sizeSpread),
    islands: clampTo(islands, controls.islands, EARTHLIKE.islands),
    rivers: clampTo(rivers, controls.rivers, EARTHLIKE.rivers),
    lakes: clampTo(lakes, controls.lakes, EARTHLIKE.lakes),
    coastComplexity: clampTo(coastComplexity, controls.coastComplexity, EARTHLIKE.coastComplexity),
  };
}

/** The generator parameters the controls ask for. */
export function paramsFromControls(controls: WorldControls): Partial<WorldGenParams> {
  const [a, b] = controls.latitudeBand;
  return {
    continentCount: controls.continents,
    continentLatitudeRange: [Math.min(a, b), Math.max(a, b)],
    continentSizeVariance: controls.sizeSpread,
    islandShare: controls.islands,
    polarLand: { north: controls.polarNorth, south: controls.polarSouth },
    countryCountRange: [controls.nations, controls.nations],
    // Rounded so a share typed as 22.9% asks for 0.771, not 0.7709999999999999
    oceanPercentage: Math.round((1 - controls.landShare) * 1000) / 1000,
    coastlineComplexity: controls.coastComplexity,
    hypsometry: [...hypsometryOf(controls.hypsometry)],
    temperatureOffset: controls.temperature,
    precipitationScale: controls.rainfall,
    riverDensity: controls.rivers,
    hasRivers: controls.rivers > 0,
    lakeCoverage: controls.lakes,
    hasLakes: controls.lakes > 0,
    developmentLevel: controls.developmentLevel,
  };
}

/** The share of land in each of the nine elevation zones, for an elevation profile. */
function hypsometryOf(profile: WorldPreset): readonly number[] {
  return { ...DEFAULT_PARAMS, ...WORLD_PRESETS[profile] }.hypsometry;
}

const CONTROL_NAMES = [
  "continents",
  "landShare",
  "nations",
  "temperature",
  "rainfall",
  "developmentLevel",
  "latitudeBand",
  "sizeSpread",
  "islands",
  "polar",
  "hypsometry",
  "rivers",
  "lakes",
  "coastComplexity",
] as const;

export type ControlName = (typeof CONTROL_NAMES)[number];

/** Controls the realm's own map makes pointless: it decides the land, its shape and its borders. */
const FROM_REALM_MAP: readonly ControlName[] = [
  "continents",
  "landShare",
  "nations",
  "latitudeBand",
  "sizeSpread",
  "islands",
  "polar",
  "coastComplexity",
];

/** Which controls act on a world built from `source`. */
export function controlAvailability(source: WorldSource): Record<ControlName, boolean> {
  return Object.fromEntries(
    CONTROL_NAMES.map((name) => [name, source === "preset" || !FROM_REALM_MAP.includes(name)])
  ) as Record<ControlName, boolean>;
}

/** A seed for a reroll: a whole number from 1 to 2^31 - 1. `random` is `Math.random` unless a test passes one. */
export function newWorldSeed(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * (2 ** 31 - 1));
}
