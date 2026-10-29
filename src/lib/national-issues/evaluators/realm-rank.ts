/**
 * Realm-relative issue thresholds (owner decision 2, plans/mycountry-stress/content-tuning.md): a `rank` trigger
 * condition asks "is this nation among the worst X% of its realm on field F". This file holds the per-field metadata
 * (which way is bad, the crisis floor, the tiebreak), the severity bands and the rank table. Pure: the store
 * (../realm-rank-store.ts) loads the rows.
 *
 * Rules:
 * - Bands come from the template's severity: low/medium = mild (worst 25%), high = serious (worst 10%),
 *   critical = crisis (worst 3%). A condition may override the share.
 * - A crisis template's band conditions (no share override) must also pass the field's absolute floor, so a healthy
 *   realm gets no crises. A field with no floor never passes as a crisis band condition.
 * - Ties: strict rank. Nations are ordered worst first on the field, then worst first on the field's tiebreak field,
 *   then by id, so exactly ceil(share x n) nations sit in the band. On top of that a nation must be strictly worse
 *   than the realm's median value: a value most of the realm shares (a seeded default such as approval 50 or poverty
 *   0) never counts as "worst", however the tiebreak falls.
 * - A realm with fewer than MIN_REALM_SAMPLE nations holding the figure ranks against the platform-wide rows.
 */

export type BadDirection = "high" | "low";
export type RankSide = "worst" | "best";
export type SeverityBand = "mild" | "serious" | "crisis";

export interface RankedFieldSpec {
  /** Which end of the scale is bad. */
  bad: BadDirection;
  /** A crisis band condition also needs the value beyond this (above it when bad is high, below when low). */
  crisisFloor: number | null;
  /** A ranked field that orders a tie on the value before the nation id (defaults to stabilityScore). */
  tiebreak?: string;
}

/** Every field a `rank` condition may name. Units are the snapshot's (rates in %, soft scores 0-100). */
export const RANKED_FIELDS = {
  inflationRate: { bad: "high", crisisFloor: 5 },
  unemploymentRate: { bad: "high", crisisFloor: 10 },
  totalDebtGDPRatio: { bad: "high", crisisFloor: 90 },
  budgetDeficitSurplus: { bad: "low", crisisFloor: -3 },
  actualGdpGrowth: { bad: "low", crisisFloor: 0 },
  tradeBalance: { bad: "low", crisisFloor: 0 },
  currentGdpPerCapita: { bad: "low", crisisFloor: 5000 },
  currentTotalGdp: { bad: "low", crisisFloor: null },
  currentPopulation: { bad: "low", crisisFloor: null },
  publicApproval: { bad: "low", crisisFloor: 30, tiebreak: "trustInGovernment" },
  povertyRate: { bad: "high", crisisFloor: 20, tiebreak: "unemploymentRate" },
  incomeInequalityGini: { bad: "high", crisisFloor: 45 },
  lifeExpectancy: { bad: "low", crisisFloor: 65 },
  literacyRate: { bad: "low", crisisFloor: 75 },
  infrastructureRating: { bad: "low", crisisFloor: 30 },
  politicalStability: { bad: "low", crisisFloor: 30 },
  democracyIndex: { bad: "low", crisisFloor: 25 },
  governmentEffectiveness: { bad: "low", crisisFloor: 35 },
  ruleOfLaw: { bad: "low", crisisFloor: 35 },
  corruptionIndex: { bad: "high", crisisFloor: 60 },
  politicalPolarization: { bad: "high", crisisFloor: 50 },
  stabilityScore: { bad: "low", crisisFloor: 35, tiebreak: "trustInGovernment" },
  crimeRate: { bad: "high", crisisFloor: 55 },
  protestFrequency: { bad: "high", crisisFloor: 22 },
  riotRisk: { bad: "high", crisisFloor: 45 },
  socialCohesion: { bad: "low", crisisFloor: 40 },
  ethnicTension: { bad: "high", crisisFloor: 32 },
  trustInGovernment: { bad: "low", crisisFloor: 20 },
  policingEffectiveness: { bad: "low", crisisFloor: 30 },
} as const satisfies Record<string, RankedFieldSpec>;

export type RankedField = keyof typeof RANKED_FIELDS;

export const BAND_SHARE: Record<SeverityBand, number> = { mild: 0.25, serious: 0.1, crisis: 0.03 };

/** Below this many nations with the figure, a realm ranks against the platform. */
export const MIN_REALM_SAMPLE = 10;

const DEFAULT_TIEBREAK: RankedField = "stabilityScore";

export function isRankedField(field: string): field is RankedField {
  return Object.prototype.hasOwnProperty.call(RANKED_FIELDS, field);
}

function specOf(field: RankedField): RankedFieldSpec {
  return RANKED_FIELDS[field];
}

/** The band of a template severity (the Priority enum, either case); anything unknown is mild. */
export function bandForSeverity(severity: string | null | undefined): SeverityBand {
  const s = (severity ?? "").toLowerCase();
  if (s === "critical") return "crisis";
  if (s === "high") return "serious";
  return "mild";
}

/** Whether a value is beyond the field's crisis floor (false when the field has none). */
export function passesCrisisFloor(field: RankedField, value: number): boolean {
  const { bad, crisisFloor } = specOf(field);
  if (crisisFloor === null) return false;
  return bad === "high" ? value > crisisFloor : value < crisisFloor;
}

