/**
 * Combat resolution constants (realm time design §4.1; `plans/realm-time/defense-research.md` §7.5–7.6). Values with a
 * source tag come from the research; values marked "designer" are tunable game defaults, not evidence. Pure and
 * client-safe.
 */
import type { AlertLevel, BranchDomain, Doctrine } from "~/lib/military/model/constants";

// ---------------------------------------------------------------------------------------------------------------
// Odds (step 2)
// ---------------------------------------------------------------------------------------------------------------

/** Logistic slope k: Helmbold's 5.87 per log10 ≈ 2.55 per ln [S60]. */
export const ODDS_SLOPE = 2.5;
/** Each catastrophe tail (defender error, attacker error) [S59]. */
export const CATASTROPHE_TAIL = 0.05;
/** The margin a catastrophe sets (beyond every band edge). */
export const CATASTROPHE_MARGIN = 1.5;
/** Force ratios are kept inside these bounds so an empty side never produces ±∞ (designer). */
export const MIN_FORCE_RATIO = 0.01;
export const MAX_FORCE_RATIO = 100;

export const OUTCOME_BANDS = [
  "repulsedHeavy",
  "repulsed",
  "marginal",
  "success",
  "breakthrough",
] as const;
export type OutcomeBand = (typeof OUTCOME_BANDS)[number];

/** Lower margin edge of each band above the first (research §7.5). */
export const BAND_EDGES: readonly number[] = [-0.7, 0, 0.4, 1];

export const BAND_LABELS: Record<OutcomeBand, string> = {
  repulsedHeavy: "Repulsed with heavy loss",
  repulsed: "Repulsed",
  marginal: "Marginal gain",
  success: "Success",
  breakthrough: "Breakthrough",
};

/** The product of a side's situational multipliers never exceeds ×4 (exploit checklist 6). */
export const MULTIPLIER_CAP = 4;

// ---------------------------------------------------------------------------------------------------------------
// Multipliers (step 1)
// ---------------------------------------------------------------------------------------------------------------

export const POSTURES = ["attack", "hasty", "prepared", "fortified", "delay", "withdrawal"] as const;
export type Posture = (typeof POSTURES)[number];

/** Defender posture factors (Dupuy) [S45]. */
export const POSTURE_FACTOR: Record<Posture, number> = {
  attack: 1,
  hasty: 1.3,
  prepared: 1.5,
  fortified: 1.6,
  delay: 1.2,
  withdrawal: 1.15,
};

/** The posture a defender holds at each alert level in effect (designer). War is fortified with full infrastructure. */
export const POSTURE_BY_ALERT: Record<AlertLevel, Posture> = {
  peacetime: "hasty",
  elevated: "prepared",
  high: "prepared",
  war: "fortified",
};

export const TERRAIN_CLASSES = ["open", "rolling", "urban", "rugged", "mountain"] as const;
export type TerrainClass = (typeof TERRAIN_CLASSES)[number];

/** Defender terrain factors: open 1.0, rolling-mixed 1.3, urban 1.4, rugged-mixed 1.5, mountain 1.6 [S45]. */
export const TERRAIN_FACTOR: Record<TerrainClass, number> = {
  open: 1,
  rolling: 1.3,
  urban: 1.4,
  rugged: 1.5,
  mountain: 1.6,
};

export const TERRAIN_LABELS: Record<TerrainClass, string> = {
  open: "Open",
  rolling: "Rolling, mixed",
  urban: "Urban",
  rugged: "Rugged, mixed",
  mountain: "Mountain",
};

/** A river line on the front adds this to the terrain factor (designer). */
export const RIVER_LINE_BONUS = 0.2;
/**
 * River length within ~5 km of the border, as a share of the border, that makes a river line (designer; on the clone
 * about a third of Ixnay's land borders pass, those that follow a river rather than cross one).
 */
export const RIVER_LINE_SHARE = 0.5;
/** Most a map-derived terrain factor reaches (mountain plus a river line). */
export const MAX_TERRAIN_FACTOR = TERRAIN_FACTOR.mountain + RIVER_LINE_BONUS;

/**
 * Terrain factor by elevation zone (`zone_0` coastal lowlands … `zone_8` extreme alpine): lowlands open, low hills
 * between open and rolling, rolling hills rolling, uplands between rolling and rugged, mountains from 1,000 m
 * (designer interpolation of [S45]).
 */
export const ELEVATION_ZONE_TERRAIN: readonly number[] = [1, 1.15, 1.3, 1.4, 1.6, 1.6, 1.6, 1.6, 1.6];
/** Climate cover that slows an attacker: jungle (tropical wet), boreal forest, highland (designer). */
export const CLIMATE_TERRAIN_BONUS: Readonly<Record<string, number>> = { Ar: 0.2, E: 0.1, H: 0.1 };
/** Urban weight from population density: min(0.3, density / 3,000 per km²) of the urban factor (designer). */
export const URBAN_DENSITY_REFERENCE = 3_000;
export const MAX_URBAN_WEIGHT = 0.3;
/** Terrain when neither the map nor the defender's declared profile gives one (designer: the typical mix). */
export const DEFAULT_TERRAIN: TerrainClass = "rolling";

