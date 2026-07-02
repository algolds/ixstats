/**
 * Intent package assembly (design-bible v2, migration plan §1).
 *
 * A player states a goal in plain language; the "government" returns three
 * packages — Measured / Moderate / Extreme — each showing the concrete budget
 * lines + policy levers it moves (≤4 changes), plus its projected stakeholder
 * acceptance. Deterministic + keyword-driven (no LLM): the "AI" is the framing.
 *
 * HARD RULE (user decision 2026-07): packages NEVER touch core stats
 * (population / GDP / GDP-per-capita / tiers / baseline). Those are Editor-only.
 * assemblePackages() asserts this; forbiddenFieldsUsed() is the runtime guard.
 */

export type Tier = "measured" | "moderate" | "extreme";
export type Acceptance = "good" | "mid" | "bad";

export interface ChangeLine {
  kind: "budget" | "policy" | "statement" | "foreign";
  label: string;
  detail: string;
  deptCategory?: string; // budget kind: which GovernmentDepartment.category to move
  deltaPercent?: number; // budget kind: allocatedPercent delta to apply (bounded)
}
export interface IntentConsequence {
  targetModel: "Country" | "GovernmentStructure" | "InternalStabilityMetrics";
  targetField: string;
  operation: "add" | "subtract";
  value: number;
}
export interface IntentPackage {
  tier: Tier;
  title: string;
  blurb: string;
  changes: ChangeLine[];
  consequences: IntentConsequence[];
  acceptance: Acceptance;
  risk: "stable" | "volatile" | "high-risk";
  civCapCost: number;
}

// Core stats an Intent may never move — Editor-only (locked levers).
export const FORBIDDEN_FIELDS = new Set([
  "currentTotalGdp",
  "currentGdpPerCapita",
  "currentPopulation",
  "nominalGDP",
  "realGDPGrowthRate",
  "populationGrowthRate",
  "economicTier",
  "populationTier",
  "baselineDate",
  "landArea",
]);

export function forbiddenFieldsUsed(pkgs: IntentPackage[]): string[] {
  const hits: string[] = [];
  for (const p of pkgs)
    for (const c of p.consequences) if (FORBIDDEN_FIELDS.has(c.targetField)) hits.push(c.targetField);
  return hits;
}

// ── goal classification (keyword → category, plus FP target parse) ──────────
export type Category =
  | "defense" | "foreign" | "fiscal" | "economy" | "social" | "infrastructure" | "security";

const KEYWORDS: Record<Category, string[]> = {
  defense: ["war", "military", "navy", "army", "defen", "mobiliz", "arms", "troop", "missile", "border security"],
  foreign: ["ally", "alliance", "treaty", "diplomat", "foreign", "trade deal", "embassy", "sever ties", "relations with", "war with"],
  fiscal: ["tax", "budget", "deficit", "debt", "spend", "inflation", "subsid", "austerity"],
  economy: ["industr", "job", "employ", "wage", "labor", "labour", "housing", "growth", "trade", "energy", "manufactur"],
  social: ["health", "education", "welfare", "poverty", "pension", "school", "hospital", "public service"],
  infrastructure: ["road", "rail", "transit", "port", "grid", "infrastructure", "bridge", "airport", "broadband", "coast"],
  security: ["crime", "police", "corrupt", "surveillance", "unrest", "protest", "riot", "law and order"],
};

// category → real GovernmentDepartment.category (for budget writes)
export const CATEGORY_TO_DEPT: Record<Category, string> = {
  defense: "Defense",
  foreign: "Foreign Affairs",
  fiscal: "Finance",
  economy: "Commerce",
  social: "Health",
  infrastructure: "Transportation",
  security: "Interior",
};
// category → the Power Broker whose domain it touches (for acceptance projection)
export const CATEGORY_TO_BROKER: Record<Category, string | null> = {
  defense: "generals",
  foreign: null,
  fiscal: "magnates",
  economy: "magnates",
  social: "technocrats",
  infrastructure: "magnates",
  security: "party",
};
export const NOTCH_PERCENT = 1.5; // one budget "notch" = +1.5 allocatedPercent

/** Nudge base acceptance by the aligned broker's disposition. Pure + testable. */
export function weightAcceptance(
  base: Acceptance,
  opts: { brokerUnlocked?: boolean; brokerSatisfied?: boolean }
): Acceptance {
  const order: Acceptance[] = ["bad", "mid", "good"];
  let i = order.indexOf(base);
  if (opts.brokerUnlocked) i = Math.min(2, i + 1); // acting in a broker's domain pleases them
  else if (opts.brokerUnlocked === false && opts.brokerSatisfied === false) i = Math.max(0, i - 1);
  return order[i]!;
}

