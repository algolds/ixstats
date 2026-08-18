/**
 * Global Developer Configuration Registry 
 *
 *
 * Usage:
 *   import { IX_CONFIG, getGlobalConfig } from "~/lib/config";
 *   const mapCenter = IX_CONFIG.maps.defaultCenter;
 *   const cardCap = IX_CONFIG.cards.maxInventoryCards;
 */

import { VERSIONS, APP_VERSION, CHANNEL, RELEASE_NAME, BUILD_VERSION } from "./buildVersion";
import { GAMEPLAY_FLAGS } from "./gameplay-flags";
import { CARD_GENERAL_DEFAULTS, type CardGeneralSettings } from "./cards/general-settings";
import { EXCHANGE_CONFIG_DEFAULTS, type ExchangeConfig } from "./vault/exchange-config";
import { MAP_LAYER_TYPES, DEMOTED_COUNTRY_NAMES, LAYER_CONFIGS } from "./maps/map-config";
import { ELEVATION_ZONES } from "./maps/elevation-config";
import { DEFAULT_PARAMS as UPG_DEFAULT_PARAMS } from "./worldgen/v2/config";
import { SPORT_PRESETS, type SportPresetKey } from "./sports/presets";
import { SPORTS_NOTIFY_KEYS, type SportsNotifyConfig } from "./sports/notify-config";
import { BRANCH_CONFIGS } from "./military/config";
import { MEDIAWIKI_CONFIG, DEFAULT_USER_AGENT } from "./wiki/config";
import { memoryConfig } from "./system/dev-memory-config";

// ──────────────────────────────────────────────
// Subsystem Config Interfaces
// ──────────────────────────────────────────────

export interface PlatformConfig {
  appVersion: string;
  channel: string;
  releaseName: string;
  buildVersion: string;
  versions: typeof VERSIONS;
  epochOrigin: string;
  defaultTickMultiplier: number;
}

export interface FeaturesConfig {
  flags: typeof GAMEPLAY_FLAGS;
}

export interface MapsConfig {
  layerTypes: typeof MAP_LAYER_TYPES;
  layerConfigs: typeof LAYER_CONFIGS;
  elevationZones: typeof ELEVATION_ZONES;
  demotedCountries: typeof DEMOTED_COUNTRY_NAMES;
  defaultCenter: [number, number];
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
}

export interface WorldGenConfig {
  defaultParams: typeof UPG_DEFAULT_PARAMS;
  meshResolution: number;
  lloydIterations: number;
  maxElevationZone: number;
  coastalDampingDistance: number;
}

export interface CardsConfig extends CardGeneralSettings {
  defaults: CardGeneralSettings;
}

export interface VaultConfig extends ExchangeConfig {
  defaults: ExchangeConfig;
}

export interface SportsConfig {
  presets: typeof SPORT_PRESETS;
  defaultRatingVector: {
    overall: number;
    offense: number;
    defense: number;
    form: number;
    depth: number;
    coaching: number;
  };
  notifyDefaults: SportsNotifyConfig;
  notifyKeys: typeof SPORTS_NOTIFY_KEYS;
  availablePresetKeys: SportPresetKey[];
}

export interface MilitaryConfig {
  branches: typeof BRANCH_CONFIGS;
  upkeepBudgetFraction: number;
  readinessThresholds: {
    combatReady: number;
    peacetimeStandard: number;
    standDown: number;
  };
}

export interface StatecraftConfig {
  civCapBase: number;
  reconIntervalDays: number;
  stabilityResolutionPeriodHours: number;
  powerBrokerInfluenceThreshold: number;
}

export interface NationalIssuesConfig {
  maxIssuesPerSession: number;
  maxIssuesPerWeek: number;
  spawnMode: "probability" | "deterministic" | "off";
  decayHours: number;
}

export interface WikiConfig {
  userAgent: string;
  requestTimeoutMs: number;
  cacheTtlMs: typeof MEDIAWIKI_CONFIG.cache;
}

export interface SystemConfig {
  memory: typeof memoryConfig;
  safeHeapBoundMb: number;
  userLogDirectory: string;
  defaultRateLimitPerMin: number;
}

export interface GlobalConfigRegistry {
  platform: PlatformConfig;
  features: FeaturesConfig;
  maps: MapsConfig;
  worldgen: WorldGenConfig;
  cards: CardsConfig;
  vault: VaultConfig;
  sports: SportsConfig;
  military: MilitaryConfig;
  statecraft: StatecraftConfig;
  nationalIssues: NationalIssuesConfig;
  wiki: WikiConfig;
  system: SystemConfig;
}