export const SURPRISE_LEVELS = ["none", "minor", "substantial", "complete"] as const;
export type SurpriseLevel = (typeof SURPRISE_LEVELS)[number];

/** Surprise factors; substantial is interpolated [S46]. */
export const SURPRISE_FACTOR: Record<SurpriseLevel, number> = {
  none: 1,
  minor: 1.1,
  substantial: 1.6,
  complete: 2.2,
};
/** Surprise decays by a third per day over three days [S46]. */
export const SURPRISE_DECAY_DAYS = 3;
/** An attacker's raised alert or mobilisation signals intent this long after it is lowered (designer). */
export const INTENT_SIGNAL_DAYS = 30;

/** Air superiority factor for the holder, and for the side under enemy superiority (designer) [S46]. */
export const AIR_SUPERIORITY_FACTOR = 1.3;
export const AIR_INFERIORITY_FACTOR = 0.85;
/** The air power ratio that gives full superiority (designer). */
export const AIR_SUPERIORITY_RATIO = 2;

/** Days of supply a fully funded force carries into a fight at home (designer). */
export const SUPPLY_BASE_DAYS = 14;
/** supply = min(1, DoS / 7)^0.5, never below 0.5 (designer). */
export const SUPPLY_REFERENCE_DAYS = 7;
export const SUPPLY_FLOOR = 0.5;

/** Fortification adds up to ×1.15 to a prepared or fortified defense, from the infrastructure stock (designer). */
export const FORT_MAX_BONUS = 0.15;

/** Doctrine factors: defensive def ×1.10 att ×0.95; expeditionary att ×1.05 away, def ×0.95 at home (designer). */
export const DOCTRINE_FACTOR: Record<Doctrine, { attack: number; defend: number }> = {
  defensive: { attack: 0.95, defend: 1.1 },
  balanced: { attack: 1, defend: 1 },
  expeditionary: { attack: 1.05, defend: 0.95 },
};

/** Defender personnel per km of front for a full-density defense (designer: a 15k division holds ~30 km) [S78]. */
export const FORCE_DENSITY_PER_KM = 500;
/** Front width of an attack across the sea or at range, where no border is shared (designer). */
export const OVERSEAS_FRONT_KM = 300;
/** Shortest front a shared border gives (map slivers; designer). */
export const MIN_FRONT_KM = 50;
/** Distance assumed between two nations the map cannot measure (designer). */
export const DEFAULT_DISTANCE_KM = 1_500;

/** Power projection range D_reach by doctrine: reach = exp(−d / D_reach) (designer) [§7.6]. */
export const REACH_KM: Record<Doctrine, number> = {
  defensive: 500,
  balanced: 1_500,
  expeditionary: 5_000,
};

export type Campaign = "land" | "overseas";

/** Theatre weights by campaign: a land campaign is army + 0.5 air + 0.2 navy (designer) [§7.4]. */
export const CAMPAIGN_WEIGHTS: Record<Campaign, Record<BranchDomain, number>> = {
  land: { land: 1, marines: 1, air: 0.5, sea: 0.2, space: 0.1, strategic_missile: 0.2 },
  overseas: { land: 0.3, marines: 1, air: 0.8, sea: 0.8, space: 0.1, strategic_missile: 0.3 },
};

/** Domains that hold ground (front density, defender engagement). */
export const GROUND_DOMAINS: readonly BranchDomain[] = ["land", "marines"];

// ---------------------------------------------------------------------------------------------------------------
// Losses, breakpoints, duration (steps 4–5)
// ---------------------------------------------------------------------------------------------------------------

/** Daily casualty rate, mid of WWII's 1–3% division rate [S67]. */
export const LOSS_BASE_DAILY = 0.02;
/** Era factor: minor post-1945 hostilities run at about half of WWII rates [S67]. */
export const ERA_LIMITED = 0.5;
export const ERA_MAJOR = 1;
/** Size factor by engaged personnel (QJM bands; the last two designer) [S48]. */
export const SIZE_BANDS: readonly { maxPersonnel: number; factor: number }[] = [
  { maxPersonnel: 5_000, factor: 2 },
  { maxPersonnel: 10_000, factor: 1.5 },
  { maxPersonnel: 20_000, factor: 1 },
  { maxPersonnel: 50_000, factor: 0.8 },
  { maxPersonnel: Number.POSITIVE_INFINITY, factor: 0.6 },
];
/** Fatigue for day 1, 2, 3, 4+ (TNDM concept; values designer) [S48]. */
export const FATIGUE: readonly number[] = [1, 0.85, 0.75, 0.7];
/** Winners lose less: losses × e^(∓0.35 m) [S67]. */
export const MARGIN_LOSS_SLOPE = 0.35;
/** Fortification protects the defender: fortified 0.6, prepared 0.8 [S67]. */
export const FORT_LOSS_REDUCTION: Partial<Record<Posture, number>> = { fortified: 0.6, prepared: 0.8 };
/** Difficult terrain lowers loss rates: env = 1 / (1 + 0.5 (terrain − 1)) (designer) [S67]. */
export const TERRAIN_LOSS_DAMPING = 0.5;
/** Most of a force lost in one day (designer sanity cap). */
export const MAX_DAILY_LOSS = 0.25;

