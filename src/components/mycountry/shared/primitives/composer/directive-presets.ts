/**
 * Directive presets: ready-made domestic goals, grouped by the domain players browse by.
 *
 * A preset is only a goal string. The Statecraft engine classifies it (src/lib/intent/assemble.ts
 * `classifyGoal`), so the engine category the composer shows can differ from the browsing domain
 * (a "Diplomacy" preset such as trade promotion is still a domestic directive).
 */

export const DIRECTIVE_DOMAINS = [
  "Economy",
  "Fiscal",
  "Social",
  "Infrastructure",
  "Security",
  "Defense",
  "Diplomacy",
  "Governance",
] as const;

export type DirectiveDomain = (typeof DIRECTIVE_DOMAINS)[number];

export interface DirectivePreset {
  domain: DirectiveDomain;
  label: string;
  keywords: string[];
}

const preset = (domain: DirectiveDomain, label: string, keywords: string[]): DirectivePreset => ({
  domain,
  label,
  keywords,
});

export const DIRECTIVE_PRESETS: readonly DirectivePreset[] = [
  preset("Economy", "Cool the housing market", ["housing", "market", "rent", "property"]),
  preset("Economy", "Create industrial manufacturing jobs", ["job", "manufacturing", "labor"]),
  preset("Economy", "Increase the minimum wage", ["wage", "minimum", "pay", "income"]),
  preset("Economy", "Subsidize small business innovation", ["business", "startup", "subsidy"]),
  preset("Economy", "Expand agricultural export subsidies", ["farm", "agriculture", "food"]),
  preset("Economy", "Deregulate commercial banking", ["bank", "finance", "credit"]),
  preset("Economy", "Attract foreign direct investment", ["foreign", "investment", "capital"]),
  preset("Economy", "Tame high consumer price inflation", ["inflation", "price", "cost"]),

  preset("Fiscal", "Reduce corporate income taxes", ["tax", "corporate", "revenue"]),
  preset("Fiscal", "Cut the government budget deficit", ["deficit", "budget", "debt"]),
  preset("Fiscal", "Introduce a luxury wealth surtax", ["tax", "wealth", "luxury"]),
  preset("Fiscal", "Increase infrastructure capital spending", ["spend", "infrastructure"]),
  preset("Fiscal", "Pay down the national debt", ["debt", "sovereign", "treasury"]),
  preset("Fiscal", "Streamline government procurement spending", ["waste", "procurement"]),
  preset("Fiscal", "Establish a sovereign wealth fund", ["fund", "sovereign", "reserve"]),
  preset("Fiscal", "Simplify personal income tax brackets", ["tax", "bracket", "income"]),

  preset("Social", "Expand national healthcare coverage", ["health", "hospital", "medical"]),
  preset("Social", "Increase public education funding", ["school", "education", "teacher"]),
  preset("Social", "Strengthen pensions and the safety net", ["pension", "welfare", "senior"]),
  preset("Social", "Subsidize childcare and parental leave", ["child", "family", "parental"]),
  preset("Social", "Build affordable public housing", ["housing", "public", "shelter"]),
  preset("Social", "Fund national mental health initiatives", ["mental", "health", "wellness"]),
  preset("Social", "Support Indigenous community cultural programs", ["indigenous", "culture"]),
  preset("Social", "Subsidize university tuition grants", ["university", "tuition", "grant"]),

  preset("Infrastructure", "Develop the national highway network", ["road", "highway", "bridge"]),
  preset("Infrastructure", "Upgrade the national power grid", ["grid", "energy", "electricity"]),
  preset("Infrastructure", "Construct a high-speed rail corridor", ["rail", "train", "transit"]),
  preset("Infrastructure", "Modernize deepwater seaports", ["port", "ship", "cargo"]),
  preset("Infrastructure", "Expand nationwide fiber internet", ["internet", "broadband", "fiber"]),
  preset("Infrastructure", "Build renewable solar and wind farms", ["solar", "wind", "renewable"]),
  preset("Infrastructure", "Upgrade urban water treatment plants", ["water", "sanitation"]),
  preset("Infrastructure", "Construct modern international airports", ["airport", "aviation"]),
  preset("Infrastructure", "Rehabilitate aging transport infrastructure", ["repair", "bridge"]),
  preset("Infrastructure", "Automate seaport container handling", ["port", "container", "dock"]),

  preset("Security", "Reduce urban crime and violence", ["crime", "police", "safety"]),
  preset("Security", "Increase community policing and patrols", ["police", "patrol", "street"]),
  preset("Security", "Crack down on organized crime and corruption", ["gang", "corruption"]),
  preset("Security", "Strengthen border control", ["border", "patrol", "immigration", "customs"]),
  preset("Security", "Fortify national cybersecurity", ["cyber", "hacker", "digital"]),
  preset("Security", "Speed up court trial throughput", ["court", "judge", "justice"]),
  preset("Security", "Launch anti-smuggling task forces", ["smuggling", "drugs", "customs"]),
  preset("Security", "Upgrade emergency response dispatch", ["emergency", "fire", "rescue"]),

  preset("Defense", "Boost military readiness", ["military", "defense", "army", "readiness"]),
  preset("Defense", "Modernize the naval fleet", ["navy", "ship", "fleet", "sea"]),
  preset("Defense", "Re-equip air force fighter squadrons", ["air", "jet", "fighter"]),
  preset("Defense", "Expand military research and development", ["tech", "research", "weapon"]),
  preset("Defense", "Raise defense personnel pay and benefits", ["pay", "salary", "soldier"]),
  preset("Defense", "Fortify coastal defenses", ["coastal", "fortify", "artillery"]),
  preset("Defense", "Hold joint military exercises", ["exercise", "joint", "drill"]),
  preset("Defense", "Establish a satellite defense unit", ["space", "satellite", "orbit"]),

  preset("Diplomacy", "Fund the foreign ministry's consular service", ["consular", "ministry"]),
  preset("Diplomacy", "Establish an export promotion agency", ["export", "trade", "agency"]),
  preset("Diplomacy", "Subsidize international trade missions", ["commercial", "trade"]),
  preset("Diplomacy", "Modernize border customs screening", ["border", "customs", "entry"]),
  preset("Diplomacy", "Authorize an overseas humanitarian relief fund", ["aid", "relief"]),
  preset("Diplomacy", "Promote green technology exports", ["export", "clean", "technology"]),
  preset("Diplomacy", "Expand national trade exhibition centers", ["trade", "exhibition"]),
  preset("Diplomacy", "Streamline international student visas", ["student", "visa"]),

  preset("Governance", "Pass a government transparency and ethics reform", ["ethics", "reform"]),
  preset("Governance", "Digitize civil service portals", ["digital", "e-government", "portal"]),
  preset("Governance", "Devolve administrative powers to the regions", ["devolve", "regional"]),
  preset("Governance", "Enforce campaign finance disclosure", ["election", "campaign", "donor"]),
  preset("Governance", "Audit civil service efficiency", ["audit", "efficiency", "civil"]),
  preset("Governance", "Establish an independent ethics commission", ["ethics", "oversight"]),
  preset("Governance", "Modernize civil registration records", ["id", "identity", "record"]),
  preset("Governance", "Speed up parliamentary committee work", ["parliament", "committee"]),
];

/** Presets matching a domain filter ("All" or a domain) and a free-text query. */
export function filterPresets(domain: DirectiveDomain | "All", query: string): DirectivePreset[] {
  const q = query.trim().toLowerCase();
  return DIRECTIVE_PRESETS.filter((p) => {
    if (domain !== "All" && p.domain !== domain) return false;
    if (!q) return true;
    return p.label.toLowerCase().includes(q) || p.keywords.some((k) => k.includes(q));
  });
}
