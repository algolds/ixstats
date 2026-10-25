/**
 * Defense model constants (realm time design §4, `plans/realm-time/defense-research.md` §7). Values the research
 * sources carry a source tag; values marked "designer" are tunable game defaults, not evidence. Pure and client-safe.
 */

// ---------------------------------------------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------------------------------------------

export const DAY_MS = 24 * 60 * 60 * 1000;
/** One in-game month on a realm clock (a Gregorian year / 12; custom calendars only change how dates read). */
export const MONTH_MS = (365.25 / 12) * DAY_MS;
/** Gaps up to this many months advance month by month; longer gaps (date jumps) use the closed forms. */
export const STEPWISE_MAX_MONTHS = 24;
/** The closed-form path re-reads coupled targets (readiness funding) every this many months. */
export const CLOSED_FORM_SEGMENT_MONTHS = 6;

/** Monthly rate from an annual one: r_month = 1 − (1 − r_year)^(1/12) (research conventions). */
export const monthlyRate = (annual: number) => 1 - Math.pow(1 - annual, 1 / 12);

// ---------------------------------------------------------------------------------------------------------------
// Domains (owner decision: fixed domains, custom names)
// ---------------------------------------------------------------------------------------------------------------

export const BRANCH_DOMAINS = ["land", "sea", "air", "marines", "space", "strategic_missile"] as const;
export type BranchDomain = (typeof BRANCH_DOMAINS)[number];

export interface DomainParams {
  /** Capital intensity α in CP = … K^α N^(1−α). land/sea/air from research §7.4 (designer); others designer. */
  alpha: number;
  /** Annual depreciation δ. land/sea/air from BEA mixes [S19]; marines like land; space/missile designer. */
  delta: number;
  /** Training O&M per member as a share of pay, τ_b (research §7.3, designer). */
  trainingShare: number;
  /**
   * Real capital per member (catalog USD) that makes one "equipped member" in combat power: CP is normalised so a
   * branch at this ratio scores about its headcount (designer; ≈ the default equilibrium at GDP per capita 21k).
   */
  capitalPerMemberRef: number;
  /**
   * Capital a member is organised around, as a multiple of GDP per capita (S = equipment on hand). About 0.6× the
   * ratio the default budget split reaches, so a default force is fully equipped with slack (designer).
   */
  authorisedCapitalPerGdpPc: number;
  /** Default effort share of a starter force (army 55 / navy 25 / air 20, from the old starter split). */
  starterEffort: number;
}

export const DOMAIN_PARAMS: Record<BranchDomain, DomainParams> = {
  land: {
    alpha: 0.45,
    delta: 0.1,
    trainingShare: 0.25,
    capitalPerMemberRef: 150_000,
    authorisedCapitalPerGdpPc: 4.4,
    starterEffort: 0.55,
  },
  sea: {
    alpha: 0.8,
    delta: 0.06,
    trainingShare: 0.35,
    capitalPerMemberRef: 1_250_000,
    authorisedCapitalPerGdpPc: 36,
    starterEffort: 0.25,
  },
  air: {
    alpha: 0.8,
    delta: 0.09,
    trainingShare: 0.5,
    capitalPerMemberRef: 850_000,
    authorisedCapitalPerGdpPc: 24,
    starterEffort: 0.2,
  },
  marines: {
    alpha: 0.55,
    delta: 0.1,
    trainingShare: 0.3,
    capitalPerMemberRef: 200_000,
    authorisedCapitalPerGdpPc: 6,
    starterEffort: 0,
  },
  space: {
    alpha: 0.85,
    delta: 0.12,
    trainingShare: 0.5,
    capitalPerMemberRef: 2_000_000,
    authorisedCapitalPerGdpPc: 48,
    starterEffort: 0,
  },
  strategic_missile: {
    alpha: 0.85,
    delta: 0.05,
    trainingShare: 0.35,
    capitalPerMemberRef: 1_500_000,
    authorisedCapitalPerGdpPc: 36,
    starterEffort: 0,
  },
};

export const DOMAIN_LABELS: Record<BranchDomain, string> = {
  land: "Land",
  sea: "Sea",
  air: "Air",
  marines: "Marines",
  space: "Space",
  strategic_missile: "Strategic missile",
};

// ---------------------------------------------------------------------------------------------------------------
// Layer (a): budget split (research §7.1)
// ---------------------------------------------------------------------------------------------------------------