export function classifyGoal(goal: string): { category: Category; target?: string } {
  const g = goal.toLowerCase();
  let best: Category = "economy";
  let bestHits = 0;
  for (const cat of Object.keys(KEYWORDS) as Category[]) {
    const hits = KEYWORDS[cat].filter((k) => g.includes(k)).length;
    if (hits > bestHits) { bestHits = hits; best = cat; }
  }
  // foreign target: "with Burgundie", "against Karth", "ally with X"
  const m = goal.match(/\b(?:with|against|toward|to)\s+([A-Z][A-Za-z'\- ]{2,30})/);
  const target = m?.[1]?.trim();
  if (target && (best === "foreign" || /war|ally|treaty|ties|relations/.test(g))) return { category: "foreign", target };
  return { category: best, target: best === "foreign" ? target : undefined };
}

// ── category recipe: one budget line, one policy, and which fields move ─────
interface Recipe {
  budgetLine: string;
  policyName: string;
  statement: string;
  // improves (a good-side field) and strains (a cost-side field)
  improve: IntentConsequence;
  strain: IntentConsequence;
}
const RECIPES: Record<Category, Recipe> = {
  defense: {
    budgetLine: "Defense", policyName: "Mobilization Directive",
    statement: "issue a firm statement of resolve",
    improve: { targetModel: "GovernmentStructure", targetField: "politicalStability", operation: "add", value: 1 },
    strain: { targetModel: "Country", targetField: "publicApproval", operation: "subtract", value: 1 },
  },
  foreign: {
    budgetLine: "Foreign Affairs", policyName: "Foreign Policy Realignment",
    statement: "signal intent through diplomatic channels",
    improve: { targetModel: "Country", targetField: "diplomaticStanding", operation: "add", value: 1 },
    strain: { targetModel: "GovernmentStructure", targetField: "politicalStability", operation: "subtract", value: 1 },
  },
  fiscal: {
    budgetLine: "Treasury", policyName: "Fiscal Adjustment Act",
    statement: "publish a budget statement",
    improve: { targetModel: "Country", targetField: "inflationRate", operation: "subtract", value: 0.3 },
    strain: { targetModel: "Country", targetField: "publicApproval", operation: "subtract", value: 1.5 },
  },
  economy: {
    budgetLine: "Commerce & Industry", policyName: "Industrial Strategy",
    statement: "announce an economic drive",
    improve: { targetModel: "Country", targetField: "unemploymentRate", operation: "subtract", value: 0.3 },
    strain: { targetModel: "Country", targetField: "publicApproval", operation: "add", value: 0 },
  },
  social: {
    budgetLine: "Health & Welfare", policyName: "Public Services Reform",
    statement: "commit to a service guarantee",
    improve: { targetModel: "InternalStabilityMetrics", targetField: "trustInGovernment", operation: "add", value: 1 },
    strain: { targetModel: "Country", targetField: "inflationRate", operation: "add", value: 0.2 },
  },
  infrastructure: {
    budgetLine: "Public Works", policyName: "Infrastructure Program",
    statement: "break ground on a flagship project",
    improve: { targetModel: "Country", targetField: "infrastructureRating", operation: "add", value: 1 },
    strain: { targetModel: "Country", targetField: "publicApproval", operation: "add", value: 0 },
  },
  security: {
    budgetLine: "Interior & Policing", policyName: "Public Order Act",
    statement: "address the nation on security",
    improve: { targetModel: "InternalStabilityMetrics", targetField: "socialCohesion", operation: "add", value: 1 },
    strain: { targetModel: "InternalStabilityMetrics", targetField: "trustInGovernment", operation: "subtract", value: 0.5 },
  },
};

const TIER_SCALE: Record<Tier, number> = { measured: 1, moderate: 2, extreme: 3.5 };
const TIER_ACCEPT: Record<Tier, Acceptance> = { measured: "good", moderate: "mid", extreme: "bad" };
const TIER_RISK: Record<Tier, IntentPackage["risk"]> = { measured: "stable", moderate: "volatile", extreme: "high-risk" };
const TIER_CIVCAP: Record<Tier, number> = { measured: 5, moderate: 12, extreme: 25 };

function scale(c: IntentConsequence, f: number): IntentConsequence {
  return { ...c, value: Math.round(c.value * f * 100) / 100 };
}

function buildPackage(tier: Tier, cat: Category, goal: string, target?: string): IntentPackage {
  const r = RECIPES[cat];
  const f = TIER_SCALE[tier];
  const changes: ChangeLine[] = [];
  const consequences: IntentConsequence[] = [];

  // 1) budget line (all tiers) — one "notch" per tier step
  const notches = tier === "measured" ? 1 : tier === "moderate" ? 2 : 3;
  changes.push({
    kind: "budget",
    label: `${r.budgetLine} budget +${notches} notch${notches > 1 ? "es" : ""}`,
    detail: "reallocated from the general fund",
    deptCategory: CATEGORY_TO_DEPT[cat],
    deltaPercent: notches * NOTCH_PERCENT,
  });

  // 2) statement (measured) or policy (moderate/extreme)
  if (tier === "measured") {
    changes.push({ kind: cat === "foreign" ? "foreign" : "statement", label: r.statement, detail: "low-cost, high-acceptance" });
  } else {
    changes.push({ kind: "policy", label: `Enact "${r.policyName}"`, detail: tier === "extreme" ? "an aggressive mandate" : "a targeted mandate" });
    consequences.push(scale(r.improve, f));
    consequences.push(scale(r.strain, f));
  }

  // 3) extreme adds a second lever + a bigger cost
  if (tier === "extreme") {
    changes.push({ kind: cat === "foreign" ? "foreign" : "policy", label: cat === "foreign" && target ? `Escalate posture toward ${target}` : `Emergency ${r.budgetLine.toLowerCase()} measures`, detail: "unlikely to clear stakeholders easily" });
    consequences.push(scale(r.strain, f * 0.6));
  }
  // measured still nudges the improve field a touch (so it isn't inert)
  if (tier === "measured") consequences.push(scale(r.improve, 0.5));

  const titles: Record<Tier, string> = { measured: "Measured", moderate: "Moderate", extreme: "Extreme" };
  const blurbs: Record<Tier, string> = {
    measured: "Lowest impact, easiest for stakeholders to accept.",
    moderate: "Balanced impact and acceptance — the workhorse option.",
    extreme: "Big changes, unlikely to be adopted without a fight.",
  };
  return {
    tier, title: titles[tier], blurb: blurbs[tier],
    changes: changes.slice(0, 4), consequences,
    acceptance: TIER_ACCEPT[tier], risk: TIER_RISK[tier], civCapCost: TIER_CIVCAP[tier],
  };
}

export function assemblePackages(goal: string): {
  category: Category; target?: string; packages: IntentPackage[];
} {
  const { category, target } = classifyGoal(goal);
  const packages = (["measured", "moderate", "extreme"] as Tier[]).map((t) => buildPackage(t, category, goal, target));
  const bad = forbiddenFieldsUsed(packages);
  if (bad.length) throw new Error(`Intent package touched locked core stats: ${bad.join(", ")}`);
  return { category, target, packages };
}

// ── self-check ──────────────────────────────────────────────────────────────
export function demo() {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("assemble demo failed: " + m); };
  const war = assemblePackages("Prepare for war with Burgundie");
  assert(war.category === "foreign" && war.target === "Burgundie", "war→foreign+target");
  assert(war.packages.length === 3, "3 tiers");
  for (const p of war.packages) assert(p.changes.length <= 4, "≤4 changes");
  assert(war.packages[0]!.acceptance === "good" && war.packages[2]!.acceptance === "bad", "acceptance ordering");
  assert(forbiddenFieldsUsed(war.packages).length === 0, "no core-stat fields");
  const house = assemblePackages("Make housing affordable");
  assert(house.category === "economy", "housing→economy");
  // budget change carries structured dept + delta
  const b = war.packages[1]!.changes.find((c) => c.kind === "budget")!;
  assert(b.deptCategory === "Foreign Affairs" && (b.deltaPercent ?? 0) > 0, "budget change is structured");
  // acceptance weighting: aligned unlocked broker bumps a hard-sell toward contested
  assert(weightAcceptance("bad", { brokerUnlocked: true }) === "mid", "broker unlock bumps acceptance");
  assert(weightAcceptance("good", { brokerUnlocked: true }) === "good", "acceptance caps at good");
  assert(weightAcceptance("mid", {}) === "mid", "no broker = unchanged");
  return "ok";
}
if (typeof require !== "undefined" && require.main === module) console.log(demo());
