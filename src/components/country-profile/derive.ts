/**
 * Pure derivations behind the Command profile's restored Sovereign Command OS pieces (the
 * national pulse, country DNA, condition matrix, state structure and diplomatic matrix). Every
 * figure comes from the profile layer; a missing input drops the item instead of defaulting it,
 * so nothing here can invent a number (the sample-data concepts used fixed "85/100"s).
 */
import type {
  ProfileIdentity,
  ProfileState,
  ProfileVitals,
  ProfileWorld,
} from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { formatPercent, formatRate } from "~/app/countries/[slug]/_utils/profileLayer";

/** Growth rates arrive as fractions (0.034) or percents (3.4); see `formatRate`. */
export function ratePercent(value: number | null): number | null {
  if (value == null) return null;
  return Math.abs(value) < 1 ? value * 100 : value;
}

// ─── National pulse ─────────────────────────────────────────────────────────

export type PulseTone = "success" | "info" | "warning" | "default";

export interface PulseStatus {
  label: string;
  tone: PulseTone;
  /** One factual sentence built from the readings. */
  summary: string;
}

/**
 * The national pulse (the retired CountryPulseBanner's rules) from real readings: expanding
 * above 3% growth, stable when growing with stability ≥ 75, headwinds when contracting,
 * otherwise consolidating. Null without a GDP growth reading.
 */