export interface BudgetShares {
  personnel: number;
  om: number;
  procurement: number;
  rd: number;
  infrastructure: number;
}

/** Default split, between UK/France and Türkiye (designer) [S1]. */
export const DEFAULT_SHARES: BudgetShares = {
  personnel: 0.35,
  om: 0.3,
  procurement: 0.22,
  rd: 0.06,
  infrastructure: 0.07,
};

export const SHARE_PRESETS = {
  /** US-like. */
  professional: { personnel: 0.3, om: 0.38, procurement: 0.24, rd: 0.06, infrastructure: 0.02 },
  /** Greece/Türkiye-like. */
  territorial: { personnel: 0.55, om: 0.15, procurement: 0.22, rd: 0.02, infrastructure: 0.06 },
  /** Poland 2025-like. */
  rearm: { personnel: 0.27, om: 0.15, procurement: 0.5, rd: 0.04, infrastructure: 0.04 },
} as const satisfies Record<string, BudgetShares>;
export type SharePreset = keyof typeof SHARE_PRESETS;

/** NATO diagnostics: equipment below 20% cannot recapitalise [S4]. */
export const MIN_HEALTHY_PROCUREMENT_SHARE = 0.2;

/** Defense spending as a share of GDP when nothing else gives one (fallback chain, last step). */
export const FALLBACK_GDP_SHARE = 0.02;
/** Government spending as a share of GDP when the nation records none (budget-math initialTotalBudget). */
export const FALLBACK_SPENDING_GDP_SHARE = 0.2;
/** A defense figure above this share of GDP is bad data and skipped (old starter rule). */
export const MAX_PLAUSIBLE_BURDEN = 0.5;

// ---------------------------------------------------------------------------------------------------------------
// Layer (b): personnel, reserves, mobilisation (research §7.2)
// ---------------------------------------------------------------------------------------------------------------

/** Annual pay of a volunteer as a multiple of GDP per capita (κ_vol, range 1.5–3.6) [S1]. */
export const PAY_VOLUNTEER_GDPPC = 2.2;
/** Annual pay of a conscript as a multiple of GDP per capita (≈0.3× a volunteer) [S8]. */
export const PAY_CONSCRIPT_GDPPC = 0.6;
/** Reservist refresher training per year as a share of member pay (designer). */
export const RESERVE_COST_SHARE = 0.1;
/** Share of population aged 18–40 when demographics are unknown (designer). */
export const MILITARY_AGE_SHARE = 0.3;
/** Years in the 18–40 band, to turn it into one birth cohort (designer). */
export const MILITARY_AGE_YEARS = 22;
/** Volunteers available: 1% of the military-age population (designer). */
export const VOLUNTEER_POOL_SHARE = 0.01;
/** Share of each cohort eligible under universal service (designer). */
export const COHORT_ELIGIBLE_SHARE = 0.4;
/** Headcount closes this share of the gap a month when growing (volunteer recruiting is slow; designer). */
export const HEADCOUNT_RATE_UP = 0.05;
/** … and when shrinking (discharge, attrition; designer). */
export const HEADCOUNT_RATE_DOWN = 0.15;
/** Monthly separation of volunteers into the reserve (designer). */
export const VOLUNTEER_SEPARATION_MONTHLY = 0.01;
/** Reserve obligation share: every conscript, half of volunteers (research §7.2). */
export const RESERVE_OBLIGATION_CONSCRIPT = 1;
export const RESERVE_OBLIGATION_VOLUNTEER = 0.5;
export const DEFAULT_RESERVE_YEARS = 20;
export const MAX_RESERVE_YEARS = 30;
export const SERVICE_MONTHS_MIN = 6;
export const SERVICE_MONTHS_MAX = 18;
export const DEFAULT_SERVICE_MONTHS = 12;

export const DOCTRINES = ["defensive", "balanced", "expeditionary"] as const;
export type Doctrine = (typeof DOCTRINES)[number];

/** Mobilisation time constant τ_mob in days, by doctrine (designer; Israel 300k in 48 h, NATO tiers) [S73][S32]. */
export const MOBILISATION_TAU_DAYS: Record<Doctrine, number> = {
  defensive: 7,
  balanced: 10,
  expeditionary: 14,
};

