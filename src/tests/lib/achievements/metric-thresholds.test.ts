/** @jest-environment node */
/**
 * Achievement thresholds, one table per metric family: each row is one rule a real player meets or misses, at the
 * boundary, and every duration is real time (UTC, ISO weeks, real months), so a clock running 4x (an IxTime realm)
 * clears no floor early. The definitions table checks the catalogue itself: every achievement can unlock, reads a
 * metric its scope's loaders produce, and unlocks exactly at its threshold.
 *
 * Folds executive-metrics, politics-metrics, platform-metrics, nation-metrics, time-buckets,
 * executive-politics-definitions, platform-definitions, custom-conditions and metric-registry's definition cases.
 * Payouts (paid once, recruiting pays nothing, Legacy never unlocks) are scenarios/noncore/achievement-payouts.
 */
import { ACHIEVEMENT_ICON_MAP } from "~/components/achievements/constants";
import type {
  AchievementDefinition,
  ExtendedAchievementData,
} from "~/lib/achievements/definitions";
import {
  directiveMetrics,
  fiscalStewardFlag,
  issueMetrics,
  type DirectiveRow,
  type IssueRow,
} from "~/lib/achievements/metrics/executive";
import { isIdentityComplete, ownedMonths } from "~/lib/achievements/metrics/nation";
import {
  effectiveClaimStreak,
  longestDayRun,
  PLATFORM_LOADERS,
} from "~/lib/achievements/metrics/platform";
import {
  councilMeetings,
  electionMetrics,
  lawMetrics,
  type BillRow,
  type ElectionRow,
} from "~/lib/achievements/metrics/politics";
import { METRIC_LOADERS } from "~/lib/achievements/metrics/registry";
import { achievementRequiresCountry } from "~/lib/achievements/scope";
import { achievementService } from "~/lib/achievements/service";
import { ALL_DEFINITIONS } from "~/lib/achievements/sets";
import { EXECUTIVE_DEFINITIONS } from "~/lib/achievements/sets/executive";
import { PLATFORM_DEFINITIONS } from "~/lib/achievements/sets/platform";
import { POLITICS_DEFINITIONS } from "~/lib/achievements/sets/politics";
import {
  distinctBuckets,
  longestConsecutiveWeeks,
  MONTH_MS,
  monthKey,
  spanMs,
  weekKey,
} from "~/lib/achievements/time-buckets";
import { IxTime } from "~/lib/ixtime";

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const NOW = new Date("2027-03-01T12:00:00.000Z");
const START = new Date("2026-06-01T12:00:00.000Z").getTime();
const utc = (iso: string) => new Date(`${iso}T12:00:00.000Z`);
type Row = readonly [string, () => number | boolean, number | boolean];

// --- Executive ------------------------------------------------------------------------------------------------------

/** `count` dates spread over `weeks` different weeks from START. */
const spread = (count: number, weeks: number) =>
  Array.from({ length: count }, (_, i) => new Date(START + (i % weeks) * WEEK));

const issues = (dates: Date[], over: Partial<IssueRow> = {}): IssueRow[] =>
  dates.map((respondedAt, i) => ({
    id: `i${i}-${over.domain ?? "d"}`,
    domain: "political",
    severity: "medium",
    createdAt: respondedAt,
    respondedAt,
    ...over,
  }));

const issueOf = (answered: IssueRow[], raised = 0, net = new Map<string, number>()) =>
  issueMetrics({ answered, raisedInWindow: raised, criticalStabilityNet: net, now: NOW });

const directive = (i: number, over: Partial<DirectiveRow> = {}): DirectiveRow => {
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
};

/** `committed` directives over `weeks` weeks, the first `abandoned` of them abandoned. */
const discipline = (committed: number, weeks: number, abandoned: number) =>
  directiveMetrics(
    Array.from({ length: committed }, (_, i) =>
      directive(i % weeks, { id: `x${i}`, status: i < abandoned ? "abandoned" : "active" })
    )
  ).directivesDisciplineOk;