export function pulseStatus(
  v: Pick<ProfileVitals, "gdpGrowth" | "populationGrowth" | "stabilityScore">
): PulseStatus | null {
  const gdp = ratePercent(v.gdpGrowth);
  if (gdp == null) return null;
  const pop = ratePercent(v.populationGrowth);
  const parts = [`Real GDP growth of ${formatRate(v.gdpGrowth)}`];
  if (pop != null) parts.push(`population growth of ${formatRate(v.populationGrowth)}`);
  if (v.stabilityScore != null) parts.push(`stability at ${Math.round(v.stabilityScore)}/100`);
  const summary = `${joinList(parts)}.`;

  if (gdp > 3 && (pop == null || pop >= 0))
    return { label: "Rapid expansion", tone: "success", summary };
  if (gdp >= 0 && v.stabilityScore != null && v.stabilityScore >= 75)
    return { label: "Stable and prosperous", tone: "info", summary };
  if (gdp < 0) return { label: "Economic headwinds", tone: "warning", summary };
  return { label: "Consolidating", tone: "default", summary };
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// ─── Country DNA ────────────────────────────────────────────────────────────

export interface DnaAxis {
  key: string;
  label: string;
  /** 0–100, the census percentile (first place = 100). */
  percentile: number;
  rank: number;
  total: number;
  value: string;
}

/**
 * The country's DNA: its World Census standing per category as a percentile — the census's own
 * figure (`mycountry.getRankings`), else derived from the rank the same way. Ranks already
 * account for lower-is-better categories. Categories ranked among fewer than two nations carry
 * no signal and are dropped.
 */
export function toDnaAxes(rankings: ProfileWorld["rankings"]): DnaAxis[] {
  return rankings
    .filter((r) => r.total > 1 && r.rank >= 1 && r.rank <= r.total)
    .map((r) => ({
      key: r.category,
      label: r.category,
      percentile: Math.max(
        0,
        Math.min(100, Math.round(r.percentile ?? (1 - (r.rank - 1) / r.total) * 100))
      ),
      rank: r.rank,
      total: r.total,
      value: r.value,
    }));
}

/** "Strongest in X · weakest in Y" from the DNA (needs two or more axes). */
export function dnaSummary(axes: readonly DnaAxis[]): string | null {
  if (axes.length < 2) return null;
  const sorted = [...axes].sort((a, b) => b.percentile - a.percentile);
  const top = sorted[0]!;
  const bottom = sorted[sorted.length - 1]!;
  if (top.percentile === bottom.percentile) return null;
  return `Strongest in ${top.label.toLowerCase()}, weakest in ${bottom.label.toLowerCase()}.`;
}

// ─── Condition matrix ───────────────────────────────────────────────────────

export type ConditionKey = "employment" | "approval" | "stability" | "literacy" | "urban";

export interface ConditionPillar {
  key: ConditionKey;
  label: string;
  area: string;
  /** 0–100 meter value. */
  value: number;
  display: string;
  detail: string | null;
}

/**
 * The national condition matrix: the layer's readings that are already on a 0–100 scale, one
 * pillar per domain. Pillars without a reading are left out.
 */
export function conditionPillars(v: ProfileVitals): ConditionPillar[] {
  const pillars: ConditionPillar[] = [];
  if (v.unemployment != null)
    pillars.push({
      key: "employment",
      label: "Employment",
      area: "Economy",
      value: clamp(100 - v.unemployment),
      display: formatPercent(100 - v.unemployment),
      detail: `Unemployment ${formatPercent(v.unemployment)}`,
    });
  if (v.publicApproval != null)
    pillars.push({
      key: "approval",
      label: "Public approval",
      area: "Government",
      value: clamp(v.publicApproval),
      display: formatPercent(v.publicApproval, 0),
      detail: null,
    });
  if (v.stabilityScore != null)
    pillars.push({
      key: "stability",
      label: "Stability",
      area: "Institutions",
      value: clamp(v.stabilityScore),
      display: `${Math.round(v.stabilityScore)}/100`,
      detail: null,
    });
  if (v.literacy != null)
    pillars.push({
      key: "literacy",
      label: "Literacy",
      area: "Society",
      value: clamp(v.literacy),
      display: formatPercent(v.literacy),
      detail:
        v.lifeExpectancy != null ? `Life expectancy ${v.lifeExpectancy.toFixed(1)} yrs` : null,
    });
  if (v.urbanShare != null)
    pillars.push({
      key: "urban",
      label: "Urbanisation",
      area: "Territory",
      value: clamp(v.urbanShare),
      display: formatPercent(v.urbanShare),
      detail: null,
    });
  return pillars;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

// ─── State structure ────────────────────────────────────────────────────────

export type BranchKey = "executive" | "legislative" | "judicial";

export interface StateBranch {
  key: BranchKey;
  title: string;
  /** Offices and bodies, each with its role. */
  rows: { role: string; name: string }[];
}

/**
 * The constitutional state structure: the government record's offices and bodies, else the
 * wiki infobox's leaders for the executive. Branches with nothing on record are left out.
 */
export function stateBranches(
  state: Pick<ProfileState, "government" | "election">,
  identity: Pick<ProfileIdentity, "leaders">
): StateBranch[] {
  const g = state.government;
  const executive: StateBranch["rows"] = [];
  if (g?.headOfState) executive.push({ role: "Head of state", name: g.headOfState });
  if (g?.headOfGovernment) executive.push({ role: "Head of government", name: g.headOfGovernment });
  if (g?.executive) executive.push({ role: "Executive", name: g.executive });
  if (executive.length === 0)
    for (const leader of identity.leaders)
      executive.push({ role: leader.title, name: leader.name });

  const legislative: StateBranch["rows"] = [];
  if (g?.legislature) legislative.push({ role: "Legislature", name: g.legislature });
  const seats = state.election?.totalSeats ?? 0;
  if (legislative.length > 0 && seats > 0)
    legislative.push({ role: "Seats", name: seats.toLocaleString("en-US") });

  const judicial: StateBranch["rows"] = [];
  if (g?.judiciary) judicial.push({ role: "Judiciary", name: g.judiciary });

  const branches: StateBranch[] = [
    { key: "executive", title: "Executive", rows: executive },
    { key: "legislative", title: "Legislative", rows: legislative },
    { key: "judicial", title: "Judicial", rows: judicial },
  ];
  return branches.filter((b) => b.rows.length > 0);
}

// ─── Diplomatic matrix ──────────────────────────────────────────────────────

const PARTNER = new Set(["ALLIED", "FRIENDLY"]);
const TENSION = new Set(["TENSE", "HOSTILE", "WAR"]);

export interface DiplomaticMatrix {
  partners: ProfileWorld["relations"];
  tensions: ProfileWorld["relations"];
  relationCount: number;
  treatyCount: number;
  embassiesHosted: number;
  embassiesAbroad: number;
}

/** Partners (allied, friendly) and tensions (tense, hostile, war), strongest first. */
export function diplomaticMatrix(world: Pick<ProfileWorld, "relations" | "embassies">) {
  const byStrength = [...world.relations].sort((a, b) => b.strength - a.strength);
  return {
    partners: byStrength.filter((r) => PARTNER.has(r.relationship.toUpperCase())),
    tensions: byStrength.filter((r) => TENSION.has(r.relationship.toUpperCase())),
    relationCount: world.relations.length,
    treatyCount: world.relations.reduce((sum, r) => sum + r.treaties.length, 0),
    embassiesHosted: world.embassies.filter((e) => e.role === "host").length,
    embassiesAbroad: world.embassies.filter((e) => e.role === "guest").length,
  } satisfies DiplomaticMatrix;
}