// ---------------------------------------------------------------------------------------------------------------
// Capital (PIM), procurement and industry (research §7.2)
// ---------------------------------------------------------------------------------------------------------------

/** Annual depreciation of the R&D stock and the infrastructure stock (BEA) [S19]. */
export const RD_DELTA = 0.18;
export const INFRASTRUCTURE_DELTA = 0.018;
/** Wear multipliers on δ (garrison 1, alert 1.5, combat 3, cap 5) [S40]. */
export const MAX_WEAR = 5;
/** Down payment at order (designer). */
export const ORDER_DOWN_PAYMENT = 0.15;
/** Unit cost growth per month an order slips for want of money (EDA "delay is cost growth") [S14]. */
export const SLIP_COST_GROWTH = 0.005;
/** Import premium on catalog cost (owner decision). */
export const IMPORT_COST_PREMIUM = 0.15;
/** Import lead times are this much longer (designer). */
export const IMPORT_LEAD_MULTIPLIER = 1.5;
/** Monthly domestic production capacity: θ_ind × GDP × manufacturing share, θ_ind = 0.02/12 (designer). */
export const INDUSTRY_THETA_MONTHLY = 0.02 / 12;
/** Manufacturing share of GDP when unknown (designer). */
export const DEFAULT_MANUFACTURING_SHARE = 0.15;
/** Surge doubles domestic capacity over 24 months [S18] … */
export const SURGE_RAMP_MONTHS = 24;
export const SURGE_CAPACITY_MULTIPLIER = 2;
/** … and costs 30% more while surging (designer). */
export const SURGE_COST_PREMIUM = 0.3;
/** Real defense cost escalation over the GDP deflator, π_def [S10][S11]. */
export const DEFENSE_INFLATION = 0.015;
/** IxStats GDP is a real series (no deflator), so π_GDP is 0 (designer; hook for a nominal economy). */
export const GDP_INFLATION = 0;

/** Production lead times in months by catalog subcategory (research §1.5 midpoints, designer). */
export const LEAD_MONTHS_BY_SUBCATEGORY: Record<string, number> = {
  missile: 9,
  air_defense: 12,
  naval_weapon: 9,
  torpedo: 9,
  apc: 15,
  ifv: 18,
  tank: 24,
  artillery: 15,
  mlrs: 15,
  helicopter: 24,
  transport: 30,
  attack: 30,
  fighter: 36,
  fighter_gen4_5: 36,
  fighter_gen5: 42,
  bomber: 48,
  frigate: 42,
  submarine: 60,
  destroyer: 54,
  amphibious: 48,
  carrier: 72,
};
export const DEFAULT_LEAD_MONTHS = 18;

/** Catalog era → design year for quality decay (designer, era midpoints). */
export const ERA_DESIGN_YEAR: Record<string, number> = {
  COLD_WAR: 1975,
  MODERN: 2001,
  CONTEMPORARY: 2016,
  ADVANCED: 2024,
  NEXT_GEN: 2032,
};
export const DEFAULT_DESIGN_YEAR = 2001;

// ---------------------------------------------------------------------------------------------------------------
// Layer (c): readiness (research §7.3)
// ---------------------------------------------------------------------------------------------------------------

/** Maintenance O&M per year of capital value (from the O&S share) [S39]. */
export const MAINTENANCE_OM_SHARE = 0.06;
export const RC_RATE_UP = 0.06;
export const RC_RATE_DOWN = 0.1;
/** Most maintenance funding counts for (f_m clamp). */
export const MAINTENANCE_FUNDING_CAP = 1.2;
/** Training closes 25% of its gap a month (~90% in 8 months, ReARMM phase) [S30]. */
export const TRAINING_RATE_UP = 0.25;
/** Training above its cap decays with a 9-month half-life [S34]. */
export const TRAINING_HALF_LIFE_MONTHS = 9;
/** Training ceiling by manpower: volunteer 1.0, conscript 0.75, reserve 0.6 (designer). */
export const T_MAX_VOLUNTEER = 1;
export const T_MAX_CONSCRIPT = 0.75;
export const T_MAX_RESERVE = 0.6;
/** Soft-min readiness: R = 0.6 min + 0.4 geometric mean (designer, weakest-link feel) [S27]. */
export const READINESS_MIN_WEIGHT = 0.6;
/** C-level bands (approximate DRRS) [S28][S29]. */
export const C_LEVEL_BANDS = [
  { level: "C-1", min: 0.9 },
  { level: "C-2", min: 0.8 },
  { level: "C-3", min: 0.7 },
] as const;
export type CLevel = "C-1" | "C-2" | "C-3" | "C-4";

