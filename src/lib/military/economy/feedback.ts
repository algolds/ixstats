/**
 * Layer (f): defense ↔ economy feedback (research §7.7; owner decision: realistic). Every effect is a level effect on
 * the nation's GDP or population, written through `src/lib/economy/storyteller-effects.ts` (keyed levels moved by
 * `syncLevelEffects`, stamped on the country's realm clock). Pure: these return targets and shocks, the defense
 * module writes them.
 *
 * Level effects phase in linearly over their duration; a 30-year phase-in (1 / 3.3% a year) matches the slope of the
 * research's 3%/yr exponential convergence at the start, which is where the game lives.
 */
import type { LevelTarget } from "~/lib/economy/storyteller-effects";
import { StorytellerEffectType } from "~/lib/economy/calculations";
import {
  DEFAULT_SHARES,
  FALLBACK_GDP_SHARE,
  RD_DELTA,
  monthlyRate,
} from "~/lib/military/model/constants";

// ---------------------------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------------------------

/** Burden m = D / Y above which spending crowds out growth [S21]. */
export const BASELINE_BURDEN = 0.02;
/** Long-run elasticity of the GDP level to ln(m / m_base) [S21]. */
export const CROWD_OUT_ELASTICITY = -0.15;
/** Convergence to the long-run level: ~3.3% of the gap a year [S21]. */
export const CROWD_OUT_CONVERGENCE = 0.033;
export const CROWD_OUT_PHASE_YEARS = 1 / CROWD_OUT_CONVERGENCE;
/** R&D spillover: TFP × (1 + 0.02 ln(1 + H_RD / (0.003 Y))) (0.02 designer) [S24]. */
export const RD_SPILLOVER_COEFFICIENT = 0.02;
export const RD_SPILLOVER_SCALE = 0.003;
/** Years the spillover takes to show (designer). */
export const RD_SPILLOVER_PHASE_YEARS = 5;
/** Labour share of output (standard) and labour force as a share of population (0.65 working age × 0.6; designer). */
export const LABOUR_SHARE = 0.6;
export const LABOUR_FORCE_SHARE = 0.39;
/** Conscripts cost half a worker's output (young, low tenure) [S9]. */
export const CONSCRIPT_LABOUR_WEIGHT = 0.5;
/** The labour hit shows and reverses over about 3 months [S3]. */
export const LABOUR_PHASE_YEARS = 0.25;
/** Burden collapse hazard: h = 0.02 × ((m − 0.5) / 0.25)² a month from 50% to 75% of GDP [S3]. */
export const COLLAPSE_BURDEN_START = 0.5;
export const COLLAPSE_BURDEN_SPAN = 0.25;
export const COLLAPSE_HAZARD_MAX = 0.02;
/** An economic collapse under the burden costs this much GDP, shown over a year (designer). */
export const COLLAPSE_GDP_LOSS = -0.2;
export const COLLAPSE_PHASE_YEARS = 1;
/** War damage: GDP level gap toward −30% after ~5 years of major war at home, −10% for neighbours [S86]. */
export const WAR_DAMAGE_HOME = -0.3;
export const WAR_DAMAGE_NEIGHBOUR = -0.1;
export const WAR_DAMAGE_YEARS = 5;
/** Full intensity is a war engaging 0.5% of the defender's population (designer). */
export const WAR_INTENSITY_POPULATION_SHARE = 0.005;
/** Levels move in steps of 0.1% of GDP, so small drifts in GDP write no rows. */
export const LEVEL_STEP = 0.001;

export const FEEDBACK_KEYS = {
  crowdOut: "defense:crowd-out",
  rdSpillover: "defense:rd-spillover",
  labour: "defense:labour",
} as const;
export const collapseKey = (monthIndex: number) => `defense:collapse:${monthIndex}`;

const YEAR_DAYS = 365.25;
const quantise = (value: number) => Math.round(value / LEVEL_STEP) * LEVEL_STEP;

// ---------------------------------------------------------------------------------------------------------------
// Monthly levels
// ---------------------------------------------------------------------------------------------------------------

/** Long-run crowd-out level: e^(−0.15 ln(max(m, 2%) / 2%)) − 1 (4% → −9.9%, 10% → −21.4%); no bonus below 2%. */
export function crowdOutLevel(burden: number): number {
  const ratio = Math.max(burden, BASELINE_BURDEN) / BASELINE_BURDEN;
  return Math.exp(CROWD_OUT_ELASTICITY * Math.log(ratio)) - 1;
}

