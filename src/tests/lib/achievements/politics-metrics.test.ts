/** @jest-environment node */
/**
 * Politics metrics: bills by recorded vote result, general elections (snap and first excluded),
 * cabinet meetings and officials, with real-time floors a 4x IxTime clock would clear early.
 */
import {
  cabinetLoader,
  councilMeetings,
  electionMetrics,
  electionsLoader,
  lawMetrics,
  lawsLoader,
  type BillRow,
  type ElectionRow,
} from "~/lib/achievements/metrics/politics";
import type { MetricContext } from "~/lib/achievements/metrics/registry";
import { MONTH_MS } from "~/lib/achievements/time-buckets";
import { IxTime } from "~/lib/ixtime";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const NOW = new Date("2027-03-01T12:00:00.000Z");
const START = new Date("2026-01-15T12:00:00.000Z").getTime();
const at4x = (real: Date) => new Date(START + (real.getTime() - START) * 4);

const bill = (passed: boolean | undefined, effectiveDate: Date | null, extra = {}): BillRow => ({
  effectiveDate,
  reviewNotes: JSON.stringify({
    ideologyTarget: 0,
    ...(passed === undefined ? {} : { voteResult: { passed, yesSeats: 5, noSeats: 4 } }),
    ...extra,
  }),
});
const month = (n: number) => new Date(Date.UTC(2026, n, 10, 12));

describe("law metrics", () => {
  it("counts passed bills and the different months they passed in: 6 qualifies, 5 does not", () => {
    const rows = [0, 1, 2, 3, 4, 5].map((n) => bill(true, month(n)));
    expect(lawMetrics(rows)).toEqual({ lawsPassed: 6, lawMonths: 6 });
    expect(lawMetrics(rows.slice(0, 5)).lawMonths).toBe(5);
    expect(lawMetrics([...rows.slice(0, 5), bill(true, month(4))])).toEqual({
      lawsPassed: 6,
      lawMonths: 5,
    });
  });

  it("leaves out failed votes, bills never voted on and unreadable notes", () => {
    const rows = [
      bill(false, null),
      bill(undefined, null),
      { effectiveDate: null, reviewNotes: null },
      { effectiveDate: null, reviewNotes: "not json" },
      { effectiveDate: null, reviewNotes: "null" },
    ];
    expect(lawMetrics(rows)).toEqual({ lawsPassed: 0, lawMonths: 0 });
  });

  it("counts a repealed law: the recorded vote result stays", () => {
    // status is not read: the bill row is returned by its vote result alone
    expect(lawMetrics([bill(true, month(1))]).lawsPassed).toBe(1);
  });

  it("falls back to the vote's IxTime mapped back to real time when effectiveDate is gone", () => {
    const voted = month(3);
    const rows = [bill(true, null, { votedIxTime: IxTime.convertToIxTime(voted.getTime()) })];
    expect(lawMetrics(rows)).toEqual({ lawsPassed: 1, lawMonths: 1 });
  });

  it("counts a passed bill with no usable time but gives it no month", () => {
    expect(lawMetrics([bill(true, null)])).toEqual({ lawsPassed: 1, lawMonths: 0 });
  });

  it("13 weekly bills span 4 real months, which the 4x clock would stretch past 6", () => {
    const real = Array.from({ length: 13 }, (_, i) => bill(true, new Date(START + i * WEEK)));
    const fast = real.map((b) => ({ ...b, effectiveDate: at4x(b.effectiveDate!) }));
    expect(lawMetrics(real).lawMonths).toBe(4);
    expect(lawMetrics(fast).lawMonths).toBeGreaterThanOrEqual(12);
  });
});

const election = (name: string, at: Date): ElectionRow => ({ name, completedAt: at });
const first = new Date("2025-09-01T12:00:00.000Z");
const later = (ms: number) => new Date(first.getTime() + ms);

