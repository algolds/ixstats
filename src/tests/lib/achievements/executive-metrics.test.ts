/** @jest-environment node */
/**
 * Executive metrics: each key at its boundary and threshold, real-time floors that an IxTime clock
 * running 4x would clear early, and the loaders' queries.
 */
import {
  brokersLoader,
  budgetLoader,
  directiveMetrics,
  directivesLoader,
  fiscalStewardFlag,
  fiscalWindowYears,
  issueMetrics,
  issuesLoader,
  type DirectiveRow,
  type IssueRow,
} from "~/lib/achievements/metrics/executive";
import type { MetricContext } from "~/lib/achievements/metrics/registry";
import { MONTH_MS } from "~/lib/achievements/time-buckets";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const NOW = new Date("2027-03-01T12:00:00.000Z");
const START = new Date("2026-06-01T12:00:00.000Z").getTime();
/** The clock the old IxTime-based checks would have read: 4x real elapsed time. */
const at4x = (real: Date) => new Date(START + (real.getTime() - START) * 4);

/** `count` dates spread evenly over `weeks` different weeks, starting at `from`. */
const spread = (count: number, weeks: number, from = START) =>
  Array.from({ length: count }, (_, i) => new Date(from + (i % weeks) * WEEK));

function issues(dates: Date[], over: Partial<IssueRow> = {}): IssueRow[] {
  return dates.map((respondedAt, i) => ({
    id: `i${i}-${over.domain ?? "d"}`,
    domain: "political",
    severity: "medium",
    createdAt: respondedAt,
    respondedAt,
    ...over,
  }));
}

const NO_NET = new Map<string, number>();
const issueInput = (
  answered: IssueRow[],
  extra: { raised?: number; net?: Map<string, number> } = {}
) =>
  issueMetrics({
    answered,
    raisedInWindow: extra.raised ?? 0,
    criticalStabilityNet: extra.net ?? NO_NET,
    now: NOW,
  });

function directive(i: number, over: Partial<DirectiveRow> = {}): DirectiveRow {
  const at = new Date(START + i * WEEK);
  return {
    id: `d${i}`,
    category: "fiscal",
    status: "active",
    parentId: null,
    createdAt: at,
    updatedAt: at,
    ...over,
  };
}

describe("directive metrics", () => {
  it("counts committed directives and leaves proposed drafts out", () => {
    const rows = [
      directive(0),
      directive(1, { status: "completed" }),
      directive(2, { status: "abandoned" }),
      directive(3, { status: "proposed" }),
    ];
    expect(directiveMetrics(rows).directivesCommitted).toBe(3);
  });

  it("counts the different weeks directives were committed in: 12 qualifies, 11 does not", () => {
    const week = (n: number) => Array.from({ length: n }, (_, i) => directive(i));
    expect(directiveMetrics(week(12)).directiveWeeks).toBe(12);
    expect(directiveMetrics(week(11)).directiveWeeks).toBe(11);
    expect(directiveMetrics([directive(0), directive(0, { id: "again" })]).directiveWeeks).toBe(1);
  });

  const categories = ["defense", "fiscal", "economy", "social", "infrastructure", "security"];
  const completed = (n: number, weeks: number) =>
    categories
      .slice(0, n)
      .map((category, i) => directive(i % weeks, { id: `c${i}`, category, status: "completed" }));

  it("counts completed categories only when the completions span 4 or more weeks", () => {
    expect(directiveMetrics(completed(6, 4)).directivesCompletedCategories).toBe(6);
    expect(directiveMetrics(completed(5, 4)).directivesCompletedCategories).toBe(5);
    expect(directiveMetrics(completed(6, 3)).directivesCompletedCategories).toBe(0);
  });

  it("measures the longest chain in which every directive is completed", () => {
    const chain = (statuses: string[]) =>
      statuses.map((status, i) =>
        directive(i, { id: `n${i}`, status, parentId: i === 0 ? null : `n${i - 1}` })
      );
    expect(
      directiveMetrics(chain(["completed", "completed", "completed", "completed"]))
        .directiveChainDepth
    ).toBe(4);
    expect(
      directiveMetrics(chain(["completed", "completed", "completed"])).directiveChainDepth
    ).toBe(3);
    expect(
      directiveMetrics(chain(["completed", "completed", "active", "completed"])).directiveChainDepth
    ).toBe(2);
    expect(directiveMetrics([directive(0, { status: "completed" })]).directiveChainDepth).toBe(1);
    expect(directiveMetrics([]).directiveChainDepth).toBe(0);
  });

  it("survives a parent cycle", () => {
    const a = directive(0, { id: "a", status: "completed", parentId: "b" });
    const b = directive(1, { id: "b", status: "completed", parentId: "a" });
    expect(directiveMetrics([a, b]).directiveChainDepth).toBe(2);
  });

  describe("discipline", () => {
    const run = (committed: number, weeks: number, abandoned: number) =>
      directiveMetrics(
        Array.from({ length: committed }, (_, i) =>
          directive(i % weeks, {
            id: `x${i}`,
            status: i < abandoned ? "abandoned" : "active",
          })
        )
      ).directivesDisciplineOk;

    it("needs 30 committed across 10 weeks with at most 10% abandoned", () => {
      expect(run(30, 10, 3)).toBe(1);
      expect(run(30, 10, 4)).toBe(0);
      expect(run(29, 10, 0)).toBe(0);
      expect(run(30, 9, 0)).toBe(0);
    });
  });
});

