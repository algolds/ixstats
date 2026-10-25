/**
 * The one way to write a StorytellerEffect (`DmInputs`) row.
 *
 * - Every row is stamped with IxTime. `getActiveEffects` compares an effect's window with the
 *   country's IxTime baseline, so a wall-clock `new Date()` (2026) is years before every baseline
 *   (2040+) and the effect was silently dropped. A start before the IxTime epoch is refused.
 * - Only types an engine reads may be written (`WRITABLE_EFFECT_TYPES`). Growth-type effects
 *   (`gdp_adjustment`, `growth_rate_modifier`, `population_adjustment`) changed the single growth
 *   rate compounded since the baseline, so they rewrote the whole projected history and never
 *   expired; new effects are level shifts phased in over `duration` (owner decision 2).
 * - Level effects are never edited or deactivated, because either would rewrite the projected
 *   past. A level is moved by appending a delta row from now on (`syncLevelEffects`), and ending
 *   an effect appends the row that brings its level back to zero (`endStorytellerEffects`).
 */
import type { Prisma } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { StorytellerEffectType } from "./calculations";

type EffectDb = Pick<Prisma.TransactionClient, "storytellerEffect">;

/** Level types: the share in force phases in over `duration` IxTime years, then the full level is kept. */
export const LEVEL_EFFECT_TYPES: ReadonlySet<string> = new Set<string>([
  StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
  StorytellerEffectType.POPULATION_LEVEL_ADJUSTMENT,
  StorytellerEffectType.TRADE_AGREEMENT,
]);

/**
 * Types a new effect may carry: the level types, the two instant level types the projection
 * applies (`natural_disaster`, `special_event`), and the sports types `sports/team-rating.ts` reads.
 */
export const WRITABLE_EFFECT_TYPES: ReadonlySet<string> = new Set<string>([
  ...LEVEL_EFFECT_TYPES,
  StorytellerEffectType.NATURAL_DISASTER,
  StorytellerEffectType.SPECIAL_EVENT,
  "sports_saint_blessing",
  "sports_scandal",
]);

export interface StorytellerEffectDraft {
  countryId: string;
  inputType: string;
  value: number;
  description?: string | null;
  /** IxTime years: the phase-in of a level effect, or how long a sports effect lasts. */
  duration?: number | null;
  createdBy?: string | null;
  worldEventId?: string | null;
  /** IxTime (ms) the effect starts; defaults to IxTime now. */
  ixTime?: number;
}

/** The row data for a new effect. Throws on a pre-epoch (wall-clock) start or an unread type. */
export function storytellerEffectData(
  draft: StorytellerEffectDraft
): Prisma.StorytellerEffectCreateManyInput {
  const ixTime = draft.ixTime ?? IxTime.getCurrentIxTime();
  if (!Number.isFinite(ixTime) || ixTime < IxTime.getInGameEpoch()) {
    throw new Error(
      `StorytellerEffect start ${ixTime} is before the IxTime epoch: pass an IxTime, not a wall-clock date`
    );
  }
  const inputType = draft.inputType.toLowerCase();
  if (!WRITABLE_EFFECT_TYPES.has(inputType)) {
    throw new Error(`StorytellerEffect type "${draft.inputType}" is not read by any engine`);
  }
  if (!Number.isFinite(draft.value)) {
    throw new Error(`StorytellerEffect value ${draft.value} is not a finite number`);
  }
  return {
    countryId: draft.countryId,
    ixTimeTimestamp: new Date(ixTime),
    inputType,
    value: draft.value,
    description: draft.description ?? null,
    duration: draft.duration ?? null,
    isActive: true,
    createdBy: draft.createdBy ?? null,
    worldEventId: draft.worldEventId ?? null,
  };
}

export async function createStorytellerEffect(db: EffectDb, draft: StorytellerEffectDraft) {
  return db.storytellerEffect.create({ data: storytellerEffectData(draft) });
}

export async function createStorytellerEffects(
  db: EffectDb,
  drafts: StorytellerEffectDraft[]
): Promise<number> {
  if (drafts.length === 0) return 0;
  const result = await db.storytellerEffect.createMany({
    data: drafts.map((d) => storytellerEffectData(d)),
  });
  return result.count;
}

/** One stored level row, as `syncLevelEffects` reads it. */
export interface LevelRow {
  countryId: string | null;
  inputType: string;
  value: number;
  duration: number | null;
  description: string | null;
  createdBy: string | null;
  worldEventId: string | null;
}

