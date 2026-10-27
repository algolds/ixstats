/**
 * Relationship standing (WP-DE: P1-20, P1-27): one band function on one 0-100 scale, which drift and every writer
 * store in lower case; drift actually applies its half-point steps (plain rounding swallowed them above 50), a goal
 * only one side declared drifts at half rate, and "last contact" moves only when the strength does.
 */
import { describe, it, expect } from "@jest/globals";
import { getStandingBand, OPENING_RELATION_STRENGTH } from "~/lib/diplomacy/relation-bands";
import {
  driftRule,
  planRelationDrift,
  stochasticStep,
  type DriftRelation,
} from "~/lib/diplomacy/relation-drift";
import { pickPostingAccount } from "~/lib/thinkpages/posting-account";

const rel = (over: Partial<DriftRelation> = {}): DriftRelation => ({
  strength: 50,
  relationship: "neutral",
  recentActivity: null,
  goalCountry1: null,
  goalCountry2: null,
  ...over,
});
const always = (value: number) => () => value;

describe("the standing band", () => {
  it("bands the 0-100 scale with neutral around 50, and a new embassy's relation reads neutral", () => {
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map((s) => getStandingBand(s).key)).toEqual([
      "hostile",
      "hostile",
      "tense",
      "tense",
      "neutral",
      "neutral",
      "friendly",
      "friendly",
      "allied",
      "allied",
    ]);
    expect(getStandingBand(OPENING_RELATION_STRENGTH).label).toBe("Neutral");
  });
});

describe("diplomatic drift", () => {
  it("a -0.5 step lowers strength half the time (60 no longer sticks at 60)", () => {
    const sixty = rel({
      strength: 60,
      relationship: "friendly",
      recentActivity: "Standard drift toward neutrality",
    });
    expect(planRelationDrift(sixty, always(0.2))).toMatchObject({ strength: 59 });
    expect(planRelationDrift(sixty, always(0.8))).toBeNull();
    // 40 runs of reversion from 60 with a fair coin end near 50
    let strength = 60;
    let flip = 0;
    for (let run = 0; run < 40; run++) {
      const update = planRelationDrift(rel({ strength }), () => (flip++ % 2 === 0 ? 0.2 : 0.8));
      strength = update?.strength ?? strength;
    }
    expect(strength).toBe(50);
  });

  it("oblique goals decline; a one-sided goal drifts at half the paired rate", () => {
    expect(driftRule(rel({ goalCountry1: "ALLY", goalCountry2: "COEXIST" })).drift).toBe(-0.5);
    const oblique = rel({ strength: 70, goalCountry1: "ALLY", goalCountry2: "COEXIST" });
    expect(planRelationDrift(oblique, always(0))).toMatchObject({ strength: 69 });
    expect(driftRule(rel({ goalCountry1: "ALLY" })).drift).toBe(1.5);
    expect(driftRule(rel({ goalCountry2: "RIVAL" })).drift).toBe(-1.5);
    expect(driftRule(rel({ goalCountry1: "ALLY", goalCountry2: "ALLY" })).drift).toBe(3);
    expect(stochasticStep(1.5, always(0.4))).toBe(2);
    expect(stochasticStep(1.5, always(0.6))).toBe(1);
    expect(stochasticStep(-1.5, always(0.4))).toBe(-2);
  });

  it("stores the band in lower case, and moves last contact only with the strength", () => {
    const now = new Date("2026-10-25T00:00:00Z");
    // An upper-case label left by the old drift is normalised without touching last contact
    expect(planRelationDrift(rel({ relationship: "NEUTRAL" }), always(0.9), now)).toEqual({
      strength: 50,
      relationship: "neutral",
      recentActivity: null,
    });
    const moved = planRelationDrift(rel({ strength: 81, relationship: "allied" }), always(0), now);
    expect(moved).toMatchObject({ strength: 80, relationship: "allied", lastContact: now });
    // Nothing to change: no write at all (a null activity is not a change from "")
    expect(planRelationDrift(rel(), always(0), now)).toBeNull();
  });
});

describe("the ThinkPages posting account", () => {
  const account = (id: string, countryId: string | null, accountType: string) => ({
    id,
    countryId,
    accountType,
  });
  it("posts as the nation's official account, then any account of the nation, then the personal persona", () => {
    const personal = account("me", null, "personal");
    const citizen = account("cit", "c1", "citizen");
    const official = account("gov", "c1", "GOVERNMENT");
    expect(pickPostingAccount([personal, citizen, official], "c1")).toBe("gov");
    expect(pickPostingAccount([personal, citizen], "c1")).toBe("cit");
    expect(pickPostingAccount([personal, account("other", "c2", "government")], "c1")).toBe("me");
    expect(pickPostingAccount([], "c1")).toBeNull();
  });
});