/** S norm for conscripts is this share of a volunteer force's (cheaper kit per conscript; designer). */
export const CONSCRIPT_EQUIPMENT_NORM = 0.5;

export const O_M_PRIORITIES = ["balanced", "maintenance", "training"] as const;
export type OmPriority = (typeof O_M_PRIORITIES)[number];
/** The weight the favoured O&M area gets when splitting the O&M line (designer). */
export const O_M_FAVOUR_WEIGHT = 1.25;

export const ALERT_LEVELS = ["peacetime", "elevated", "high", "war"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export interface AlertParams {
  /** O&M requirement multiplier. */
  omMultiplier: number;
  /** Wear multiplier on depreciation and maintenance. */
  wear: number;
  /** Training ceiling. */
  trainingCeiling: number;
  /** Days for a raise to this level to bite (7 for Elevated to 30 for War). */
  biteDays: number;
}

/** Alert levels (designer multipliers, wear from [S40]). */
export const ALERT_PARAMS: Record<AlertLevel, AlertParams> = {
  peacetime: { omMultiplier: 1, wear: 1, trainingCeiling: 0.85, biteDays: 0 },
  elevated: { omMultiplier: 1.15, wear: 1.2, trainingCeiling: 0.95, biteDays: 7 },
  high: { omMultiplier: 1.4, wear: 1.5, trainingCeiling: 1, biteDays: 14 },
  war: { omMultiplier: 2, wear: 3, trainingCeiling: 1, biteDays: 30 },
};

/** Operation wear on a deployed branch, by operation type (designer, [S40]). */
export const OPERATION_WEAR: Record<string, number> = {
  training: 1.5,
  peacekeeping: 1.5,
  defense_pact: 1.2,
  blockade: 2,
  intervention: 3,
};

// ---------------------------------------------------------------------------------------------------------------
// Layer (d): combat power (research §7.4)
// ---------------------------------------------------------------------------------------------------------------

/** Quality lost per year of a design's age against the frontier, g_obs (designer, from 1–4%/yr) [S13][S14]. */
export const QUALITY_DECAY_PER_YEAR = 0.03;
/** Quality of uncatalogued capital at the country's frontier (research: 0.8). */
export const GENERIC_CAPITAL_QUALITY = 0.8;
/** Most years a country without R&D lags the realm frontier (designer). */
export const MAX_FRONTIER_LAG_YEARS = 10;
/**
 * R&D stock that keeps a country at the frontier, as a share of GDP: the monthly steady state of a 2%-of-GDP budget
 * with the default 6% R&D share at δ 0.18 (designer).
 */
export const RD_REFERENCE_GDP_SHARE =
  (FALLBACK_GDP_SHARE * DEFAULT_SHARES.rd) / 12 / monthlyRate(RD_DELTA);
/** CEV bounds and exponent (Dupuy range; 0.12 damped from Beckley) [S47][S57]. */
export const CEV_MIN = 0.6;
export const CEV_MAX = 1.5;
export const CEV_EXPONENT = 0.12;
/** Enabler factor floor (designer). */
export const ENABLER_FLOOR = 0.7;
/** Enabler value that fully covers a branch, as a share of its capital (designer). */
export const ENABLER_COVERAGE_SHARE = 0.05;

/** Doctrine CEV hook (D3 may tune; 1 for all today). */
export const DOCTRINE_CEV: Record<Doctrine, number> = {
  defensive: 1,
  balanced: 1,
  expeditionary: 1,
};

// ---------------------------------------------------------------------------------------------------------------
// Operations' direct readiness writes (replacing the old ±10 / +20 / +5 unit readiness; designer)
// ---------------------------------------------------------------------------------------------------------------

/** Equipment condition a branch loses when its units deploy. */
export const DEPLOY_CONDITION_COST = 0.05;
/** Training a branch gains when a training exercise ends (capped at the alert ceiling). */
export const TRAINING_EXERCISE_GAIN = 0.1;
/** Equipment condition a branch loses when another operation ends (reset need). */
export const OPERATION_RESET_COST = 0.05;