describe("issue metrics", () => {
  it("counts answered issues and applies the real-week floors at 100/12 and 250/26", () => {
    expect(issueInput(issues(spread(100, 12)))).toMatchObject({
      issuesAnswered: 100,
      issues100Over12Weeks: 1,
      issues250Over26Weeks: 0,
    });
    expect(issueInput(issues(spread(99, 12))).issues100Over12Weeks).toBe(0);
    expect(issueInput(issues(spread(100, 11))).issues100Over12Weeks).toBe(0);
    expect(issueInput(issues(spread(250, 26))).issues250Over26Weeks).toBe(1);
    expect(issueInput(issues(spread(249, 26))).issues250Over26Weeks).toBe(0);
    expect(issueInput(issues(spread(250, 25))).issues250Over26Weeks).toBe(0);
  });

  it("counts the domains with 15 or more answered: 7 qualifies, one at 14 does not", () => {
    const domains = [
      "political",
      "diplomatic",
      "military",
      "environmental",
      "social",
      "infrastructure",
      "economic",
    ];
    const make = (short?: string) =>
      domains.flatMap((domain) => issues(spread(domain === short ? 14 : 15, 3), { domain }));
    expect(issueInput(make()).issueDomainsAt15).toBe(7);
    expect(issueInput(make("economic")).issueDomainsAt15).toBe(6);
  });

  describe("critical stable gains", () => {
    const critical = (n: number) => issues(spread(n, 3), { severity: "critical" });

    it("counts critical answers whose net stability change is zero or better, and a missing change passes", () => {
      const rows = critical(4);
      const net = new Map([
        [rows[0]!.id, 2],
        [rows[1]!.id, 0],
        [rows[2]!.id, -0.5],
      ]);
      expect(issueInput(rows, { net }).criticalStableGains).toBe(3);
    });

    it("reads both casings of the severity and ignores other severities", () => {
      const rows = [
        ...critical(2),
        ...issues(spread(2, 1), { severity: "CRITICAL", domain: "other" }),
        ...issues(spread(5, 1), { severity: "high", domain: "other2" }),
      ];
      expect(issueInput(rows).criticalStableGains).toBe(4);
    });
  });

  describe("coverage over the trailing 6 months", () => {
    const recent = new Date(NOW.getTime() - 30 * DAY);
    const old = new Date(NOW.getTime() - 220 * DAY);
    const answeredCreated = (n: number, createdAt: Date) =>
      issues(
        Array.from({ length: n }, () => recent),
        { createdAt }
      );

    it("needs 100 raised and 90% answered: 90 of 100 passes, 89 of 100 and 90 of 99 do not", () => {
      expect(issueInput(answeredCreated(90, recent), { raised: 100 }).issueCoverage6mOk).toBe(1);
      expect(issueInput(answeredCreated(89, recent), { raised: 100 }).issueCoverage6mOk).toBe(0);
      expect(issueInput(answeredCreated(90, recent), { raised: 99 }).issueCoverage6mOk).toBe(0);
    });

    it("counts dismissed and unanswered issues against, since they are raised but not answered", () => {
      // 100 raised: 85 answered, 15 dismissed or auto-resolved
      expect(issueInput(answeredCreated(85, recent), { raised: 100 }).issueCoverage6mOk).toBe(0);
    });

    it("does not credit answers to issues raised before the window", () => {
      const rows = [...answeredCreated(50, recent), ...answeredCreated(50, old)];
      expect(issueInput(rows, { raised: 100 }).issueCoverage6mOk).toBe(0);
    });
  });

  it("finds the longest run of consecutive weeks with an answer", () => {
    const run = (weeks: number[]) =>
      issueInput(issues(weeks.map((w) => new Date(START + w * WEEK)))).issueLongestWeeks;
    expect(run(Array.from({ length: 26 }, (_, i) => i))).toBe(26);
    expect(run(Array.from({ length: 25 }, (_, i) => i))).toBe(25);
    expect(
      run([
        ...Array.from({ length: 13 }, (_, i) => i),
        ...Array.from({ length: 13 }, (_, i) => i + 14),
      ])
    ).toBe(13);
  });
});