/** One nation's figures, as its snapshot holds them. */
export interface RankRow {
  id: string;
  values: Partial<Record<RankedField, number>>;
}

/** Where a nation stands on a field: 0 = worst, of n ranked nations, and whether it is strictly worse than the median. */
export interface RankPosition {
  index: number;
  n: number;
  worseThanMedian: boolean;
  betterThanMedian: boolean;
}

export interface RankTable {
  position(field: RankedField, countryId: string): RankPosition | null;
}

type Entry = { id: string; value: number; tie: number };

const finite = (v: number | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** -1 when a is worse than b on a field whose bad end is `bad`. */
function worseFirst(a: number, b: number, bad: BadDirection): number {
  if (a === b) return 0;
  return (bad === "high" ? a > b : a < b) ? -1 : 1;
}

function tieFieldOf(field: RankedField): RankedField {
  const tie = specOf(field).tiebreak;
  return tie !== undefined && isRankedField(tie) ? tie : DEFAULT_TIEBREAK;
}

function entriesFor(field: RankedField, rows: RankRow[]): Entry[] {
  const tieField = tieFieldOf(field);
  const tieBad = specOf(tieField).bad;
  // Missing tiebreak values sort as the best, so they never win a tie into the band.
  const neutral = tieBad === "high" ? -Infinity : Infinity;
  return rows
    .filter((r) => finite(r.values[field]))
    .map((r) => {
      const t = r.values[tieField];
      return { id: r.id, value: r.values[field]!, tie: finite(t) ? t : neutral };
    });
}

function medianOf(sorted: Entry[]): number {
  const mid = (sorted.length - 1) / 2;
  return (sorted[Math.floor(mid)]!.value + sorted[Math.ceil(mid)]!.value) / 2;
}

function sortedField(field: RankedField, rows: RankRow[]) {
  const bad = specOf(field).bad;
  const tieBad = specOf(tieFieldOf(field)).bad;
  const entries = entriesFor(field, rows).sort(
    (a, b) =>
      worseFirst(a.value, b.value, bad) ||
      worseFirst(a.tie, b.tie, tieBad) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const index = new Map(entries.map((e, i) => [e.id, i]));
  const median = entries.length > 0 ? medianOf(entries) : 0;
  return { entries, index, median, bad };
}

type SortedField = ReturnType<typeof sortedField>;

/**
 * Rank a realm's rows on every ranked field once. Fields with fewer than MIN_REALM_SAMPLE values rank against
 * `platformRows` (which must include the realm's own nations) when given.
 */
export function buildRankTable(realmRows: RankRow[], platformRows?: RankRow[]): RankTable {
  const cache = new Map<RankedField, SortedField>();
  const fieldTable = (field: RankedField): SortedField => {
    let hit = cache.get(field);
    if (!hit) {
      const realmCount = realmRows.filter((r) => finite(r.values[field])).length;
      const rows = realmCount < MIN_REALM_SAMPLE && platformRows ? platformRows : realmRows;
      hit = sortedField(field, rows);
      cache.set(field, hit);
    }
    return hit;
  };
  return {
    position(field, countryId) {
      const t = fieldTable(field);
      const i = t.index.get(countryId);
      if (i === undefined) return null;
      const value = t.entries[i]!.value;
      const cmp = worseFirst(value, t.median, t.bad);
      return { index: i, n: t.entries.length, worseThanMedian: cmp < 0, betterThanMedian: cmp > 0 };
    },
  };
}

/** A `rank` trigger condition: is the nation among the worst (or best) share of its realm on `field`. */
export interface RankCondition {
  field: string;
  side?: RankSide;
  /** Overrides the severity band's share (0-1). An overridden condition skips the crisis floor. */
  share?: number;
}

export interface RankContext {
  ranks?: RankTable;
  /** The template's baseSeverity. */
  severity?: string;
}

function inBand(pos: RankPosition, side: RankSide, share: number): boolean {
  const quota = Math.max(1, Math.ceil(share * pos.n));
  const index = side === "worst" ? pos.index : pos.n - 1 - pos.index;
  const pastMedian = side === "worst" ? pos.worseThanMedian : pos.betterThanMedian;
  return index < quota && pastMedian;
}

/** Evaluate a `rank` condition for one nation (false when the field is unknown, the value missing or no table). */
export function evaluateRankCondition(
  cond: RankCondition,
  countryId: string,
  value: unknown,
  ctx: RankContext | undefined
): boolean {
  if (!isRankedField(cond.field) || !ctx?.ranks) return false;
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  const pos = ctx.ranks.position(cond.field, countryId);
  if (!pos) return false;
  const side = cond.side ?? "worst";
  const band = bandForSeverity(ctx.severity);
  const share = cond.share ?? BAND_SHARE[band];
  if (!inBand(pos, side, share)) return false;
  const needsFloor = side === "worst" && band === "crisis" && cond.share === undefined;
  return !needsFloor || passesCrisisFloor(cond.field, value);
}

/** The ranked fields a snapshot-like record holds, as a rank row. */
export function rankRowOf(snapshot: { id: string } & Partial<Record<RankedField, unknown>>): RankRow {
  const values: Partial<Record<RankedField, number>> = {};
  for (const field of Object.keys(RANKED_FIELDS) as RankedField[]) {
    const v = snapshot[field];
    if (typeof v === "number" && Number.isFinite(v)) values[field] = v;
  }
  return { id: snapshot.id, values };
}