const chain = (statuses: string[]) =>
  directiveMetrics(
    statuses.map((status, i) =>
      directive(i, { id: `n${i}`, status, parentId: i === 0 ? null : `n${i - 1}` })
    )
  ).directiveChainDepth;

const SEVEN_DOMAINS = [
  "political",
  "diplomatic",
  "military",
  "environmental",
  "social",
  "infrastructure",
  "economic",
];
const recent = new Date(NOW.getTime() - 30 * DAY);
const answeredCreated = (n: number, createdAt: Date) =>
  issues(
    Array.from({ length: n }, () => recent),
    { createdAt }
  );
/** 250 answers over 7 real weeks (28 weeks on a 4x IxTime clock). */
const sevenRealWeeks = issues(
  Array.from({ length: 250 }, (_, i) => new Date(START + (i * 49 * DAY) / 250))
);
const thirtyIn5RealWeeks = Array.from({ length: 30 }, (_, i) =>
  directive(0, { id: `r${i}`, createdAt: new Date(START + i * DAY) })
);
const FISCAL_YEARS = new Set([2040, 2041, 2042, 2043]);
const ownedFor = (months: number) => new Date(NOW.getTime() - months * MONTH_MS);

const EXECUTIVE: Row[] = [
  [
    "committed directives leave proposed drafts out",
    () =>
      directiveMetrics([
        directive(0),
        directive(1, { status: "completed" }),
        directive(2, { status: "abandoned" }),
        directive(3, { status: "proposed" }),
      ]).directivesCommitted,
    3,
  ],
  [
    "six categories completed within 3 weeks count none",
    () =>
      directiveMetrics(
        ["defense", "fiscal", "economy", "social", "infrastructure", "security"].map(
          (category, i) => directive(i % 3, { id: `c${i}`, category, status: "completed" })
        )
      ).directivesCompletedCategories,
    0,
  ],
  [
    "a directive chain stops at its first unfinished link",
    () => chain(["completed", "completed", "active", "completed"]),
    2,
  ],
  ["discipline: 30 over 10 weeks with 3 abandoned holds", () => discipline(30, 10, 3), 1],
  ["discipline: a fourth abandoned breaks it", () => discipline(30, 10, 4), 0],
  [
    "100 issues over 12 weeks clear the floor",
    () => issueOf(issues(spread(100, 12))).issues100Over12Weeks,
    1,
  ],
  [
    "100 issues over 11 weeks do not",
    () => issueOf(issues(spread(100, 11))).issues100Over12Weeks,
    0,
  ],
  [
    "a domain at 14 answers drops out of the domains at 15",
    () =>
      issueOf(
        SEVEN_DOMAINS.flatMap((domain) =>
          issues(spread(domain === "economic" ? 14 : 15, 3), { domain })
        )
      ).issueDomainsAt15,
    6,
  ],
  [
    "critical answers count when net stability held (a missing change passes, CRITICAL too)",
    () => {
      const rows = [
        ...issues(spread(4, 3), { severity: "critical" }),
        ...issues(spread(1, 1), { severity: "CRITICAL", domain: "x" }),
        ...issues(spread(3, 1), { severity: "high", domain: "y" }),
      ];
      return issueOf(
        rows,
        0,
        new Map([
          [rows[0]!.id, 2],
          [rows[1]!.id, 0],
          [rows[2]!.id, -0.5],
        ])
      ).criticalStableGains;
    },
    4,
  ],
  [
    "coverage: 90 of 100 raised in 6 months answered holds",
    () => issueOf(answeredCreated(90, recent), 100).issueCoverage6mOk,
    1,
  ],
  [
    "coverage: answers to issues raised before the window do not count",
    () =>
      issueOf(
        [
          ...answeredCreated(50, recent),
          ...answeredCreated(50, new Date(NOW.getTime() - 220 * DAY)),
        ],
        100
      ).issueCoverage6mOk,
    0,
  ],
  [
    "250 answers in 7 real weeks clear no 26-week floor",
    () => issueOf(sevenRealWeeks).issues250Over26Weeks,
    0,
  ],
  [
    "30 directives in 5 real weeks clear no discipline floor",
    () => directiveMetrics(thirtyIn5RealWeeks).directivesDisciplineOk,
    0,
  ],
  [
    "fiscal steward: every year budgeted and 18 months owned",
    () => fiscalStewardFlag(NOW, FISCAL_YEARS, ownedFor(18)),
    1,
  ],
  [
    "fiscal steward: a millisecond short of 18 months",
    () => fiscalStewardFlag(NOW, FISCAL_YEARS, new Date(ownedFor(18).getTime() + 1)),
    0,
  ],
];

