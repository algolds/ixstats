/**
 * @jest-environment node
 *
 * The WikiOS proof gate: checks the round-trip, parity and bench reports against the committed thresholds, refuses a
 * corpus too small to mean anything, keys a proof to the WikiOS source it measured, and accepts a committed proof only
 * when it is clean, passing, from a proving profile, with parity, and for the code that ships.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MetricSample } from "../../../scripts/lib/wikios-bench-summary";
import {
  WIKIOS_PROOF_PATHS,
  benchReportSchema,
  buildSummary,
  checkCommittedProof,
  corpusCounts,
  evaluateBench,
  evaluateParity,
  evaluateRoundTrip,
  isTreeDirty,
  parityReportSchema,
  parseProofSummary,
  parseThresholds,
  renderProofSummary,
  roundTripReportSchema,
  wikiosTreeKey,
  type BenchReport,
  type Check,
  type ParityReport,
  type ProofSummary,
  type ProofThresholds,
  type RoundTripReport,
} from "../../../scripts/lib/wikios-proof-gate";

const THRESHOLDS_FILE = resolve(__dirname, "../../../scripts/audit/wikios-proof-thresholds.json");

const thresholds = (): ProofThresholds => parseThresholds(readFileSync(THRESHOLDS_FILE, "utf8"));

const byName = (checks: readonly Check[], name: string): Check => {
  const check = checks.find((c) => c.name === name);
  if (!check) throw new Error(`no check ${name} in ${checks.map((c) => c.name).join(", ")}`);
  return check;
};

const failing = (checks: readonly Check[]): string[] =>
  checks.filter((c) => !c.passed && c.skipped === null).map((c) => c.name);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type RoundTripPage = RoundTripReport["pages"][number];

function roundTripReport(
  count: number,
  edit?: (page: RoundTripPage, index: number) => RoundTripPage
): RoundTripReport {
  const pages = Array.from({ length: count }, (_, index) => {
    const page: RoundTripPage = { title: `Page ${index}`, identical: true, complete: true };
    return edit ? edit(page, index) : page;
  });
  return { meta: { namespaces: "all" }, skipped: [], pages };
}

type ParityPage = ParityReport["pages"][number];

const scoredPage = (
  title: string,
  overall: number,
  extra: Partial<ParityPage> = {}
): ParityPage => ({
  title,
  scores: { overall },
  renderQuality: "rendered",
  stale: false,
  templates: ["Infobox country"],
  differences: { linksMissingInWikios: [`${title} link`], headingsMissingInMediaWiki: [] },
  ...extra,
});

function parityReport(pages: ParityPage[]): ParityReport {
  return {
    meta: { titles: pages.map((page) => page.title) },
    pages,
    aggregate: {
      templatesOnLowestPages: [{ template: "Infobox country", lowPages: 1, allPages: 3 }],
    },
  };
}

const perfectPages = (count: number): ParityPage[] =>
  Array.from({ length: count }, (_, index) => scoredPage(`Page ${index}`, 100));

const SYSTEMS = ["mediawiki", "wikios"] as const;
const KINDS = ["page", "data", "search", "history"] as const;

/** One (page, run) of a bench: every request succeeded with `ms` on both systems unless `skip` names it. */
function benchRound(
  page: string,
  run: number,
  ms: Record<"mediawiki" | "wikios", number>,
  skip: string[] = []
): MetricSample[] {
  const samples: MetricSample[] = [];
  for (const system of SYSTEMS) {
    for (const kind of KINDS) {
      if (system === "mediawiki" && kind === "data") continue;
      if (skip.includes(`${system}.${kind}`)) continue;
      samples.push({
        system,
        metric: `${kind}.totalMs`,
        phase: run === 1 ? "cold" : "warm",
        page,
        run,
        value: ms[system],
      });
    }
  }
  return samples;
}

function benchReport(
  rounds: MetricSample[][],
  failures: BenchReport["failures"] = []
): BenchReport {
  return { samples: rounds.flat(), failures };
}

const fastBench = (pages: number): BenchReport =>
  benchReport(
    Array.from({ length: pages }, (_, index) => [
      ...benchRound(`P${index}`, 1, { mediawiki: 300, wikios: 100 }),
      ...benchRound(`P${index}`, 2, { mediawiki: 300, wikios: 100 }),
    ])
  );

const KEY = "a".repeat(64);

