/**
 * Pure derivations behind the country overview (country DNA and its highlights, the condition
 * meters, region shares, the founding date, state leaders and the diplomatic picture). Every figure comes from the profile layer; a missing
 * input drops the item instead of defaulting it, so nothing here can invent a number.
 */
import type {
  ProfileIdentity,
  ProfileState,
  ProfileVitals,
  ProfileWorld,
} from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { formatPercent } from "~/app/countries/[slug]/_utils/profileLayer";
import type { BadgeVariant } from "~/components/ui/badge";
import { relationshipBadge } from "./labels";

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

/** The standing band's chips: up to five strengths (top half), then up to two weak points. */
export function standingHighlights(axes: readonly DnaAxis[]) {
  const sorted = [...axes].sort((a, b) => b.percentile - a.percentile);
  return {
    strengths: sorted.filter((a) => a.percentile >= 50).slice(0, 5),
    weaknesses: sorted
      .filter((a) => a.percentile < 50)
      .reverse()
      .slice(0, 2),
  };
}

export interface ConditionPillar {
  key: string;
  label: string;
  /** 0–100 meter value. */
  value: number;
  display: string;
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
      value: clamp(100 - v.unemployment),
      display: formatPercent(100 - v.unemployment),
    });
  if (v.publicApproval != null)
    pillars.push({
      key: "approval",
      label: "Public approval",
      value: clamp(v.publicApproval),
      display: formatPercent(v.publicApproval, 0),
    });
  if (v.stabilityScore != null)
    pillars.push({
      key: "stability",
      label: "Stability",
      value: clamp(v.stabilityScore),
      display: `${Math.round(v.stabilityScore)}/100`,
    });
  if (v.literacy != null)
    pillars.push({
      key: "literacy",
      label: "Literacy",
      value: clamp(v.literacy),
      display: formatPercent(v.literacy),
    });
  if (v.urbanShare != null)
    pillars.push({
      key: "urban",
      label: "Urbanisation",
      value: clamp(v.urbanShare),
      display: formatPercent(v.urbanShare),
    });
  return pillars;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * The state's leaders: the government record's executive offices, else the wiki infobox's
 * leaders. Offices with nothing on record are left out.
 */
export function stateLeaders(
  state: Pick<ProfileState, "government">,
  identity: Pick<ProfileIdentity, "leaders">
): { role: string; name: string }[] {
  const g = state.government;
  const offices: [string, string | null | undefined][] = [
    ["Head of state", g?.headOfState],
    ["Head of government", g?.headOfGovernment],
    ["Executive", g?.executive],
  ];
  const leaders = offices.flatMap(([role, name]) => (name ? [{ role, name }] : []));
  return leaders.length > 0
    ? leaders
    : identity.leaders.map((l) => ({ role: l.title, name: l.name }));
}

const PARTNER = new Set(["ALLIED", "FRIENDLY"]);
const TENSION = new Set(["TENSE", "HOSTILE", "WAR"]);

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
  };
}

interface RegionInput {
  id: string;
  name: string;
  population: number | null;
}

/**
 * Population by region: the largest few, each as a share of the whole (the nation's population,
 * else the regions' sum) and as a bar width against the largest. Null without regional figures.
 */
export function regionShares(
  subdivisions: readonly RegionInput[],
  population: number | null,
  limit = 4
) {
  const peopled = subdivisions
    .flatMap((s) => (s.population && s.population > 0 ? [{ ...s, population: s.population }] : []))
    .sort((a, b) => b.population - a.population);
  if (peopled.length === 0) return null;
  const total = Math.max(
    population ?? 0,
    peopled.reduce((sum, s) => sum + s.population, 0)
  );
  const top = peopled.slice(0, limit);
  const largest = top[0]!.population;
  const regions = top.map((s) => ({
    id: s.id,
    name: s.name,
    population: s.population,
    share: (s.population / total) * 100,
    width: (s.population / largest) * 100,
  }));
  const topShare = regions.reduce((sum, r) => sum + r.share, 0);
  return { regions, topShare, others: peopled.length - top.length };
}

/** The earliest founding date in the chronicle, for the Lore tab's headline. */
export function earliestFounding<T extends { kind: string; year: number }>(
  chronicle: readonly T[]
): T | null {
  return chronicle.reduce<T | null>(
    (first, e) => (e.kind === "founding" && (!first || e.year < first.year) ? e : first),
    null
  );
}

interface RelationNode {
  id: string;
  name: string;
  detail: string;
  /** The relationship's badge variant; null for an embassy without a relation. */
  variant: BadgeVariant | null;
}

/**
 * One node per foreign country: relations strongest first, then embassies; an embassy joins its
 * country's relation node ("Neutral · their embassy here") instead of repeating the country.
 */
export function relationNodes(
  world: Pick<ProfileWorld, "relations" | "embassies">
): RelationNode[] {
  const nodes: RelationNode[] = [...world.relations]
    .sort((a, b) => b.strength - a.strength)
    .map((r) => {
      const badge = relationshipBadge(r.relationship);
      return {
        id: `relation-${r.id}`,
        name: r.name,
        detail: badge.label,
        variant: badge.variant,
      };
    });
  for (const e of world.embassies) {
    const detail = e.role === "host" ? "Their embassy here" : "Our embassy there";
    const same = nodes.find((n) => n.name === e.countryName);
    if (same) same.detail = `${same.detail} · ${detail.toLowerCase()}`;
    else nodes.push({ id: `embassy-${e.id}`, name: e.countryName, detail, variant: null });
  }
  return nodes;
}