// --- Politics -------------------------------------------------------------------------------------------------------

const bill = (passed: boolean | undefined, effectiveDate: Date | null, extra = {}): BillRow => ({
  effectiveDate,
  reviewNotes: JSON.stringify({
    ideologyTarget: 0,
    ...(passed === undefined ? {} : { voteResult: { passed, yesSeats: 5, noSeats: 4 } }),
    ...extra,
  }),
});
const month = (n: number) => new Date(Date.UTC(2026, n, 10, 12));
const FIRST = new Date("2025-09-01T12:00:00.000Z");
const after = (ms: number) => new Date(FIRST.getTime() + ms);
const election = (name: string, completedAt: Date): ElectionRow => ({ name, completedAt });
const firstGeneral = election("First General Election (Year 2041)", FIRST);
const generals = (spanMs: number) => [
  firstGeneral,
  election("General Election (Year 2044)", after(10 * MONTH_MS)),
  election("General Election (Year 2047)", after(10 * MONTH_MS + spanMs)),
];

const POLITICS: Row[] = [
  [
    "failed votes, bills never voted on and unreadable notes pass no law",
    () =>
      lawMetrics([
        bill(false, null),
        bill(undefined, null),
        { effectiveDate: null, reviewNotes: "not json" },
        { effectiveDate: null, reviewNotes: null },
      ]).lawsPassed,
    0,
  ],
  [
    "a bill without its effective date falls back to the vote's IxTime, mapped to real time",
    () =>
      lawMetrics([bill(true, null, { votedIxTime: IxTime.convertToIxTime(month(3).getTime()) })])
        .lawMonths,
    1,
  ],
  [
    "13 weekly bills from mid-January span 4 real months",
    () =>
      lawMetrics(
        Array.from({ length: 13 }, (_, i) =>
          bill(true, new Date(Date.UTC(2026, 0, 15, 12) + i * WEEK))
        )
      ).lawMonths,
    4,
  ],
  [
    "full term: a general election 18 months after the first",
    () =>
      electionMetrics([
        firstGeneral,
        election("General Election (Year 2044)", after(18 * MONTH_MS)),
      ]).fullTerm,
    1,
  ],
  [
    "full term: a snap election before the first general does not become the first",
    () =>
      electionMetrics([
        election("Snap Election (Year 2040)", after(-30 * DAY)),
        firstGeneral,
        election("General Election (Year 2044)", after(17.5 * MONTH_MS)),
      ]).fullTerm,
    0,
  ],
  [
    "full term: 5 real months (20 on the 4x clock) is no term",
    () =>
      electionMetrics([firstGeneral, election("General Election (Year 2042)", after(5 * MONTH_MS))])
        .fullTerm,
    0,
  ],
  [
    "peaceful transitions: general elections spanning 3 years",
    () => electionMetrics(generals(36 * MONTH_MS)).peacefulTransitions,
    2,
  ],
  [
    "council: 25 meetings in 3 real weeks (12 on the 4x clock) clear nothing",
    () => councilMeetings(Array.from({ length: 25 }, (_, i) => new Date(START + i * DAY))),
    0,
  ],
];

// --- Platform, nation and real-time buckets -------------------------------------------------------------------------