function summary(overrides: Partial<ProofSummary> = {}): ProofSummary {
  const checks: Check[] = [
    {
      name: "roundTrip.pages",
      passed: true,
      skipped: null,
      measured: "12706",
      threshold: ">= 11000",
    },
    { name: "parity.pages", passed: true, skipped: null, measured: "500", threshold: ">= 200" },
  ];
  return buildSummary(
    {
      profile: "local",
      generatedAt: "2026-10-25T12:00:00.000Z",
      commit: "abc1234",
      treeKey: KEY,
      dirty: false,
      corpus: { roundTripPages: 12706, parityPages: 500, benchPages: 25 },
      ...overrides,
    },
    overrides.checks ?? checks
  );
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

describe("parseThresholds", () => {
  it("reads the committed thresholds file with the provisional floors", () => {
    const t = thresholds();
    expect(t.roundTrip).toEqual({
      minPages: 11000,
      maxNonIdentical: 0,
      maxIncomplete: 0,
      maxErrors: 0,
    });
    expect(t.parity.minAtLeast98Percent).toBe(95);
    expect(t.parity.minMeanScore).toBe(97);
    expect(t.parity.maxBelow70Pages).toBe(0);
    expect(t.parity.knownLowPages).toEqual([]);
    expect(t.bench.p95Ms["page+data.totalMs"]).toBe(1500);
    expect(t.bench.maxP95RatioToMediaWiki["search.totalMs"]).toBe(1);
  });

  it("rejects an unknown key and a missing section", () => {
    const valid = JSON.parse(readFileSync(THRESHOLDS_FILE, "utf8")) as Record<
      string,
      Record<string, number>
    >;
    expect(() => parseThresholds(JSON.stringify({ ...valid, extra: 1 }))).toThrow();
    expect(() =>
      parseThresholds(JSON.stringify({ ...valid, parity: { ...valid.parity, minScore: 1 } }))
    ).toThrow();
    expect(() =>
      parseThresholds(
        JSON.stringify({ ...valid, bench: { ...valid.bench, p95Ms: { "page.bogusMs": 1 } } })
      )
    ).toThrow();
    const { bench: _bench, ...withoutBench } = valid;
    expect(() => parseThresholds(JSON.stringify(withoutBench))).toThrow();
  });

  it("rejects a page floor of zero and a known low page without a reason", () => {
    const valid = JSON.parse(readFileSync(THRESHOLDS_FILE, "utf8")) as Record<
      string,
      Record<string, number>
    >;
    expect(() =>
      parseThresholds(JSON.stringify({ ...valid, roundTrip: { ...valid.roundTrip, minPages: 0 } }))
    ).toThrow();
    expect(() =>
      parseThresholds(
        JSON.stringify({
          ...valid,
          parity: { ...valid.parity, knownLowPages: [{ title: "Caphiria", reason: "" }] },
        })
      )
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Report schemas
// ---------------------------------------------------------------------------

describe("report schemas", () => {
  it("accept the harness output, with extra fields, and older reports without the new fields", () => {
    const roundTrip = {
      meta: { source: "db", namespaces: [0, 10], generatedAt: "x" },
      skipped: [{ title: "Empty", reason: "empty wikitext" }],
      pages: [
        {
          title: "A",
          identical: true,
          identicalTrimmed: true,
          complete: true,
          parseConfidence: "full",
          changedLines: [],
        },
      ],
    };
    expect(roundTripReportSchema.parse(roundTrip).pages).toHaveLength(1);
    expect(
      roundTripReportSchema.parse({ ...roundTrip, meta: { source: "db" } }).meta.namespaces
    ).toBeUndefined();
    expect(
      roundTripReportSchema.parse({ ...roundTrip, meta: { namespaces: null } }).meta.namespaces
    ).toBeNull();

    const olderParity = {
      meta: { titles: ["A", "B"] },
      pages: [
        { title: "A", scores: { overall: 99, text: 99 }, templates: [] },
        { title: "B", error: "WikiOS HTTP 500: boom", templates: [] },
      ],
      aggregate: { requested: 2, meanScore: 99 },
    };
    expect(parityReportSchema.parse(olderParity).pages).toHaveLength(2);

    const bench = {
      meta: { runs: 2 },
      samples: [
        { system: "wikios", metric: "page.totalMs", phase: "cold", page: "A", run: 1, value: 10 },
      ],
      failures: [{ system: "mediawiki", kind: "asset", page: "A", run: 1, url: "u", status: 404 }],
      summary: [],
    };
    expect(benchReportSchema.parse(bench).samples).toHaveLength(1);
  });

  it("reject malformed reports", () => {
    expect(() =>
      roundTripReportSchema.parse({
        meta: {},
        skipped: [],
        pages: [{ title: "A", identical: "yes", complete: true }],
      })
    ).toThrow();
    expect(() => roundTripReportSchema.parse({ meta: {}, pages: [] })).toThrow();
    expect(() =>
      roundTripReportSchema.parse({ meta: { namespaces: "some" }, skipped: [], pages: [] })
    ).toThrow();
    expect(() => parityReportSchema.parse({ meta: {}, pages: [] })).toThrow();
    expect(() =>
      parityReportSchema.parse({
        meta: { titles: ["A"] },
        pages: [{ title: "A", failedOn: "classic", templates: [] }],
      })
    ).toThrow();
    expect(() =>
      parityReportSchema.parse({ meta: { titles: ["A"] }, pages: [{ title: "A" }] })
    ).toThrow();
    expect(() =>
      benchReportSchema.parse({
        samples: [{ system: "classic", metric: "m", phase: "cold", page: "A", run: 1, value: 1 }],
        failures: [],
      })
    ).toThrow();
    expect(() => benchReportSchema.parse({ samples: [] })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Round trip
// ---------------------------------------------------------------------------

describe("evaluateRoundTrip", () => {
  it("all identical passes", () => {
    const checks = evaluateRoundTrip(roundTripReport(11000), thresholds());
    expect(checks.map((c) => c.name)).toEqual([
      "roundTrip.pages",
      "roundTrip.nonIdentical",
      "roundTrip.incomplete",
      "roundTrip.errors",
    ]);
    expect(failing(checks)).toEqual([]);
    expect(byName(checks, "roundTrip.pages").measured).toBe("11000");
  });

  it("one changed byte fails maxNonIdentical", () => {
    const report = roundTripReport(11000, (page, index) =>
      index === 7 ? { ...page, identical: false } : page
    );
    const checks = evaluateRoundTrip(report, thresholds());
    expect(failing(checks)).toEqual(["roundTrip.nonIdentical"]);
    expect(byName(checks, "roundTrip.nonIdentical").measured).toBe("1");
  });

  it("an incomplete serialization and an error each fail their own check", () => {
    const report = roundTripReport(11000, (page, index) => {
      if (index === 1) return { ...page, complete: false };
      if (index === 2) return { ...page, error: "parse threw" };
      return page;
    });
    expect(failing(evaluateRoundTrip(report, thresholds()))).toEqual([
      "roundTrip.incomplete",
      "roundTrip.errors",
    ]);
  });

  it("a report below minPages fails", () => {
    expect(failing(evaluateRoundTrip(roundTripReport(10999), thresholds()))).toEqual([
      "roundTrip.pages",
    ]);
    expect(failing(evaluateRoundTrip(roundTripReport(0), thresholds()))).toEqual([
      "roundTrip.pages",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Parity
// ---------------------------------------------------------------------------

describe("evaluateParity", () => {
  it("a full perfect sample passes every check", () => {
    const checks = evaluateParity(parityReport(perfectPages(200)), thresholds());
    expect(checks.map((c) => c.name)).toEqual([
      "parity.pages",
      "parity.wikiosFailures",
      "parity.mediawikiMissing",
      "parity.fallbackRenders",
      "parity.atLeast98",
      "parity.meanScore",
      "parity.below70",
    ]);
    expect(failing(checks)).toEqual([]);
  });

  it("a report below minPages fails", () => {
    expect(failing(evaluateParity(parityReport(perfectPages(199)), thresholds()))).toEqual([
      "parity.pages",
    ]);
  });

  it("pages MediaWiki could not answer do not count toward the floor", () => {
    const pages = perfectPages(200).map((page, index) =>
      index < 150
        ? {
            title: page.title,
            error: "MediaWiki HTTP 503",
            failedOn: "mediawiki" as const,
            templates: [],
          }
        : page
    );
    expect(failing(evaluateParity(parityReport(pages), thresholds()))).toEqual(["parity.pages"]);
  });

  it("a report whose pages do not match its requested titles fails the floor", () => {
    const report = parityReport(perfectPages(200));
    expect(
      failing(
        evaluateParity(
          { ...report, meta: { titles: [...report.meta.titles, "Lost"] } },
          thresholds()
        )
      )
    ).toEqual(["parity.pages"]);
    expect(
      failing(
        evaluateParity({ ...report, meta: { titles: report.meta.titles.slice(1) } }, thresholds())
      )
    ).toEqual(["parity.pages"]);
  });

  it("one fallback render fails maxFallbackRenders", () => {
    const pages = perfectPages(200);
    pages[3] = { ...pages[3], renderQuality: "fallback" };
    expect(failing(evaluateParity(parityReport(pages), thresholds()))).toEqual([
      "parity.fallbackRenders",
    ]);
    const stale = perfectPages(200);
    stale[4] = { ...stale[4], stale: true };
    expect(failing(evaluateParity(parityReport(stale), thresholds()))).toEqual([
      "parity.fallbackRenders",
    ]);
  });

  it("a WikiOS failure fails; a page missing on MediaWiki counts only toward drift", () => {
    const withWikiosFailure = perfectPages(200);
    withWikiosFailure[0] = {
      title: "Page 0",
      error: "WikiOS HTTP 500: boom",
      failedOn: "wikios",
      templates: [],
    };
    const checks = evaluateParity(parityReport(withWikiosFailure), thresholds());
    expect(failing(checks)).toContain("parity.wikiosFailures");
    expect(byName(checks, "parity.mediawikiMissing").passed).toBe(true);

    const missing = (title: string): ParityPage => ({
      title,
      error: "MediaWiki: missingtitle: The page you specified doesn't exist.",
      failedOn: "mediawiki",
      templates: [],
    });
    const withDrift = [...perfectPages(200), missing("Gone 1"), missing("Gone 2")];
    expect(failing(evaluateParity(parityReport(withDrift), thresholds()))).toEqual([]);

    const tooMuchDrift = [
      ...perfectPages(200),
      ...Array.from({ length: 10 }, (_, index) => missing(`Gone ${index}`)),
    ];
    expect(failing(evaluateParity(parityReport(tooMuchDrift), thresholds()))).toEqual([
      "parity.mediawikiMissing",
    ]);
    // Drift is a share of every requested page: 10 of 210.
    expect(
      byName(evaluateParity(parityReport(tooMuchDrift), thresholds()), "parity.mediawikiMissing")
        .measured
    ).toBe("4.8%");
  });

  it("a page missing on MediaWiki still counts toward the floor", () => {
    const pages: ParityPage[] = [
      ...perfectPages(199),
      {
        title: "Gone",
        error: "MediaWiki: missingtitle: gone",
        failedOn: "mediawiki",
        templates: [],
      },
    ];
    expect(byName(evaluateParity(parityReport(pages), thresholds()), "parity.pages").passed).toBe(
      true
    );
  });

  it("drift matches the missingtitle code, not other MediaWiki errors", () => {
    const pages: ParityPage[] = [
      ...perfectPages(200),
      ...Array.from({ length: 10 }, (_, index) => ({
        title: `Broken ${index}`,
        error: "MediaWiki HTTP 500 Internal Server Error",
        failedOn: "mediawiki" as const,
        templates: [],
      })),
    ];
    expect(
      byName(evaluateParity(parityReport(pages), thresholds()), "parity.mediawikiMissing").measured
    ).toBe("0.0%");
  });

  it("a revision MediaWiki deleted or hid since WikiOS's copy (nosuchrevid) is drift, not a parity failure", () => {
    const pages: ParityPage[] = [
      ...perfectPages(200),
      {
        title: "Gone",
        error: "MediaWiki: nosuchrevid: revision 42 is gone or hidden (permissiondenied: hidden)",
        failedOn: "mediawiki" as const,
        templates: [],
      },
    ];
    const checks = evaluateParity(parityReport(pages), thresholds());
    expect(byName(checks, "parity.mediawikiMissing").measured).toBe("0.5%");
    expect(byName(checks, "parity.below70").passed).toBe(true);
  });

  it("an older report without failedOn attributes failures by their prefix", () => {
    const pages: ParityPage[] = [
      ...perfectPages(200),
      { title: "Old 1", error: "WikiOS unreachable: ECONNREFUSED", templates: [] },
      { title: "Old 2", error: "MediaWiki: missingtitle: gone", templates: [] },
    ];
    const checks = evaluateParity(parityReport(pages), thresholds());
    expect(byName(checks, "parity.wikiosFailures").measured).toBe("1");
    expect(byName(checks, "parity.mediawikiMissing").measured).toBe("0.5%");
  });

  it("failedOn wins over the error text, and a WikiOS 'does not exist' is a WikiOS failure, not drift", () => {
    const pages: ParityPage[] = [
      ...perfectPages(200),
      { title: "Timeout", error: "upstream timeout", failedOn: "mediawiki", templates: [] },
      {
        title: "Gone here",
        error: "WikiOS HTTP 404: the page does not exist",
        failedOn: "wikios",
        templates: [],
      },
    ];
    const checks = evaluateParity(parityReport(pages), thresholds());
    expect(byName(checks, "parity.wikiosFailures").measured).toBe("1");
    expect(byName(checks, "parity.mediawikiMissing").measured).toBe("0.0%");
  });

  it("other MediaWiki codes that start with missing are not drift", () => {
    const pages: ParityPage[] = [
      ...perfectPages(200),
      {
        title: "Param",
        error: "MediaWiki: missingparam: The text parameter must be set.",
        failedOn: "mediawiki",
        templates: [],
      },
    ];
    expect(
      byName(evaluateParity(parityReport(pages), thresholds()), "parity.mediawikiMissing").measured
    ).toBe("0.0%");
  });

  it("an unattributable error in an older report counts against WikiOS", () => {
    const pages: ParityPage[] = [
      ...perfectPages(200),
      { title: "Odd", error: "socket hang up", templates: [] },
    ];
    expect(
      byName(evaluateParity(parityReport(pages), thresholds()), "parity.wikiosFailures").measured
    ).toBe("1");
  });

  it("the share at 98 and the mean are over scored pages", () => {
    const pages = perfectPages(200).map((page, index) =>
      index < 11 ? { ...page, scores: { overall: 97 } } : page
    );
    const checks = evaluateParity(parityReport(pages), thresholds());
    expect(failing(checks)).toEqual(["parity.atLeast98"]);
    expect(byName(checks, "parity.atLeast98").measured).toBe("94.5%");
    const atBoundary = perfectPages(200).map((page) => ({ ...page, scores: { overall: 98 } }));
    expect(
      byName(evaluateParity(parityReport(atBoundary), thresholds()), "parity.atLeast98").measured
    ).toBe("100.0%");

    const lowMean = perfectPages(200).map((page) => ({ ...page, scores: { overall: 96.9 } }));
    expect(failing(evaluateParity(parityReport(lowMean), thresholds()))).toEqual([
      "parity.atLeast98",
      "parity.meanScore",
    ]);

    // Half at 100, half at 93.9: the mean is 96.95, under 97, though half the pages are perfect.
    const mixed = perfectPages(200).map((page, index) =>
      index % 2 === 0 ? page : { ...page, scores: { overall: 93.9 } }
    );
    expect(
      byName(evaluateParity(parityReport(mixed), thresholds()), "parity.meanScore")
    ).toMatchObject({
      passed: false,
      measured: "96.95",
    });
  });

  it("a report with no scored page fails the share and the mean", () => {
    const pages = perfectPages(200).map((page) => ({
      title: page.title,
      error: "MediaWiki: missingtitle: gone",
      failedOn: "mediawiki" as const,
      templates: [],
    }));
    const checks = evaluateParity(parityReport(pages), thresholds());
    expect(byName(checks, "parity.atLeast98").passed).toBe(false);
    expect(byName(checks, "parity.meanScore").passed).toBe(false);
  });

  it("a page below 70 fails unless it is listed with a reason", () => {
    const pages = perfectPages(200);
    pages[9] = scoredPage("Lowtown", 60);
    const t = thresholds();
    const checks = evaluateParity(parityReport(pages), t);
    expect(failing(checks)).toEqual(["parity.below70"]);
    expect(byName(checks, "parity.below70").measured).toContain("Lowtown");

    const listed: ProofThresholds = {
      ...t,
      parity: {
        ...t.parity,
        knownLowPages: [{ title: "Lowtown", reason: "owner: Lua module not ported" }],
      },
    };
    expect(failing(evaluateParity(parityReport(pages), listed))).toEqual([]);
    const otherListed: ProofThresholds = {
      ...t,
      parity: { ...t.parity, knownLowPages: [{ title: "Hightown", reason: "owner" }] },
    };
    expect(failing(evaluateParity(parityReport(pages), otherListed))).toEqual(["parity.below70"]);
  });

  it("a page at exactly 70 is not below 70", () => {
    const pages = perfectPages(200);
    pages[0] = scoredPage("Edge", 70);
    expect(byName(evaluateParity(parityReport(pages), thresholds()), "parity.below70").passed).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// Bench
// ---------------------------------------------------------------------------

describe("evaluateBench", () => {
  it("local profile skips every bench check", () => {
    const checks = evaluateBench(fastBench(5), thresholds(), "local");
    expect(checks.length).toBe(2 + 4 + 3);
    for (const check of checks) expect(check.skipped).toBe("dev server: reference only");
    expect(
      evaluateBench(null, thresholds(), "local").every((check) => check.skipped !== null)
    ).toBe(true);
  });

  it("a fast bench passes on a server profile", () => {
    const checks = evaluateBench(fastBench(5), thresholds(), "launch");
    expect(checks.map((c) => c.name)).toEqual([
      "bench.failures.mediawiki",
      "bench.failures.wikios",
      "bench.p95.page+data.totalMs",
      "bench.p95.data.totalMs",
      "bench.p95.search.totalMs",
      "bench.p95.history.totalMs",
      "bench.ratio.page+data.totalMs",
      "bench.ratio.search.totalMs",
      "bench.ratio.history.totalMs",
    ]);
    expect(failing(checks)).toEqual([]);
  });

  it("a missing bench report fails every check on a server profile", () => {
    const checks = evaluateBench(null, thresholds(), "recurring");
    expect(checks.every((check) => !check.passed && check.skipped === null)).toBe(true);
    expect(checks.every((check) => check.measured === "no bench report")).toBe(true);
  });

  it("p95 over pooled runs against the cap", () => {
    // 20 (page, run) pairs: 19 fast, one slow search in the warm run. Pooled nearest-rank p95 of 20 values is the 19th.
    const rounds: MetricSample[][] = [];
    for (let index = 0; index < 10; index++) {
      rounds.push(benchRound(`P${index}`, 1, { mediawiki: 900, wikios: 100 }));
      rounds.push(benchRound(`P${index}`, 2, { mediawiki: 900, wikios: index >= 8 ? 600 : 100 }));
    }
    const checks = evaluateBench(benchReport(rounds), thresholds(), "launch");
    expect(byName(checks, "bench.p95.search.totalMs").passed).toBe(false);
    expect(byName(checks, "bench.p95.search.totalMs").measured).toBe("600 ms");
    expect(byName(checks, "bench.p95.data.totalMs").passed).toBe(true);
    // page+data is the shell plus the data call: 600 + 600 = 1200, under 1500.
    expect(byName(checks, "bench.p95.page+data.totalMs").measured).toBe("1200 ms");

    const oneSlow: MetricSample[][] = [];
    for (let index = 0; index < 10; index++) {
      oneSlow.push(benchRound(`P${index}`, 1, { mediawiki: 900, wikios: 100 }));
      oneSlow.push(benchRound(`P${index}`, 2, { mediawiki: 900, wikios: index === 9 ? 600 : 100 }));
    }
    expect(
      byName(
        evaluateBench(benchReport(oneSlow), thresholds(), "launch"),
        "bench.p95.search.totalMs"
      ).passed
    ).toBe(true);
  });

  it("ratio uses only pages measured on both systems", () => {
    const rounds = [
      benchRound("A", 1, { mediawiki: 200, wikios: 100 }),
      benchRound("B", 1, { mediawiki: 200, wikios: 150 }),
      // C: WikiOS was slow but MediaWiki failed its search, so C's search is not compared.
      benchRound("C", 1, { mediawiki: 200, wikios: 400 }, ["mediawiki.search"]),
    ];
    const checks = evaluateBench(benchReport(rounds), thresholds(), "launch");
    const search = byName(checks, "bench.ratio.search.totalMs");
    expect(search.passed).toBe(true);
    expect(search.measured).toBe("0.75 (n=2)");
    expect(byName(checks, "bench.ratio.history.totalMs").passed).toBe(false);
  });

  it("a WikiOS p95 equal to MediaWiki's is no worse, so it passes", () => {
    const rounds = [
      benchRound("A", 1, { mediawiki: 200, wikios: 200 }),
      benchRound("B", 1, { mediawiki: 300, wikios: 300 }),
    ];
    const check = byName(
      evaluateBench(benchReport(rounds), thresholds(), "launch"),
      "bench.ratio.search.totalMs"
    );
    expect(check).toMatchObject({ passed: true, measured: "1.00 (n=2)" });
  });

  it("a ratio with no shared pages fails", () => {
    const rounds = [benchRound("A", 1, { mediawiki: 200, wikios: 100 }, ["wikios.history"])];
    const check = byName(
      evaluateBench(benchReport(rounds), thresholds(), "launch"),
      "bench.ratio.history.totalMs"
    );
    expect(check.passed).toBe(false);
  });

  it("failures over 1% fail", () => {
    const report = fastBench(25); // 50 rounds: 150 MediaWiki and 200 WikiOS requests
    const failure = (
      system: "mediawiki" | "wikios",
      kind: BenchReport["failures"][number]["kind"],
      run: number
    ) => ({
      system,
      kind,
      page: "P0",
      run,
      url: "u",
      status: 500,
    });
    // 2 of 200 + 2 WikiOS requests is under 1%; 3 of 203 is over.
    const two = evaluateBench(
      { ...report, failures: [failure("wikios", "search", 1), failure("wikios", "history", 2)] },
      thresholds(),
      "launch"
    );
    expect(byName(two, "bench.failures.wikios").passed).toBe(true);
    const three = evaluateBench(
      {
        ...report,
        failures: [
          failure("wikios", "search", 1),
          failure("wikios", "history", 2),
          failure("wikios", "data", 1),
        ],
      },
      thresholds(),
      "launch"
    );
    expect(failing(three)).toEqual(["bench.failures.wikios"]);
    expect(byName(three, "bench.failures.wikios").measured).toBe("1.48% (3 of 203)");
    // Asset failures are not requests of the bench.
    const assets = Array.from({ length: 20 }, (_, run) => failure("mediawiki", "asset", run));
    expect(
      byName(
        evaluateBench({ ...report, failures: assets }, thresholds(), "launch"),
        "bench.failures.mediawiki"
      ).passed
    ).toBe(true);
  });

  it("a system with no requests fails its failure check", () => {
    const report = benchReport([benchRound("A", 1, { mediawiki: 1, wikios: 1 })]);
    const wikiosOnly = {
      ...report,
      samples: report.samples.filter((sample) => sample.system === "wikios"),
    };
    expect(
      byName(evaluateBench(wikiosOnly, thresholds(), "launch"), "bench.failures.mediawiki").passed
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tree key
// ---------------------------------------------------------------------------

describe("wikiosTreeKey", () => {
  const listing = (wikiOsBlob: string, testBlob: string): string =>
    [
      `100644 blob ${wikiOsBlob}\tsrc/lib/wiki-os/transformers/html-transformer.ts`,
      `100644 blob ${"1".repeat(40)}\tsrc/lib/utils/sanitize-html.ts`,
      "",
    ].join("\n") + (testBlob ? `100644 blob ${testBlob}\tsrc/tests/lib/wiki-os/foo.test.ts\n` : "");

  it("names the product code and leaves tests and the harness out", () => {
    expect(WIKIOS_PROOF_PATHS).toEqual([
      "src/lib/wiki-os",
      "src/components/wiki-os",
      "src/server/api/routers/wikios",
      "src/app/(wiki-os)",
      "src/app/w",
      "src/app/api/wiki",
      "src/app/api/mediawiki",
      "src/lib/utils/sanitize-html.ts",
      "src/lib/utils/scope-template-styles.ts",
      "scripts/ops/mediawiki",
      "prisma/schema/wiki.prisma",
    ]);
    expect(
      WIKIOS_PROOF_PATHS.some((path) => path.startsWith("src/tests") || path.includes("audit"))
    ).toBe(false);
  });

  it("a change under src/lib/wiki-os changes the key; one under src/tests does not", () => {
    // The CLI runs `git ls-tree -r HEAD -- WIKIOS_PROOF_PATHS`, so a src/tests blob never reaches the key; a
    // listing that did include one would be a different listing. Feed what git prints for each tree.
    const before = wikiosTreeKey(listing("a".repeat(40), ""));
    const wikiOsChanged = wikiosTreeKey(listing("b".repeat(40), ""));
    expect(wikiOsChanged).not.toBe(before);
    expect(before).toMatch(/^[0-9a-f]{64}$/);
    // A test change: ls-tree over the WikiOS paths prints the same text, so the key is the same.
    expect(wikiosTreeKey(listing("a".repeat(40), ""))).toBe(before);
  });

  it("refuses an empty listing, which would key a proof to no code", () => {
    expect(() => wikiosTreeKey("")).toThrow(/no WikiOS files/);
    expect(() => wikiosTreeKey("\n")).toThrow(/no WikiOS files/);
  });
});

describe("isTreeDirty", () => {
  it("is false for a clean status and true for any uncommitted WikiOS change", () => {
    expect(isTreeDirty("")).toBe(false);
    expect(isTreeDirty("\n")).toBe(false);
    expect(isTreeDirty(" M src/lib/wiki-os/transformers/srcset.ts\n")).toBe(true);
    expect(isTreeDirty("?? src/lib/wiki-os/sister-media.ts\n")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

describe("buildSummary", () => {
  it("passes when every check passed or was skipped, and fails on one failed check", () => {
    const passed: Check = { name: "a", passed: true, skipped: null, measured: "1", threshold: "1" };
    const skipped: Check = {
      name: "b",
      passed: false,
      skipped: "dev server: reference only",
      measured: "-",
      threshold: "-",
    };
    const failed: Check = {
      name: "c",
      passed: false,
      skipped: null,
      measured: "2",
      threshold: "1",
    };
    expect(summary({ checks: [passed, skipped] }).passed).toBe(true);
    expect(summary({ checks: [passed, skipped, failed] }).passed).toBe(false);
  });

  it("a summary with no checks does not pass", () => {
    expect(summary({ checks: [] }).passed).toBe(false);
  });

  it("round-trips through JSON and parseProofSummary", () => {
    const s = summary();
    expect(parseProofSummary(JSON.stringify(s))).toEqual(s);
    expect(() => parseProofSummary(JSON.stringify({ ...s, profile: "nightly" }))).toThrow();
    expect(() => parseProofSummary(JSON.stringify({ ...s, dirty: "no" }))).toThrow();
  });
});

describe("corpusCounts", () => {
  it("counts round-trip pages, requested parity pages and distinct bench pages", () => {
    expect(
      corpusCounts({
        roundTrip: roundTripReport(3),
        parity: parityReport(perfectPages(4)),
        bench: fastBench(2),
      })
    ).toEqual({ roundTripPages: 3, parityPages: 4, benchPages: 2 });
    const report = parityReport(perfectPages(4));
    expect(
      corpusCounts({
        roundTrip: null,
        parity: { ...report, meta: { titles: [...report.meta.titles, "E"] } },
        bench: null,
      }).parityPages
    ).toBe(5);
    expect(corpusCounts({ roundTrip: null, parity: null, bench: null })).toEqual({
      roundTripPages: 0,
      parityPages: 0,
      benchPages: 0,
    });
  });
});

describe("renderProofSummary", () => {
  const lowPages = [...perfectPages(30), scoredPage("Lowtown", 61.25), scoredPage("Midtown", 88)];
  const reports = {
    roundTrip: roundTripReport(3),
    parity: parityReport(lowPages),
    bench: fastBench(2),
  };

  it("shows the stamp, the checks, the lowest pages with their differences and the templates", () => {
    const s = summary({
      dirty: true,
      checks: [
        {
          name: "parity.below70",
          passed: false,
          skipped: null,
          measured: "1 (Lowtown)",
          threshold: "<= 0",
        },
      ],
    });
    const md = renderProofSummary(s, reports);
    expect(md).toContain("local");
    expect(md).toContain("abc1234");
    expect(md).toContain(KEY);
    expect(md).toMatch(/Dirty: yes/);
    expect(md).toContain("| parity.below70 | FAIL | 1 (Lowtown) | <= 0 |");
    expect(md.indexOf("Lowtown")).toBeLessThan(md.indexOf("Midtown", md.indexOf("Lowest")));
    expect(md).toContain("61.3");
    expect(md).toContain("Lowtown link");
    expect(md).not.toContain("headingsMissingInMediaWiki");
    expect(md).toContain("Infobox country");
    const lowest = md.slice(md.indexOf("Lowest"), md.indexOf("Templates"));
    expect(lowest.match(/^- /gm)).toHaveLength(20);
  });

  it("adds the bench table for server profiles only", () => {
    expect(renderProofSummary(summary(), reports)).not.toContain("WikiOS p95");
    const server = renderProofSummary(summary({ profile: "launch" }), reports);
    expect(server).toContain("WikiOS p95");
    expect(server).toContain("| search.totalMs | 300 ms | 300 ms | 100 ms | 100 ms |");
  });

  it("the bench table shows p50 and p95, pooled", () => {
    const rounds = Array.from({ length: 20 }, (_, index) =>
      benchRound(`P${index}`, (index % 2) + 1, { mediawiki: 10 * (index + 1), wikios: index + 1 })
    );
    const md = renderProofSummary(summary({ profile: "recurring" }), {
      roundTrip: null,
      parity: null,
      bench: benchReport(rounds),
    });
    expect(md).toContain("| search.totalMs | 100 ms | 190 ms | 10 ms | 19 ms |");
  });

  it("marks a skipped check with its reason", () => {
    const s = summary({
      checks: [
        {
          name: "bench.p95.data.totalMs",
          passed: false,
          skipped: "dev server: reference only",
          measured: "80 ms",
          threshold: "<= 800 ms",
        },
      ],
    });
    expect(renderProofSummary(s, { roundTrip: null, parity: null, bench: null })).toContain(
      "| bench.p95.data.totalMs | skipped (dev server: reference only) | 80 ms | <= 800 ms |"
    );
  });
});

// ---------------------------------------------------------------------------
// Committed proof
// ---------------------------------------------------------------------------

describe("checkCommittedProof", () => {
  const refused = (result: ReturnType<typeof checkCommittedProof>): string => {
    if (result.ok) throw new Error("expected a refusal");
    return result.reason;
  };

  it("a clean passing local summary with the same key is accepted, and so is a launch one", () => {
    expect(checkCommittedProof(summary(), KEY)).toEqual({ ok: true });
    expect(checkCommittedProof(summary({ profile: "launch" }), KEY)).toEqual({ ok: true });
  });

  it("a missing, dirty, failed, recurring, parity-less or other-key summary is refused, each with its reason", () => {
    expect(refused(checkCommittedProof(null, KEY))).toMatch(/no committed proof/i);
    expect(refused(checkCommittedProof(summary({ dirty: true }), KEY))).toMatch(
      /uncommitted WikiOS changes/i
    );
    const failedChecks: Check[] = [
      { name: "parity.pages", passed: false, skipped: null, measured: "1", threshold: ">= 200" },
    ];
    expect(refused(checkCommittedProof(summary({ checks: failedChecks }), KEY))).toMatch(
      /did not pass/i
    );
    expect(refused(checkCommittedProof(summary({ profile: "recurring" }), KEY))).toMatch(
      /recurring/i
    );
    const noParity: Check[] = [
      { name: "roundTrip.pages", passed: true, skipped: null, measured: "1", threshold: "1" },
    ];
    expect(refused(checkCommittedProof(summary({ checks: noParity }), KEY))).toMatch(
      /no parity check/i
    );
    expect(refused(checkCommittedProof(summary(), "b".repeat(64)))).toMatch(/changed since/i);
  });

  it("every refusal names its fix", () => {
    const reasons = [
      checkCommittedProof(null, KEY),
      checkCommittedProof(summary({ dirty: true }), KEY),
      checkCommittedProof(summary({ profile: "recurring" }), KEY),
      checkCommittedProof(summary(), "b".repeat(64)),
    ].map(refused);
    for (const reason of reasons) expect(reason).toMatch(/docs\/audits\/wikios-proof\/README\.md/);
  });

  it("a passed flag that disagrees with the checks is not trusted", () => {
    const forged: ProofSummary = {
      ...summary(),
      passed: true,
      checks: [
        { name: "parity.pages", passed: false, skipped: null, measured: "0", threshold: ">= 200" },
      ],
    };
    expect(refused(checkCommittedProof(forged, KEY))).toMatch(/did not pass/i);
    expect(refused(checkCommittedProof({ ...summary(), passed: false }, KEY))).toMatch(
      /did not pass/i
    );
  });
});