/** The level a keyed effect should end up at once phased in (0.02 = +2%). */
export interface LevelTarget {
  countryId: string;
  inputType: string;
  value: number;
  duration: number | null;
  description: string;
  createdBy: string;
  worldEventId?: string | null;
}

const LEVEL_EPSILON = 1e-6;

function levelKey(row: {
  countryId: string | null;
  inputType: string;
  createdBy: string | null;
  worldEventId?: string | null;
}): string {
  return [row.countryId, row.inputType.toLowerCase(), row.createdBy, row.worldEventId ?? ""].join(
    "|"
  );
}

/** Level the rows reach once fully phased in: Π(1 + value) − 1 (the projection multiplies them). */
export function reachedLevel(rows: ReadonlyArray<Pick<LevelRow, "value">>): number {
  return rows.reduce((product, row) => product * (1 + row.value), 1) - 1;
}

/** Value of the row that takes a level from `reached` to `target`; 0 when it already is there. */
export function levelDelta(reached: number, target: number): number {
  const delta = Math.round(((1 + target) / (1 + reached) - 1) * 1e6) / 1e6;
  return Math.abs(delta) < LEVEL_EPSILON ? 0 : delta;
}

/**
 * The delta rows that move each keyed level among `existing` to its target. A key with rows but no
 * target goes back to 0 ("Ended: …"). Pure; `syncLevelEffects` writes the result.
 */
export function planLevelSync(
  existing: readonly LevelRow[],
  targets: readonly LevelTarget[]
): StorytellerEffectDraft[] {
  const groups = new Map<string, LevelRow[]>();
  for (const row of existing) {
    const key = levelKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const drafts: StorytellerEffectDraft[] = [];
  for (const target of targets) {
    const key = levelKey(target);
    const value = levelDelta(reachedLevel(groups.get(key) ?? []), target.value);
    groups.delete(key);
    if (value !== 0) drafts.push({ ...target, value });
  }
  for (const rows of groups.values()) {
    const first = rows[0]!;
    const value = levelDelta(reachedLevel(rows), 0);
    if (value === 0 || !first.countryId) continue;
    drafts.push({
      countryId: first.countryId,
      inputType: first.inputType,
      value,
      duration: Math.max(1, ...rows.map((r) => r.duration ?? 0)),
      description: `Ended: ${first.description ?? first.inputType}`,
      createdBy: first.createdBy,
      worldEventId: first.worldEventId,
    });
  }
  return drafts;
}

const LEVEL_ROW_SELECT = {
  countryId: true,
  inputType: true,
  value: true,
  duration: true,
  description: true,
  createdBy: true,
  worldEventId: true,
} as const;

async function loadLevelRows(
  db: EffectDb,
  where: Prisma.StorytellerEffectWhereInput
): Promise<LevelRow[]> {
  const rows = await db.storytellerEffect.findMany({
    where: { AND: [where, { isActive: true }] },
    select: LEVEL_ROW_SELECT,
    orderBy: { ixTimeTimestamp: "asc" },
  });
  return rows.filter((r) => LEVEL_EFFECT_TYPES.has(r.inputType.toLowerCase()));
}

/**
 * Moves every keyed level effect matching `where` to its target by appending delta rows that
 * start now (IxTime). Unchanged levels write nothing, so running it again is a no-op; a matching
 * key without a target is ended. Returns the number of rows written.
 */
export async function syncLevelEffects(
  db: EffectDb,
  where: Prisma.StorytellerEffectWhereInput,
  targets: readonly LevelTarget[],
  ixTime: number = IxTime.getCurrentIxTime()
): Promise<number> {
  const drafts = planLevelSync(await loadLevelRows(db, where), targets);
  return createStorytellerEffects(
    db,
    drafts.map((d) => ({ ...d, ixTime }))
  );
}

/**
 * Ends the effects matching `where` without rewriting the projected past: level effects get the
 * row that unwinds them from now on (phased over their own duration); any other type is
 * deactivated. Idempotent.
 */
export async function endStorytellerEffects(
  db: EffectDb,
  where: Prisma.StorytellerEffectWhereInput,
  ixTime: number = IxTime.getCurrentIxTime()
): Promise<number> {
  const written = await syncLevelEffects(db, where, [], ixTime);
  const levelTypes = [...LEVEL_EFFECT_TYPES];
  await db.storytellerEffect.updateMany({
    where: {
      AND: [
        where,
        { isActive: true },
        {
          NOT: levelTypes.map((t) => ({ inputType: { equals: t, mode: "insensitive" as const } })),
        },
      ],
    },
    data: { isActive: false },
  });
  return written;
}