describe("a clock running 4x does not clear a real-time floor", () => {
  // Real spans below; the same events read off an IxTime clock at 4x would clear every floor.
  it("issues: 7 real weeks of answers read as 28 weeks on the 4x clock, and clear nothing", () => {
    const real = issues(
      Array.from({ length: 250 }, (_, i) => new Date(START + (i * 49 * DAY) / 250))
    );
    const fast = issues(real.map((i) => at4x(i.respondedAt!)));
    expect(issueInput(fast)).toMatchObject({ issues100Over12Weeks: 1, issues250Over26Weeks: 1 });
    expect(issueInput(real)).toMatchObject({
      issuesAnswered: 250,
      issues100Over12Weeks: 0,
      issues250Over26Weeks: 0,
    });
    expect(issueInput(real).issueLongestWeeks).toBeLessThan(10);
    expect(issueInput(fast).issueLongestWeeks).toBeGreaterThanOrEqual(26);
  });

  it("directives: 30 commits over 5 real weeks read as 17 weeks on the 4x clock, and clear nothing", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      directive(0, { id: `r${i}`, createdAt: new Date(START + i * DAY) })
    );
    const fast = rows.map((d) => ({ ...d, createdAt: at4x(d.createdAt) }));
    expect(directiveMetrics(fast)).toMatchObject({ directivesDisciplineOk: 1 });
    expect(directiveMetrics(rows)).toMatchObject({ directiveWeeks: 5, directivesDisciplineOk: 0 });
  });
});

describe("fiscal steward", () => {
  const covered = new Set([2040, 2041, 2042, 2043]);
  const owned = (months: number) => new Date(NOW.getTime() - months * MONTH_MS);

  it("maps budget years to real dates: the 18 months before March 2027 touch years 2040 to 2043", () => {
    expect(fiscalWindowYears(NOW)).toEqual([2040, 2041, 2042, 2043]);
  });

  it("is 1 with every overlapping year budgeted and the nation owned for 18 months", () => {
    expect(fiscalStewardFlag(NOW, covered, owned(18))).toBe(1);
    expect(fiscalStewardFlag(NOW, covered, owned(40))).toBe(1);
  });

  it("is 0 when the nation was claimed 17 months ago, or the ownership date is unknown", () => {
    expect(fiscalStewardFlag(NOW, covered, owned(17))).toBe(0);
    expect(fiscalStewardFlag(NOW, covered, new Date(owned(18).getTime() + 1))).toBe(0);
    expect(fiscalStewardFlag(NOW, covered, null)).toBe(0);
  });

  it("is 0 when a year has no allocation", () => {
    expect(fiscalStewardFlag(NOW, new Set([2040, 2041, 2043]), owned(30))).toBe(0);
  });

  it("is 0 while the window still reaches back before the mapped years", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(fiscalWindowYears(now)[0]).toBeLessThan(2040);
    expect(fiscalStewardFlag(now, new Set([2040, 2041, 2042]), new Date("2020-01-01Z"))).toBe(0);
  });
});