// ──────────────────────────────────────────────
// Canonical Global Configuration Registry
// ──────────────────────────────────────────────

export const IX_CONFIG = {
  platform: {
    appVersion: APP_VERSION,
    channel: CHANNEL,
    releaseName: RELEASE_NAME,
    buildVersion: BUILD_VERSION,
    versions: VERSIONS,
    epochOrigin: "2026-01-01T00:00:00.000Z",
    defaultTickMultiplier: 1.0,
  },

  features: {
    flags: GAMEPLAY_FLAGS,
  },

  maps: {
    layerTypes: MAP_LAYER_TYPES,
    layerConfigs: LAYER_CONFIGS,
    elevationZones: ELEVATION_ZONES,
    demotedCountries: DEMOTED_COUNTRY_NAMES,
    defaultCenter: [0, 20],
    defaultZoom: 2.5,
    minZoom: 1,
    maxZoom: 18,
  },

  worldgen: {
    defaultParams: UPG_DEFAULT_PARAMS,
    meshResolution: 100_000,
    lloydIterations: 5,
    maxElevationZone: 8,
    coastalDampingDistance: 3,
  },

  cards: {
    ...CARD_GENERAL_DEFAULTS,
    defaults: CARD_GENERAL_DEFAULTS,
  },

  vault: {
    ...EXCHANGE_CONFIG_DEFAULTS,
    defaults: EXCHANGE_CONFIG_DEFAULTS,
  },

  sports: {
    presets: SPORT_PRESETS,
    defaultRatingVector: {
      overall: 50,
      offense: 50,
      defense: 50,
      form: 50,
      depth: 50,
      coaching: 50,
    },
    notifyDefaults: {
      matchdayBulletins: true,
      llmNarration: true,
      seasonBulletins: true,
      clubDms: true,
      discordMirror: true,
    },
    notifyKeys: SPORTS_NOTIFY_KEYS,
    availablePresetKeys: ["soccer", "football", "hockey", "basketball", "baseball", "f1", "boxing"],
  },

  military: {
    branches: BRANCH_CONFIGS,
    upkeepBudgetFraction: 0.15,
    readinessThresholds: {
      combatReady: 85,
      peacetimeStandard: 60,
      standDown: 30,
    },
  },

  statecraft: {
    civCapBase: 100,
    reconIntervalDays: 7,
    stabilityResolutionPeriodHours: 48,
    powerBrokerInfluenceThreshold: 60,
  },

  nationalIssues: {
    maxIssuesPerSession: 3,
    maxIssuesPerWeek: 5,
    spawnMode: "probability",
    decayHours: 168, // 7 days
  },

  wiki: {
    userAgent: DEFAULT_USER_AGENT,
    requestTimeoutMs: MEDIAWIKI_CONFIG.timeout,
    cacheTtlMs: MEDIAWIKI_CONFIG.cache,
  },

  system: {
    memory: memoryConfig,
    safeHeapBoundMb: 6144,
    userLogDirectory: "logs/users",
    defaultRateLimitPerMin: 120,
  },
} as const satisfies GlobalConfigRegistry;

/** Alias for IX_CONFIG */
export const GLOBAL_CONFIG = IX_CONFIG;

/**
 * Access a specific domain from the global configuration registry with full type safety.
 */
export function getGlobalConfig<K extends keyof GlobalConfigRegistry>(
  domain: K
): GlobalConfigRegistry[K] {
  return IX_CONFIG[domain];
}

// ──────────────────────────────────────────────
// Direct Re-exports for Convenience
// ──────────────────────────────────────────────

export {
  APP_VERSION,
  CHANNEL,
  RELEASE_NAME,
  BUILD_VERSION,
  VERSIONS,
  GAMEPLAY_FLAGS,
  CARD_GENERAL_DEFAULTS,
  EXCHANGE_CONFIG_DEFAULTS,
  MAP_LAYER_TYPES,
  DEMOTED_COUNTRY_NAMES,
  LAYER_CONFIGS,
  ELEVATION_ZONES,
  SPORT_PRESETS,
  SPORTS_NOTIFY_KEYS,
  BRANCH_CONFIGS,
  MEDIAWIKI_CONFIG,
  DEFAULT_USER_AGENT,
  memoryConfig,
};