const PLATFORM_NOW = new Date("2026-10-14T12:00:00.000Z");
const oct = (n: number, hour = 9) => new Date(Date.UTC(2026, 9, n, hour));
const vault = (lastLoginDate: Date | null) => ({ loginStreak: 30, lastLoginDate });
const IDENTITY = {
  officialName: "Republic of Test",
  motto: "Onward",
  demonym: "Testan",
  currency: "Tester",
  officialLanguages: "Testish",
  nationalAnthem: "Song of Test",
  nationalDay: "1 May",
  capitalCityId: "city_1",
  nationalBird: "Heron",
  nationalFish: "Trout",
  nationalFlower: "Iris",
  nationalDish: null,
  nationalFruit: "  ",
  nationalDrink: null,
  nationalInstrument: null,
  nationalSymbol: null,
  nationalSport: null,
};
const realBuckets = (dates: Date[]) => ({
  weeks: distinctBuckets(dates, weekKey),
  months: distinctBuckets(dates, monthKey),
  streak: longestConsecutiveWeeks(dates),
  span: spanMs(dates),
});

const PLATFORM_AND_NATION: Row[] = [
  [
    "a posting streak runs across UTC midnight",
    () => longestDayRun([new Date("2026-10-10T23:59:00Z"), new Date("2026-10-11T00:01:00Z")]),
    2,
  ],
  [
    "a claim yesterday keeps the claim streak",
    () => effectiveClaimStreak(vault(oct(13, 23)), PLATFORM_NOW),
    30,
  ],
  [
    "a claim two days ago has lapsed",
    () => effectiveClaimStreak(vault(oct(12, 23)), PLATFORM_NOW),
    0,
  ],
  [
    "ownership months are whole real months",
    () => ownedMonths(new Date(PLATFORM_NOW.getTime() - 6 * MONTH_MS + 1), PLATFORM_NOW),
    5,
  ],
  [
    "a national identity needs 3 symbols: 2 fall short",
    () => isIdentityComplete({ ...IDENTITY, nationalFlower: " " }),
    false,
  ],
  [
    "a week run crosses the year boundary",
    () => longestConsecutiveWeeks([utc("2026-12-30"), utc("2027-01-05"), utc("2027-01-12")]),
    3,
  ],
];

describe.each([
  ["Executive", EXECUTIVE],
  ["Politics", POLITICS],
  ["Platform and Nation", PLATFORM_AND_NATION],
] as const)("%s metrics", (_family, rows) => {
  it.each(rows)("%s", (_rule, actual, expected) => {
    expect(actual()).toBe(expected);
  });
});

it("buckets durations in real time whatever the IxTime clock runs at, and never reads it", () => {
  const dates = [utc("2026-10-05"), utc("2026-10-12"), utc("2026-10-14"), utc("2026-11-02")];
  const read = jest.spyOn(IxTime, "getCurrentIxTime");
  try {
    IxTime.setMultiplierOverride(0.5);
    read.mockClear();
    const slow = realBuckets(dates);
    IxTime.setMultiplierOverride(4);
    read.mockClear();
    expect(realBuckets(dates)).toEqual(slow);
    expect(slow).toEqual({ weeks: 3, months: 2, streak: 2, span: 28 * DAY });
    expect(read).not.toHaveBeenCalled();
  } finally {
    read.mockRestore();
    IxTime.setMultiplierOverride(2);
  }
});

// --- Definitions ----------------------------------------------------------------------------------------------------

const CATEGORIES = [
  "Executive",
  "Politics",
  "Diplomacy",
  "Defense",
  "Nation",
  "Social",
  "Wiki",
  "Cards",
  "Lorewards",
  "General",
];
const unlocks = (def: AchievementDefinition, metrics: Record<string, number>) =>
  achievementService.evaluateCondition({ key: def.id, conditionJson: null }, {
    country: { id: "c1" },
    metrics,
  } as unknown as ExtendedAchievementData);
const thresholdRules = (defs: AchievementDefinition[]) =>
  defs.filter((d) => !d.retired && d.rule && d.rule[2] === ">=" && typeof d.rule[3] === "number");
const keysOf = (scope: "account" | "country") =>
  METRIC_LOADERS.filter((l) => l.scope === scope).flatMap((l) => l.keys);
const OTHER_SETS = ALL_DEFINITIONS.filter(
  (d) => ![...EXECUTIVE_DEFINITIONS, ...POLITICS_DEFINITIONS, ...PLATFORM_DEFINITIONS].includes(d)
);