describe("election metrics", () => {
  it("counts every completed election as held, snap included", () => {
    const rows = [
      election("First General Election (Year 2041)", first),
      election("Snap Election (Year 2042)", later(30 * DAY)),
    ];
    expect(electionMetrics(rows).electionsHeld).toBe(2);
    expect(electionMetrics([]).electionsHeld).toBe(0);
  });

  it("full term: a general election 18 months after the first qualifies, a millisecond short does not", () => {
    const rows = (ms: number) => [
      election("First General Election (Year 2041)", first),
      election("General Election (Year 2044)", later(ms)),
    ];
    expect(electionMetrics(rows(18 * MONTH_MS)).fullTerm).toBe(1);
    expect(electionMetrics(rows(18 * MONTH_MS - 1)).fullTerm).toBe(0);
  });

  it("full term ignores snap elections, the first election itself, and names that are not general elections", () => {
    const snapOnly = [
      election("First General Election (Year 2041)", first),
      election("Snap Election (Year 2045)", later(24 * MONTH_MS)),
    ];
    expect(electionMetrics(snapOnly).fullTerm).toBe(0);
    const adHoc = [
      election("First General Election (Year 2041)", first),
      election("2045 G.E", later(24 * MONTH_MS)),
    ];
    expect(electionMetrics(adHoc).fullTerm).toBe(0);
    expect(electionMetrics([election("First General Election (Year 2041)", first)]).fullTerm).toBe(
      0
    );
  });

  it("a snap election before the first regular one does not become the first", () => {
    const rows = (ms: number) => [
      election("Snap Election (Year 2040)", later(-30 * DAY)),
      election("First General Election (Year 2041)", first),
      election("General Election (Year 2044)", later(ms)),
    ];
    // 17.5 months after the first, but over 18 months after the snap
    expect(electionMetrics(rows(17.5 * MONTH_MS)).fullTerm).toBe(0);
    expect(electionMetrics(rows(18 * MONTH_MS)).fullTerm).toBe(1);
  });

  describe("peaceful transitions", () => {
    const generals = (spanMs: number) => [
      election("First General Election (Year 2041)", first),
      election("General Election (Year 2044)", later(10 * MONTH_MS)),
      election("General Election (Year 2047)", later(10 * MONTH_MS + spanMs)),
    ];

    it("counts the general elections when two or more span 3 years", () => {
      expect(electionMetrics(generals(36 * MONTH_MS)).peacefulTransitions).toBe(2);
    });

    it("is zero a millisecond short of 3 years, with one general election, or with snap ones only", () => {
      expect(electionMetrics(generals(36 * MONTH_MS - 1)).peacefulTransitions).toBe(0);
      expect(electionMetrics(generals(36 * MONTH_MS).slice(0, 2)).peacefulTransitions).toBe(0);
      const snaps = [
        election("First General Election (Year 2041)", first),
        election("Snap Election (Year 2042)", later(1 * MONTH_MS)),
        election("Snap Election (Year 2048)", later(50 * MONTH_MS)),
      ];
      expect(electionMetrics(snaps).peacefulTransitions).toBe(0);
    });
  });

  it("does not read 5 real months between elections as 20 on the 4x clock", () => {
    const rows = [
      election("First General Election (Year 2041)", first),
      election("General Election (Year 2042)", later(5 * MONTH_MS)),
    ];
    const fast = rows.map((r) => ({
      ...r,
      completedAt: new Date(first.getTime() + (r.completedAt.getTime() - first.getTime()) * 4),
    }));
    expect(electionMetrics(rows).fullTerm).toBe(0);
    expect(electionMetrics(fast).fullTerm).toBe(1);
  });
});

