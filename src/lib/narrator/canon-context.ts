import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

/**
 * Canon context for the narrator. The lore-first mandate in one rule:
 * the narrator NEVER generates canon, it only narrates over the facts in here.
 * Every field is read from existing canonical sources (country record, the
 * CountryChangeLog ledger, diplomatic relations, the wiki page pointer) — the
 * model is not allowed to assert anything that isn't present below.
 */
export interface CanonContext {
  nation: {
    name: string;
    leader?: string | null;
    governmentType?: string | null;
    economicTier?: string | null;
    region?: string | null;
    continent?: string | null;
    religion?: string | null;
    population?: number | null;
    gdpPerCapita?: number | null;
  };
  state: {
    approval: number;
    stability: number;
  };
  history: Array<{ description: string; appliedIxTime: number }>;
  diplomacy: Array<{ otherName: string; relationship: string; strength: number }>;
  /** Pointer to the canonical source of truth — the wiki page, if linked. */
  canonSource?: string | null;
}

const RECENT_EVENTS = 5;
const TOP_RELATIONS = 5;

/**
 * Assemble the facts the narrator is allowed to use for one country.
 * Read-only. Each section degrades gracefully — a failed section just omits
 * those facts rather than fabricating them.
 */
export async function buildCanonContext(
  db: PrismaClient,
  countryId: string
): Promise<CanonContext | null> {
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: {
      name: true,
      leader: true,
      governmentType: true,
      economicTier: true,
      region: true,
      continent: true,
      religion: true,
      currentPopulation: true,
      currentGdpPerCapita: true,
      publicApproval: true,
      wikiPageTitle: true,
      governmentStructure: { select: { politicalStability: true } },
      stabilityMetrics: { select: { stabilityScore: true } },
    },
  });

  if (!country) return null;

  // Recent history from the ledger → continuity. The narrator can reference
  // prior beats because they actually happened and are recorded.
  let history: CanonContext["history"] = [];
  try {
    const logs = await db.countryChangeLog.findMany({
      where: { countryId },
      select: { description: true, appliedIxTime: true },
      orderBy: { appliedIxTime: "desc" },
      take: RECENT_EVENTS,
    });
    history = logs;
  } catch (e) {
    console.error("[canon-context] ledger read failed:", e);
  }

  // Diplomatic posture → grounded neighbors (real names, real relationships).
  let diplomacy: CanonContext["diplomacy"] = [];
  try {
    const relations = await db.diplomaticRelation.findMany({
      where: { OR: [{ country1: countryId }, { country2: countryId }] },
      select: { country1: true, country2: true, relationship: true, strength: true },
      orderBy: { strength: "desc" },
      take: TOP_RELATIONS,
    });
    const otherIds = relations.map((r) => (r.country1 === countryId ? r.country2 : r.country1));
    const others = otherIds.length
      ? await db.country.findMany({
          where: { id: { in: otherIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(others.map((o) => [o.id, o.name]));
    diplomacy = relations
      .map((r) => {
        const otherId = r.country1 === countryId ? r.country2 : r.country1;
        const otherName = nameById.get(otherId);
        return otherName
          ? { otherName, relationship: r.relationship, strength: r.strength }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  } catch (e) {
    console.error("[canon-context] diplomacy read failed:", e);
  }

  return {
    nation: {
      name: country.name,
      leader: country.leader,
      governmentType: country.governmentType,
      economicTier: country.economicTier,
      region: country.region,
      continent: country.continent,
      religion: country.religion,
      population: country.currentPopulation,
      gdpPerCapita: country.currentGdpPerCapita,
    },
    state: {
      approval: country.publicApproval ?? 50,
      stability:
        country.governmentStructure?.politicalStability ??
        country.stabilityMetrics?.stabilityScore ??
        50,
    },
    history,
    diplomacy,
    canonSource: country.wikiPageTitle,
  };
}

/** Render the context as the authoritative fact block for the prompt. Pure. */
export function formatCanonContext(ctx: CanonContext): string {
  const n = ctx.nation;
  const lines: string[] = ["[Canon Context — the ONLY facts you may reference]"];

  lines.push(`Nation: ${n.name}`);
  if (n.leader) lines.push(`Leader: ${n.leader}`);
  if (n.governmentType) lines.push(`Government: ${n.governmentType}`);
  if (n.region || n.continent) lines.push(`Located in: ${[n.region, n.continent].filter(Boolean).join(", ")}`);
  if (n.religion) lines.push(`Predominant religion: ${n.religion}`);
  if (n.economicTier) lines.push(`Economic tier: ${n.economicTier}`);
  if (typeof n.population === "number") lines.push(`Population: ${Math.round(n.population).toLocaleString()}`);
  if (typeof n.gdpPerCapita === "number") lines.push(`GDP per capita: ${Math.round(n.gdpPerCapita).toLocaleString()}`);
  lines.push(`Public approval: ${Math.round(ctx.state.approval)}%`);
  lines.push(`Political stability: ${Math.round(ctx.state.stability)}%`);

  if (ctx.diplomacy.length) {
    lines.push("Key relationships:");
    for (const d of ctx.diplomacy) lines.push(`  - ${d.otherName}: ${d.relationship}`);
  }

  if (ctx.history.length) {
    lines.push("Recent history (most recent first — narrate continuity from these, do not contradict them):");
    for (const h of ctx.history) lines.push(`  - ${h.description}`);
  }

  if (ctx.canonSource) lines.push(`Canonical source: wiki page "${ctx.canonSource}"`);

  return lines.join("\n");
}

/**
 * Stable short hash of the canon facts. Include in cache keys so narration
 * self-invalidates when the underlying canon changes (fixes the 14-day stale
 * card problem) without invalidating on irrelevant churn.
 */
export function canonContextHash(ctx: CanonContext): string {
  return createHash("sha1").update(JSON.stringify(ctx)).digest("hex").slice(0, 12);
}