/** R&D stock of a nation at the default 2% budget and 6% R&D share (the spillover's zero point), as a share of GDP. */
export const RD_BASELINE_GDP_SHARE = (FALLBACK_GDP_SHARE * DEFAULT_SHARES.rd) / 12 / monthlyRate(RD_DELTA);

const spillover = (rdShare: number) => RD_SPILLOVER_COEFFICIENT * Math.log(1 + rdShare / RD_SPILLOVER_SCALE);

/**
 * R&D spillover above the default nation's: (1 + 0.02 ln(1 + H/0.003Y)) / (1 + 0.02 ln(1 + H_ref/0.003Y)) − 1, never
 * negative (so the reset hands no nation a blanket boost, and spending little is not punished twice).
 */
export function rdSpilloverLevel(rdStock: number, gdp: number): number {
  if (!(gdp > 0)) return 0;
  const level = (1 + spillover(Math.max(0, rdStock) / gdp)) / (1 + spillover(RD_BASELINE_GDP_SHARE)) - 1;
  return Math.max(0, level);
}

/** Mobilisation labour hit: −0.6 × (mobilised + 0.5 × conscripts) / labour force. */
export function labourLevel(input: { mobilised: number; conscripts: number; population: number }): number {
  const labour = LABOUR_FORCE_SHARE * Math.max(0, input.population);
  if (!(labour > 0)) return 0;
  const withdrawn = Math.max(0, input.mobilised) + CONSCRIPT_LABOUR_WEIGHT * Math.max(0, input.conscripts);
  return Math.max(-0.5, (-LABOUR_SHARE * withdrawn) / labour);
}

/** Monthly collapse hazard: 0 up to 50% of GDP, 0.02 × ((m − 0.5)/0.25)² to 75%, 0.02 beyond. */
export function collapseHazard(burden: number): number {
  const x = Math.min(1, Math.max(0, (burden - COLLAPSE_BURDEN_START) / COLLAPSE_BURDEN_SPAN));
  return COLLAPSE_HAZARD_MAX * x * x;
}

export interface FeedbackInput {
  countryId: string;
  /** Defense spending with the emergency supplement, over GDP. */
  burden: number;
  rdStock: number;
  gdp: number;
  mobilised: number;
  conscripts: number;
  population: number;
}

function target(
  countryId: string,
  createdBy: string,
  value: number,
  duration: number,
  description: string
): LevelTarget[] {
  const level = quantise(value);
  return level === 0
    ? []
    : [{ countryId, inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT, value: level, duration, description, createdBy }];
}

/** The keyed GDP levels the defense posture holds a nation at now (zero levels are left out, which ends them). */
export function defenseFeedbackTargets(input: FeedbackInput): LevelTarget[] {
  const pct = (m: number) => `${(m * 100).toFixed(1)}%`;
  return [
    ...target(
      input.countryId,
      FEEDBACK_KEYS.crowdOut,
      crowdOutLevel(input.burden),
      CROWD_OUT_PHASE_YEARS,
      `Defense spending crowds out growth (burden ${pct(input.burden)} of GDP)`
    ),
    ...target(
      input.countryId,
      FEEDBACK_KEYS.rdSpillover,
      rdSpilloverLevel(input.rdStock, input.gdp),
      RD_SPILLOVER_PHASE_YEARS,
      "Defense R&D spillover"
    ),
    ...target(
      input.countryId,
      FEEDBACK_KEYS.labour,
      labourLevel(input),
      LABOUR_PHASE_YEARS,
      "Mobilised reservists and conscripts away from work"
    ),
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// War
// ---------------------------------------------------------------------------------------------------------------

/** War intensity in [0, 1]: personnel engaged on both sides against 0.5% of the defender's population. */
export function warIntensity(engaged: number, defenderPopulation: number): number {
  if (!(defenderPopulation > 0)) return 1;
  return Math.min(1, Math.max(0, engaged) / (WAR_INTENSITY_POPULATION_SHARE * defenderPopulation));
}

/** GDP level loss of an engagement: −30% (home) / −10% (neighbours) × intensity × its share of five years. */
export function warDamageLevels(intensity: number, days: number): { home: number; neighbour: number } {
  const share = Math.min(1, Math.max(0, days) / (WAR_DAMAGE_YEARS * YEAR_DAYS));
  const scale = Math.min(1, Math.max(0, intensity)) * share;
  return { home: WAR_DAMAGE_HOME * scale, neighbour: WAR_DAMAGE_NEIGHBOUR * scale };
}

/** Population level change from deaths. */
export const populationLevel = (deaths: number, population: number) =>
  population > 0 ? -Math.min(0.5, Math.max(0, deaths) / population) : 0;