describe("council of state", () => {
  const meetings = (count: number, weeks: number) =>
    Array.from({ length: count }, (_, i) => new Date(START + (i % weeks) * WEEK));

  it("needs 25 meetings across 10 weeks: 24 meetings or 9 weeks give 0", () => {
    expect(councilMeetings(meetings(25, 10))).toBe(25);
    expect(councilMeetings(meetings(30, 12))).toBe(30);
    expect(councilMeetings(meetings(24, 10))).toBe(0);
    expect(councilMeetings(meetings(25, 9))).toBe(0);
  });

  it("25 meetings in 3 real weeks (12 on the 4x clock) clear nothing", () => {
    const real = Array.from({ length: 25 }, (_, i) => new Date(START + i * DAY));
    expect(councilMeetings(real)).toBe(0);
    expect(councilMeetings(real.map(at4x))).toBe(25);
  });
});

describe("loaders", () => {
  const ctx = (
    db: ReturnType<typeof createMockPrisma>,
    countryId: string | null = "c1"
  ): MetricContext => ({
    db: db as never,
    clerkUserId: "clerk",
    userId: "u1",
    countryId,
    now: NOW,
  });

  it("return zero for every key without a country, and query nothing", async () => {
    const db = createMockPrisma();
    for (const loader of [lawsLoader, electionsLoader, cabinetLoader]) {
      const result = await loader.load(ctx(db, null));
      expect(Object.keys(result).sort()).toEqual([...loader.keys].sort());
      expect(Object.values(result).every((v) => v === 0)).toBe(true);
    }
    expect(db.policy.findMany).not.toHaveBeenCalled();
    expect(db.election.findMany).not.toHaveBeenCalled();
    expect(db.cabinetMeeting.findMany).not.toHaveBeenCalled();
  });

  it("laws: bills of the country, prefiltered on a passed vote", async () => {
    const db = createMockPrisma();
    db.policy.findMany.mockResolvedValue([bill(true, month(1)), bill(true, month(2))]);
    const result = await lawsLoader.load(ctx(db));
    expect(db.policy.findMany.mock.calls[0]![0].where).toEqual({
      countryId: "c1",
      policyType: "legislative_bill",
      reviewNotes: { contains: '"passed":true' },
    });
    expect(result).toEqual({ lawsPassed: 2, lawMonths: 2 });
  });

  it("elections: completed ones, timed by their first result, else their last update", async () => {
    const db = createMockPrisma();
    db.election.findMany.mockResolvedValue([
      {
        name: "First General Election (Year 2041)",
        updatedAt: new Date("2027-02-01T00:00:00Z"),
        results: [{ createdAt: first }],
      },
      {
        name: "General Election (Year 2044)",
        updatedAt: later(18 * MONTH_MS),
        results: [],
      },
    ]);
    const result = await electionsLoader.load(ctx(db));
    expect(db.election.findMany.mock.calls[0]![0].where).toEqual({
      countryId: "c1",
      status: "completed",
    });
    expect(result).toEqual({ electionsHeld: 2, fullTerm: 1, peacefulTransitions: 0 });
  });

  it("cabinet: concluded meetings with a decision, and active officials by createdAt not appointedDate", async () => {
    const db = createMockPrisma();
    db.cabinetMeeting.findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({ completedAt: new Date(START + i * WEEK) }))
    );
    db.governmentOfficial.count.mockResolvedValue(5);

    const result = await cabinetLoader.load(ctx(db));

    expect(db.cabinetMeeting.findMany.mock.calls[0]![0].where).toEqual({
      countryId: "c1",
      status: "completed",
      completedAt: { not: null },
      decisions: { some: {} },
    });
    const officials = db.governmentOfficial.count.mock.calls[0]![0].where;
    expect(officials.isActive).toBe(true);
    expect(officials.createdAt).toEqual({ lte: new Date(NOW.getTime() - 6 * MONTH_MS) });
    expect(JSON.stringify(officials)).not.toContain("appointedDate");
    expect(officials.OR).toEqual([
      { governmentStructure: { countryId: "c1" } },
      { department: { governmentStructure: { countryId: "c1" } } },
    ]);
    expect(result).toEqual({ meetingsWithDecisions: 25, officials6m: 5 });
  });
});