describe("loaders", () => {
  function ctx(
    db: ReturnType<typeof createMockPrisma>,
    countryId: string | null = "c1"
  ): MetricContext {
    return { db: db as never, clerkUserId: "clerk", userId: "u1", countryId, now: NOW };
  }

  it("return zero for every key without a country, and query nothing", async () => {
    const db = createMockPrisma();
    for (const loader of [directivesLoader, issuesLoader, brokersLoader, budgetLoader]) {
      const result = await loader.load(ctx(db, null));
      expect(Object.keys(result).sort()).toEqual([...loader.keys].sort());
      expect(Object.values(result).every((v) => v === 0)).toBe(true);
    }
    expect(db.intent.findMany).not.toHaveBeenCalled();
    expect(db.nationalIssue.findMany).not.toHaveBeenCalled();
  });

  it("directives: one query for committed rows", async () => {
    const db = createMockPrisma();
    db.intent.findMany.mockResolvedValue([directive(0, { status: "completed" })]);
    const result = await directivesLoader.load(ctx(db));
    expect(db.intent.findMany).toHaveBeenCalledTimes(1);
    expect(db.intent.findMany.mock.calls[0]![0].where).toEqual({
      countryId: "c1",
      status: { in: ["active", "completed", "abandoned"] },
    });
    expect(result).toMatchObject({ directivesCommitted: 1, directiveChainDepth: 1 });
  });

  it("issues: answered rows only, the 6 month raised count, and stability sums of critical answers", async () => {
    const db = createMockPrisma();
    const rows = issues(spread(3, 1), { severity: "critical" });
    db.nationalIssue.findMany.mockResolvedValue(rows);
    db.nationalIssue.count.mockResolvedValue(10);
    db.nationalIssueConsequence.groupBy.mockResolvedValue([
      { issueId: rows[0]!.id, _sum: { deltaValue: -2 } },
      { issueId: rows[1]!.id, _sum: { deltaValue: null } },
    ]);

    const result = await issuesLoader.load(ctx(db));

    expect(db.nationalIssue.findMany.mock.calls[0]![0].where).toEqual({
      countryId: "c1",
      status: "responded",
    });
    expect(db.nationalIssue.count.mock.calls[0]![0].where).toEqual({
      countryId: "c1",
      createdAt: { gte: new Date(NOW.getTime() - 6 * MONTH_MS) },
    });
    expect(db.nationalIssueConsequence.groupBy.mock.calls[0]![0].where).toMatchObject({
      targetModel: "InternalStabilityMetrics",
      targetField: "stabilityScore",
      issue: { countryId: "c1", status: "responded", severity: { in: ["critical", "CRITICAL"] } },
    });
    expect(result).toMatchObject({ issuesAnswered: 3, criticalStableGains: 2 });
  });

  it("brokers: counts the brokers the live components and budget satisfy", async () => {
    const db = createMockPrisma();
    db.governmentComponent.findMany.mockResolvedValue([
      { componentType: "MILITARY_ADMINISTRATION" },
      { componentType: "RELIGIOUS_LEGITIMACY" },
      { componentType: "TECHNOCRATIC_PROCESS" },
    ]);
    db.budgetAllocation.findFirst.mockResolvedValue({ budgetYear: 2043 });
    db.budgetAllocation.findMany.mockResolvedValue([
      { allocatedPercent: 20, department: { category: "Defense" } },
      { allocatedPercent: 10, department: { category: "Culture" } },
      { allocatedPercent: 5, department: { category: "Culture" } },
      { allocatedPercent: 30, department: { category: "Education" } },
    ]);

    const result = await brokersLoader.load(ctx(db));

    // generals (Defense 20 >= 15) and clergy (Culture 15 >= 15); technocrats lack their agencies
    expect(result).toEqual({ brokersSatisfied: 2 });
    expect(db.budgetAllocation.findFirst.mock.calls[0]![0].where.budgetYear).toEqual({ lte: 2043 });
  });

  describe("budget", () => {
    function budgetDb(ownedSince: Date | null | undefined) {
      const db = createMockPrisma();
      db.budgetAllocation.count.mockResolvedValue(4);
      // Rows the builder just rewrote are fine: only the year is read, never createdAt.
      db.budgetAllocation.groupBy.mockResolvedValue(
        [2040, 2041, 2042, 2043].map((budgetYear) => ({ budgetYear }))
      );
      db.country.findUnique.mockResolvedValue(ownedSince === undefined ? null : { ownedSince });
      return db;
    }
    const months = (n: number) => new Date(NOW.getTime() - n * MONTH_MS);

    it("counts this game year's allocations and flags covered years of an 18 month owner", async () => {
      const db = budgetDb(months(20));

      const result = await budgetLoader.load(ctx(db));

      expect(result).toEqual({ budgetCurrentYear: 4, fiscalSteward18m: 1 });
      expect(db.budgetAllocation.count.mock.calls[0]![0].where).toEqual({
        governmentStructure: { countryId: "c1" },
        budgetYear: 2043,
      });
      const grouped = db.budgetAllocation.groupBy.mock.calls[0]![0];
      expect(grouped.where.budgetYear).toEqual({ gte: 2040, lte: 2043 });
      expect(grouped._min).toBeUndefined();
      expect(db.country.findUnique.mock.calls[0]![0]).toEqual({
        where: { id: "c1" },
        select: { ownedSince: true },
      });
    });

    it("withholds the flag for a 17 month owner, an unknown ownership date or a missing country row", async () => {
      for (const ownedSince of [months(17), null, undefined]) {
        const result = await budgetLoader.load(ctx(budgetDb(ownedSince)));
        expect(result).toEqual({ budgetCurrentYear: 4, fiscalSteward18m: 0 });
      }
    });
  });
});
