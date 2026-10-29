/**
 * Issue cadence (owner decision 5): the cron hands a nation its next issue once a gap since its last one is up. The
 * gap is seeded by the nation and its last issue, so the cadence does not depend on how often the cron runs and a
 * long outage resumes with one issue, not a burst; the pick among triggered templates is weighted by probability.
 */
import { describe, expect, it } from "@jest/globals";
import {
  balanceDomains,
  hashUnit,
  isRoutineSlug,
  issueDue,
  issueGapMs,
  MAX_ISSUE_GAP_IX_DAYS,
  MEAN_ISSUE_GAP_IX_DAYS,
  MIN_ISSUE_GAP_IX_DAYS,
  pickWeighted,
  selectPacedCandidates,
  withRoutineFallback,
} from "~/lib/national-issues/evaluators/pacing";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = Date.UTC(2043, 0, 1);

/** A seeded uniform source, so the weighted-pick checks are exact. */
function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

/** Issues one always-eligible nation gets over `days` with the cron every `stepMs`. */
function simulate(countryId: string, days: number, stepMs: number): number[] {
  const issues: Array<{ createdIxTime: number }> = [];
  for (let now = T0; now < T0 + days * DAY; now += stepMs) {
    const picked = selectPacedCandidates([{ probability: 0.5 }], issues, countryId, now, 3);
    for (const _ of picked) issues.push({ createdIxTime: now });
  }
  return issues.map((i) => i.createdIxTime);
}

describe("the gap between a nation's issues", () => {
  it("is deterministic in (0, 1) per key and spreads across keys", () => {
    expect(hashUnit("a:1")).toBe(hashUnit("a:1"));
    const us = Array.from({ length: 2000 }, (_, i) => hashUnit(`nation-${i}:${T0 + i * HOUR}`));
    expect(us.every((u) => u > 0 && u < 1)).toBe(true);
    const mean = us.reduce((a, b) => a + b, 0) / us.length;
    expect(mean).toBeGreaterThan(0.47);
    expect(mean).toBeLessThan(0.53);
  });

  it("is never below the minimum and averages the configured mean", () => {
    const gaps = Array.from({ length: 4000 }, (_, i) => issueGapMs(`nation-${i % 40}`, T0 + i * 977 * 1000));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(MIN_ISSUE_GAP_IX_DAYS * DAY);
    // the tail is cut: a nation with anything to do never waits more than about a week
    expect(Math.max(...gaps)).toBeLessThanOrEqual(MAX_ISSUE_GAP_IX_DAYS * DAY + 1);
    const meanDays = gaps.reduce((a, b) => a + b, 0) / gaps.length / DAY;
    expect(meanDays).toBeGreaterThan(MEAN_ISSUE_GAP_IX_DAYS * 0.93);
    expect(meanDays).toBeLessThan(MEAN_ISSUE_GAP_IX_DAYS * 1.07);
  });

  it("makes a nation with no issues due at once, not due right after one, and due once its gap is up", () => {
    expect(issueDue("c1", [], T0)).toBe(true);
    const recent = [{ createdIxTime: T0 - 30 * DAY }, { createdIxTime: T0 }];
    const gap = issueGapMs("c1", T0);
    expect(issueDue("c1", recent, T0 + HOUR)).toBe(false);
    expect(issueDue("c1", recent, T0 + gap - 1)).toBe(false);
    expect(issueDue("c1", recent, T0 + gap)).toBe(true);
  });
});

describe("the paced cadence", () => {
  it("averages about 7 / mean gap issues a week for an always-eligible nation", () => {
    const counts = Array.from({ length: 30 }, (_, i) => simulate(`nation-${i}`, 56, HOUR).length / 8);
    const perWeek = counts.reduce((a, b) => a + b, 0) / counts.length;
    const expected = 7 / MEAN_ISSUE_GAP_IX_DAYS;
    expect(perWeek).toBeGreaterThan(expected * 0.85);
    expect(perWeek).toBeLessThan(expected * 1.1);
  });

  it("does not depend on how often the cron runs", () => {
    const total = (stepMs: number) =>
      Array.from({ length: 40 }, (_, i) => simulate(`nation-${i}`, 56, stepMs).length).reduce((a, b) => a + b, 0);
    const hourly = total(HOUR);
    const every10Min = total(HOUR / 6);
    const every6Hours = total(6 * HOUR);
    expect(Math.abs(hourly - every10Min) / hourly).toBeLessThan(0.06);
    expect(Math.abs(hourly - every6Hours) / hourly).toBeLessThan(0.1);
  });

  it("resumes after a long outage with one issue, not a burst", () => {
    const recent = [{ createdIxTime: T0 }];
    const after = T0 + 60 * DAY;
    expect(selectPacedCandidates([{ probability: 1 }, { probability: 1 }], recent, "c1", after, 3)).toHaveLength(1);
  });

  it("hands out nothing when the caps leave no room or nothing triggered", () => {
    expect(selectPacedCandidates([{ probability: 1 }], [], "c1", T0, 0)).toEqual([]);
    expect(selectPacedCandidates([], [], "c1", T0, 3)).toEqual([]);
  });
});