/** Equipment loss ratios to personnel: armor 6× (5–7×), towed artillery 0.1×, self-propelled 0.25× [S67]. */
export const ARMOR_LOSS_RATIO = 6;
export const ARTILLERY_LOSS_RATIO = 0.1;
export const SP_ARTILLERY_LOSS_RATIO = 0.25;
/** Uncatalogued ground capital: 35% armor, 15% artillery, 50% other at the personnel rate (designer). */
export const GENERIC_GROUND_EQUIPMENT_RATIO = 0.35 * ARMOR_LOSS_RATIO + 0.15 * ARTILLERY_LOSS_RATIO + 0.5;
/** Ships are lost at the personnel rate of the engagement they fight in (designer). */
export const NAVAL_LOSS_RATIO = 1;
/** Air attrition per sortie: 0.01 × (enemy AD / own EW)^0.5, capped at 0.05; one sortie a day [S59]. */
export const AIR_ATTRITION_BASE = 0.01;
export const AIR_ATTRITION_CAP = 0.05;
export const SORTIES_PER_DAY = 1;
/** Aircrew lost per share of aircraft lost (designer). */
export const AIRCREW_LOSS_SHARE = 0.2;
/** Most of a branch's capital an engagement destroys (designer sanity cap). */
export const MAX_CAPITAL_LOSS = 0.9;

/** Killed ≈ 25% of casualties (designer; the 1:3 killed-to-wounded shorthand) [S67]. */
export const KILLED_SHARE = 0.25;
/** Civilian deaths per military death on war sites, at full intensity (designer). */
export const CIVILIAN_DEATHS_PER_MILITARY = 0.5;

/** Breakpoints: defender ~ N(0.35 × morale, 0.10), attacker ~ N(0.5 × 0.35 × morale, 0.05) [S69]. */
export const BREAKPOINT_DEFENDER_MEAN = 0.35;
export const BREAKPOINT_DEFENDER_SD = 0.1;
export const BREAKPOINT_ATTACKER_SHARE = 0.5;
export const BREAKPOINT_ATTACKER_SD = 0.05;
/** Breakpoints never fall below this share of the force (designer). */
export const MIN_BREAKPOINT = 0.05;
/** morale = clamp(0.6, 1.3, 0.5 R + 0.3 CEV + 0.2 cause) [S69]; cause: defending the homeland 1.2, attacking 1.0. */
export const MORALE_MIN = 0.6;
export const MORALE_MAX = 1.3;
export const CAUSE_DEFENDING = 1.2;
export const CAUSE_ATTACKING = 1;

/** Defenders bring local forces up to this multiple of the attacking force to the engagement (designer). */
export const DEFENDER_ENGAGED_RATIO = 1.5;
/** Share of the planned days at which an objective is reached, by band (designer). */
export const OBJECTIVE_DAY_SHARE: Partial<Record<OutcomeBand, number>> = {
  breakthrough: 0.5,
  success: 0.8,
  marginal: 1,
};

// ---------------------------------------------------------------------------------------------------------------
// Engagement shape and preview (step 6)
// ---------------------------------------------------------------------------------------------------------------

export type EngagementMode = "strike" | "pvp" | "operation";

/** Planned engagement days of a strike (designer). */
export const STRIKE_DAYS = 3;
/** Longest engagement the model resolves day by day (designer). */
export const MAX_ENGAGEMENT_DAYS = 90;
/** Share of forces committed when the orders name none (designer). */
export const DEFAULT_COMMITMENT = 0.5;
export const MIN_COMMITMENT = 0.1;
/** Seeded simulations in a campaign preview [S59][S72]. */
export const PREVIEW_RUNS = 1_000;

// ---------------------------------------------------------------------------------------------------------------
// Intelligence (owner decision: estimates with error bands)
// ---------------------------------------------------------------------------------------------------------------

/** Log-width σ of the estimate of an enemy's strength with no intelligence (×1.8 either way; designer). */
export const INTEL_BASE_SIGMA = 0.6;
export const INTEL_MIN_SIGMA = 0.05;
/** Width falls by up to 40% with R&D (the intelligence signal), 30% with full relations, half with recon (designer). */
export const INTEL_RD_WEIGHT = 0.4;
export const INTEL_RELATION_WEIGHT = 0.3;
export const INTEL_RECON_FACTOR = 0.5;
/** A reconnaissance operation sharpens estimates while active and this many in-game days after (designer). */
export const RECON_WINDOW_DAYS = 30;
/** The estimate's error is at most this share of σ, so the shown range always holds the true value. */
export const INTEL_NOISE_SHARE = 0.8;
/** The estimate's error is redrawn once per in-game week, so asking again never averages it away. */
export const INTEL_REDRAW_DAYS = 7;
/** Grid points used to bound odds and band probabilities over an estimate's range. */
export const INTEL_RANGE_STEPS = 9;
