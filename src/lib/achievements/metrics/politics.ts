/**
 * Politics metrics (country scope): bills, general elections, cabinet meetings and officials.
 * Real time only: the vote, election and meeting instants are `DateTime`s, never IxTime floats.
 * Counts that need a floor are zeroed until it is met, so every rule reads one metric.
 */
import { IxTime } from "~/lib/ixtime";
import {
  MONTH_MS,
  distinctBuckets,
  monthKey,
  spanMs,
  weekKey,
} from "~/lib/achievements/time-buckets";
import type { MetricLoader } from "./registry";
import { zeroed } from "./zeroed";

const LAW_KEYS = ["lawsPassed", "lawMonths"] as const;
const ELECTION_KEYS = ["electionsHeld", "fullTerm", "peacefulTransitions"] as const;
const CABINET_KEYS = ["meetingsWithDecisions", "officials6m"] as const;

const FULL_TERM_MS = 18 * MONTH_MS;
const TRANSITIONS_SPAN_MS = 36 * MONTH_MS;
const SERVICE_MS = 6 * MONTH_MS;
const COUNCIL_MIN_MEETINGS = 25;
const COUNCIL_MIN_WEEKS = 10;

/** What a bill vote leaves in `Policy.reviewNotes` (see the legislation router). */
interface BillNotes {
  voteResult?: { passed?: boolean };
  votedIxTime?: number;
}

export interface BillRow {
  effectiveDate: Date | null;
  reviewNotes: string | null;
}

function parseNotes(reviewNotes: string | null): BillNotes | null {
  if (!reviewNotes) return null;
  try {
    return JSON.parse(reviewNotes) as BillNotes | null;
  } catch {
    return null;
  }
}

/**
 * Bills passed by their recorded vote result, so a later repeal or expiry still counts. The vote's
 * real time is `effectiveDate` (set when it passed), else the IxTime of the vote mapped back.
 */
export function lawMetrics(rows: BillRow[]): Record<(typeof LAW_KEYS)[number], number> {
  const passed = rows.flatMap((row) => {
    const notes = parseNotes(row.reviewNotes);
    if (notes?.voteResult?.passed !== true) return [];
    const votedAt =
      row.effectiveDate ??
      (notes.votedIxTime === undefined
        ? null
        : new Date(IxTime.convertFromIxTime(notes.votedIxTime)));
    return [votedAt];
  });
  return {
    lawsPassed: passed.length,
    lawMonths: distinctBuckets(
      passed.flatMap((d) => (d ? [d] : [])),
      monthKey
    ),
  };
}

export const lawsLoader: MetricLoader = {
  id: "politics-laws",
  scope: "country",
  keys: LAW_KEYS,
  async load({ db, countryId }) {
    if (!countryId) return zeroed(LAW_KEYS);
    const rows = await db.policy.findMany({
      where: {
        countryId,
        policyType: "legislative_bill",
        reviewNotes: { contains: '"passed":true' },
      },
      select: { effectiveDate: true, reviewNotes: true },
    });
    return lawMetrics(rows);
  },
};

export interface ElectionRow {
  name: string;
  /** When the election was completed (its first result row, else its last update). */
  completedAt: Date;
}

const isSnap = (name: string) => /^snap election/i.test(name);
const isGeneral = (name: string) => /^general election/i.test(name);

/**
 * The kind of an election lives only in its name. The first election is the earliest completed
 * one that is not a snap; later "General Election" rows are the general elections (snap and first
 * excluded). Full term and peaceful transitions read those.
 */
export function electionMetrics(
  rows: ElectionRow[]
): Record<(typeof ELECTION_KEYS)[number], number> {
  const regular = rows
    .filter((row) => !isSnap(row.name))
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
  const first = regular[0];
  const generals = regular.slice(1).filter((row) => isGeneral(row.name));
  const generalTimes = generals.map((row) => row.completedAt);
  return {
    electionsHeld: rows.length,
    fullTerm: Number(
      first !== undefined &&
        generals.some((g) => g.completedAt.getTime() - first.completedAt.getTime() >= FULL_TERM_MS)
    ),
    peacefulTransitions: spanMs(generalTimes) >= TRANSITIONS_SPAN_MS ? generals.length : 0,
  };
}

export const electionsLoader: MetricLoader = {
  id: "politics-elections",
  scope: "country",
  keys: ELECTION_KEYS,
  async load({ db, countryId }) {
    if (!countryId) return zeroed(ELECTION_KEYS);
    const rows = await db.election.findMany({
      where: { countryId, status: "completed" },
      select: {
        name: true,
        updatedAt: true,
        results: { select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 },
      },
    });
    return electionMetrics(
      rows.map((row) => ({
        name: row.name,
        completedAt: row.results[0]?.createdAt ?? row.updatedAt,
      }))
    );
  },
};

/** Meetings concluded with a decision count only when they are spread over enough different weeks. */
export function councilMeetings(completedAt: Date[]): number {
  return completedAt.length >= COUNCIL_MIN_MEETINGS &&
    distinctBuckets(completedAt, weekKey) >= COUNCIL_MIN_WEEKS
    ? completedAt.length
    : 0;
}

export const cabinetLoader: MetricLoader = {
  id: "politics-cabinet",
  scope: "country",
  keys: CABINET_KEYS,
  async load({ db, countryId, now }) {
    if (!countryId) return zeroed(CABINET_KEYS);
    const [meetings, officials] = await Promise.all([
      db.cabinetMeeting.findMany({
        where: {
          countryId,
          status: "completed",
          completedAt: { not: null },
          decisions: { some: {} },
        },
        select: { completedAt: true },
      }),
      // createdAt, not the user-typed appointedDate, which can be back-dated.
      db.governmentOfficial.count({
        where: {
          isActive: true,
          createdAt: { lte: new Date(now.getTime() - SERVICE_MS) },
          OR: [
            { governmentStructure: { countryId } },
            { department: { governmentStructure: { countryId } } },
          ],
        },
      }),
    ]);
    return {
      meetingsWithDecisions: councilMeetings(
        meetings.flatMap((m) => (m.completedAt ? [m.completedAt] : []))
      ),
      officials6m: officials,
    };
  },
};

export const POLITICS_LOADERS: MetricLoader[] = [lawsLoader, electionsLoader, cabinetLoader];