describe("the weighted pick", () => {
  it("draws each candidate in proportion to its probability, never one with none", () => {
    const random = lcg(5);
    const candidates = [
      { id: "crisis", probability: 0.9 },
      { id: "debate", probability: 0.3 },
      { id: "never", probability: 0 },
    ];
    const tally: Record<string, number> = { crisis: 0, debate: 0, never: 0 };
    for (let i = 0; i < 6000; i++) tally[pickWeighted(candidates, 1, random)[0]!.id]!++;
    expect(tally.never).toBe(0);
    expect(tally.crisis! / tally.debate!).toBeGreaterThan(2.6);
    expect(tally.crisis! / tally.debate!).toBeLessThan(3.4);
  });

  it("returns up to n distinct candidates", () => {
    const picked = pickWeighted(
      [{ probability: 0.2 }, { probability: 0.4 }, { probability: 0.6 }],
      2,
      lcg(1)
    );
    expect(picked).toHaveLength(2);
    expect(new Set(picked).size).toBe(2);
  });
});

type Cand = { probability: number; template: { id: string; slug: string; domain: string; baseSeverity: string } };
const cand = (slug: string, domain: string, probability = 0.5, baseSeverity = "medium"): Cand => ({
  probability,
  template: { id: slug, slug, domain, baseSeverity },
});

describe("routine fallback", () => {
  it("offers routine issues only when nothing else qualifies", () => {
    const routine = [cand("routine_census", "political"), cand("routine_festival", "social")];
    const real = cand("inflation_spiral", "economic");
    expect(withRoutineFallback([...routine, real])).toEqual([real]);
    expect(withRoutineFallback(routine)).toEqual(routine);
    expect(withRoutineFallback([])).toEqual([]);
    expect(isRoutineSlug("routine_census")).toBe(true);
    expect(isRoutineSlug("inflation_spiral")).toBe(false);
  });
});

describe("soft domain balance", () => {
  const templates = [
    { id: "a", domain: "economic" },
    { id: "b", domain: "economic" },
    { id: "c", domain: "political" },
  ];
  const recent = [
    { templateId: "a", createdIxTime: T0 },
    { templateId: "b", createdIxTime: T0 - DAY },
    { templateId: "c", createdIxTime: T0 - 20 * DAY },
  ];

  it("weighs down the domains the nation saw most recently, never to zero", () => {
    const [econ, pol, env] = balanceDomains(
      [cand("x", "economic"), cand("y", "political"), cand("z", "environmental")],
      recent,
      templates
    );
    expect(env!.probability).toBe(0.5);
    expect(pol!.probability).toBeLessThan(0.5);
    expect(econ!.probability).toBeLessThan(pol!.probability);
    expect(econ!.probability).toBeGreaterThan(0);
  });

  it("never weighs down a crisis", () => {
    const [crisis] = balanceDomains([cand("x", "economic", 0.9, "critical")], recent, templates);
    expect(crisis!.probability).toBe(0.9);
  });

  it("splits a domain's weight among its candidates, so a crowded domain is not more likely for its numbers", () => {
    const [a, b, c] = balanceDomains([cand("a1", "economic"), cand("a2", "economic"), cand("p", "political")], [], []);
    expect(a!.probability).toBe(0.25);
    expect(b!.probability).toBe(0.25);
    expect(c!.probability).toBe(0.5);
  });

  it("changes nothing for a nation with no history", () => {
    const cands = [cand("x", "economic"), cand("y", "social")];
    expect(balanceDomains(cands, [], templates)).toEqual(cands);
  });
});