describe("achievement definitions", () => {
  it("have unique ids, one of the ten categories and an icon the UI draws; every active one can unlock", () => {
    expect(new Set(ALL_DEFINITIONS.map((d) => d.id)).size).toBe(ALL_DEFINITIONS.length);
    for (const def of ALL_DEFINITIONS) {
      expect([def.id, CATEGORIES.includes(def.category), def.icon in ACHIEVEMENT_ICON_MAP]).toEqual(
        [def.id, true, true]
      );
      if (!def.retired)
        expect([def.id, Boolean(def.rule ?? def.condition)]).toEqual([def.id, true]);
    }
  });

  it.each([
    [
      "Executive and Politics",
      [...EXECUTIVE_DEFINITIONS, ...POLITICS_DEFINITIONS],
      "country",
      [
        "directivesCommitted",
        "issuesAnswered",
        "fiscalSteward18m",
        "lawMonths",
        "peacefulTransitions",
      ],
    ],
    ["platform", PLATFORM_DEFINITIONS, "account", PLATFORM_LOADERS.flatMap((l) => l.keys)],
  ] as const)(
    "%s rules read keys their scope's loaders produce, and use every key",
    (_set, defs, scope, mustUse) => {
      const used = defs.map((d) => d.rule?.[1]).filter((m): m is string => Boolean(m));
      // mapEditsApproved, a platform rule, comes from the nation account loader
      for (const metric of used)
        expect([metric, keysOf(scope).includes(metric)]).toEqual([metric, true]);
      for (const key of mustUse) expect([key, used.includes(key)]).toEqual([key, true]);
      for (const def of defs) {
        expect([def.id, achievementRequiresCountry({ key: def.id })]).toEqual([
          def.id,
          scope === "country",
        ]);
      }
    }
  );

  it.each([
    ["Executive", EXECUTIVE_DEFINITIONS],
    ["Politics", POLITICS_DEFINITIONS],
    ["platform", PLATFORM_DEFINITIONS],
    ["every other set", OTHER_SETS],
  ] as const)("%s achievements unlock at their threshold and not one below", (_set, defs) => {
    const rules = thresholdRules(defs);
    expect(rules.length).toBeGreaterThan(0);
    for (const def of rules) {
      const [, metric, , value] = def.rule!;
      const at = Number(value);
      expect([def.id, unlocks(def, { [metric]: at }), unlocks(def, { [metric]: at - 1 })]).toEqual([
        def.id,
        true,
        false,
      ]);
    }
  });

  it.each([
    [
      "Lights Out needs no military at all, not just 25 embassies",
      "vid-lightswitch",
      { embassyCount: 25, totalMilitaryPersonnel: 5 },
      false,
    ],
    [
      "First Loreward is not a runner-up place",
      "lorewards-first",
      {
        metrics: {
          lorewardDailyWins: 0,
          lorewardWeeklyWins: 0,
          lorewardMonthlyWins: 0,
          lorewardRunnerUps: 3,
        },
      },
      false,
    ],
    [
      "a country achievement never passes without a country, whatever the data says",
      "meme-stonks",
      { adjustedGdpGrowth: -50 },
      false,
    ],
  ] as const)("%s", (_case, key, data, expected) => {
    const withCountry =
      key === "meme-stonks"
        ? data
        : { ...data, country: { id: "c1", ...("country" in data ? data.country : {}) } };
    expect(
      achievementService.evaluateCondition(
        { key, conditionJson: null },
        withCountry as unknown as ExtendedAchievementData
      )
    ).toBe(expected);
  });

  it.each([
    ["daysActive", false],
    ["embassyCount", true],
  ] as const)("an admin-authored rule on %s needs a country: %s", (metric, needsCountry) => {
    const conditionJson = metric ? JSON.stringify({ metric, operator: ">=", value: 1 }) : null;
    expect(achievementRequiresCountry({ key: "custom-row", conditionJson })).toBe(needsCountry);
  });
});
