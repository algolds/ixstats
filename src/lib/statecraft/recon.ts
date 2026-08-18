/**
 * Statecraft recon — the never-lie fog function.
 *
 * A Meeting reveals an issue option's hard `consequences`, but only as far as your
 * government can actually see. The fog is NOT arbitrary: it's your atomic build's real
 * blind spots. A Stratocracy (no consent-tracking components) genuinely can't read
 * popularity; a Democratic + Electoral build can. The engine may withhold or caveat,
 * never fabricate. See plans/statecraft-stage1.md (S1.B) and plans/mycountry-statecraft.md §5.
 *
 * Pure: no React, no DB. Caller passes the country's active components/departments.
 */

export type ReconState = "revealed" | "greyed" | "questioned";
export type ReconDomain = "approval" | "economic" | "stability" | "diplomatic" | "social";

export interface ReconInput {
  componentTypes: string[]; // active GovernmentComponent.componentType values
  departmentCategories: string[]; // active GovernmentDepartment.category values
  overCapacity: boolean; // recon spend exceeded the weekly Capacity pool
  lowEfficiency: boolean; // governmentEffectiveness below threshold
}

export interface ReconReveal {
  targetField: string;
  domain: ReconDomain;
  state: ReconState;
  reason?: string; // never-lie caption for greyed/questioned
}

/** Which components/departments let a government *see* a given domain. */
const DOMAIN_RULES: Record<ReconDomain, { components: string[]; departments: string[] }> = {
  // Consent-tracking: an autocracy structurally doesn't measure popularity well.
  approval: {
    components: [
      "ELECTORAL_LEGITIMACY",
      "DEMOCRATIC_PROCESS",
      "PARTICIPATORY_DEMOCRACY",
      "DIRECT_DEMOCRACY",
      "CITIZEN_ENGAGEMENT",
    ],
    departments: [],
  },
  economic: {
    components: [
      "FREE_MARKET_SYSTEM",
      "PLANNED_ECONOMY",
      "MIXED_ECONOMY",
      "SOCIAL_MARKET_ECONOMY",
      "STATE_CAPITALISM",
      "KNOWLEDGE_ECONOMY",
      "ECONOMIC_PLANNING",
      "RESOURCE_BASED_ECONOMY",
    ],
    departments: ["Finance", "Commerce", "Labor", "Energy"],
  },
  stability: {
    components: [
      "RULE_OF_LAW",
      "SURVEILLANCE_SYSTEM",
      "INDEPENDENT_JUDICIARY",
      "SOCIAL_PRESSURE",
      "MILITARY_ENFORCEMENT",
    ],
    departments: ["Interior", "Justice", "Defense"],
  },
  diplomatic: {
    components: [
      "MULTILATERAL_DIPLOMACY",
      "BILATERAL_RELATIONS",
      "REGIONAL_INTEGRATION",
      "INTERNATIONAL_LAW",
      "SECURITY_ALLIANCES",
    ],
    departments: ["Foreign Affairs"],
  },
  social: {
    components: [
      "WELFARE_STATE",
      "UNIVERSAL_HEALTHCARE",
      "PUBLIC_EDUCATION",
      "SOCIAL_SAFETY_NET",
      "ENVIRONMENTAL_PROTECTION",
      "MINORITY_RIGHTS",
    ],
    departments: ["Health", "Education", "Social Services", "Housing", "Environment", "Culture"],
  },
};

/** Bucket a consequence's targetField into a domain by name heuristics. */
export function classifyDomain(targetField: string): ReconDomain {
  const f = targetField.toLowerCase();
  if (/(approval|popular|support|legitim|mandate)/.test(f)) return "approval";
  if (/(diplomat|relation|reputation|influence|foreign|alliance)/.test(f)) return "diplomatic";
  if (/(stability|crime|unrest|cohesion|riot|protest|trust|conflict|security)/.test(f))
    return "stability";
  if (/(health|educat|literacy|welfare|poverty|housing|environment|emission)/.test(f))
    return "social";
  // economic is the default bucket (gdp/growth/tax/budget/income/trade/wage/…)
  return "economic";
}

function hasCapability(domain: ReconDomain, input: ReconInput): boolean {
  const rule = DOMAIN_RULES[domain];
  return (
    rule.components.some((c) => input.componentTypes.includes(c)) ||
    rule.departments.some((d) => input.departmentCategories.includes(d))
  );
}

/**
 * Per-consequence reveal state. Greyed when the government structurally can't assess
 * that domain; questioned when it can but is over-capacity / low-efficiency; revealed
 * otherwise. Never fabricates a value — only states whether one can be trusted.
 */
export function revealConsequences(
  consequences: { targetField: string }[],
  input: ReconInput
): ReconReveal[] {
  return consequences.map((c) => {
    const domain = classifyDomain(c.targetField);
    if (!hasCapability(domain, input)) {
      return {
        targetField: c.targetField,
        domain,
        state: "greyed",
        reason: `No ${domain} component or department to assess this`,
      };
    }
    if (input.overCapacity || input.lowEfficiency) {
      return {
        targetField: c.targetField,
        domain,
        state: "questioned",
        reason: input.overCapacity
          ? "Civil service over capacity — estimate may be inaccurate"
          : "Low government efficiency — estimate may be inaccurate",
      };
    }
    return { targetField: c.targetField, domain, state: "revealed" };
  });
}
