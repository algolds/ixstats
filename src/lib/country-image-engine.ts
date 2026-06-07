/**
 * Country Image Keyword Engine
 *
 * Generates context-aware Unsplash search keywords based on country characteristics.
 * Uses a layered strategy combining geographic, economic, governance, urbanization,
 * coastal, sector, and context-specific keywords.
 *
 * All keyword selection is deterministic (hash-based) so the same country always
 * generates the same queries — enabling consistent caching.
 */

// ── Types ────────────────────────────────────────────────────────────────

export type ImageContext =
  | "hero"
  | "executive"
  | "diplomacy"
  | "intelligence"
  | "defense"
  // Card-level contexts (mapped from CardImageType)
  | "national_identity"
  | "head_of_state"
  | "head_of_government"
  | "economic_indicators"
  | "demographics"
  | "labor"
  | "government"
  | "fiscal"
  | "trade"
  | "productivity"
  | "analytics"
  | "defense_card"
  | "diplomacy_card"
  // Executive tab contexts
  | "exec_issues"
  | "exec_meetings"
  | "exec_policies"
  | "exec_plans"
  | "exec_decisions"
  | "exec_politics"
  // Diplomacy tab contexts
  | "diplo_network"
  | "diplo_missions"
  | "diplo_comms"
  | "diplo_events"
  | "diplo_foreign_policy"
  | "diplo_alliances"
  // Intelligence tab contexts
  | "intel_economic"
  | "intel_diplomatic"
  | "intel_policy"
  | "intel_forecasting"
  // Defense tab contexts
  | "defense_forces"
  | "defense_stability"
  | "defense_operations"
  | "defense_threats"
  // Overview sub-tab contexts
  | "overview_economy"
  | "overview_labor"
  | "overview_government"
  | "overview_demographics"
  | "overview_analytics"
  // Sector-specific contexts
  | "sector_agriculture"
  | "sector_industry"
  | "sector_services"
  | "sector_technology"
  // Economic structure contexts
  | "economy_primary"
  | "economy_secondary"
  | "economy_tertiary"
  | "economy_quaternary"
  // Employment by sector contexts
  | "labor_primary"
  | "labor_secondary"
  | "labor_tertiary";

export interface CountryImageData {
  continent?: string | null;
  region?: string | null;
  governmentType?: string | null;
  economicTier?: string | null;
  populationTier?: string | null;
  religion?: string | null;
  coastlineKm?: number | null;
  urbanPopulationPercent?: number | null;
  landArea?: number | null;
  sectorBreakdown?: string | null;
  innovationIndex?: number | null;
  capitalCity?: string | null;
}

export interface ImageKeywordResult {
  query: string;
  fallbackQuery: string;
  orientation: "landscape" | "squarish";
}

// ── Deterministic Hash ───────────────────────────────────────────────────

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

function pickDeterministic<T>(arr: T[], seed: string): T {
  return arr[simpleHash(seed) % arr.length]!;
}

// ── Keyword Layers ───────────────────────────────────────────────────────

const GEOGRAPHIC_KEYWORDS: Record<string, string[]> = {
  Africa: [
    "african landscape",
    "savanna architecture",
    "modern african city",
    "african marketplace",
  ],
  Asia: ["asian temple", "modern asian city", "traditional asian architecture", "bamboo forest"],
  Europe: [
    "european architecture",
    "medieval cathedral",
    "alpine landscape",
    "mediterranean coast",
  ],
  "North America": ["american skyline", "colonial architecture", "mountain landscape", "prairie"],
  "South America": [
    "latin american city",
    "colonial plaza",
    "andean mountains",
    "tropical rainforest",
  ],
  Oceania: ["pacific island", "coral coast", "modern pacific city", "volcanic landscape"],
  Antarctica: ["arctic landscape", "frozen tundra", "glacial formation", "polar station"],
};

const ECONOMIC_KEYWORDS: Record<string, string[]> = {
  Extravagant: ["luxury skyscraper", "gleaming downtown", "opulent architecture", "glass tower"],
  "Very Strong": [
    "modern skyline",
    "developed infrastructure",
    "urban development",
    "financial center",
  ],
  Strong: ["growing cityscape", "commercial district", "modern buildings", "city development"],
  Healthy: ["city development", "urban growth", "mixed use district", "infrastructure"],
  Developed: ["developing city", "construction progress", "growing town", "commercial area"],
  Developing: ["emerging market", "town center", "local development", "market street"],
  Impoverished: ["rural village", "developing community", "marketplace", "local trade"],
};

const GOVERNANCE_KEYWORDS: Record<string, string[]> = {
  parliamentary: ["parliament chamber", "legislative hall", "democratic assembly"],
  presidential: ["presidential palace", "executive mansion", "government center"],
  monarchy: ["royal palace", "throne hall", "ceremonial guards", "royal architecture"],
  constitutional: ["constitutional court", "supreme court", "judicial hall"],
  communist: ["government plaza", "administrative complex", "state assembly"],
  socialist: ["public assembly", "civic center", "community hall"],
  theocracy: ["religious council", "sacred architecture", "temple government"],
  republic: ["republic hall", "civic building", "government district"],
  federation: ["federal building", "union hall", "federation council"],
};

const CONTEXT_KEYWORDS: Record<ImageContext, string[]> = {
  hero: ["panoramic landscape", "national landmark", "aerial cityscape", "dramatic scenery"],
  executive: ["cabinet room", "executive chamber", "decision room", "government office"],
  diplomacy: ["embassy hall", "diplomatic conference", "international meeting", "formal reception"],
  intelligence: ["control room", "data center", "surveillance", "strategic command"],
  defense: ["military formation", "defense installation", "naval fleet", "air force"],
  national_identity: ["parliament building", "national monument", "cultural landmark"],
  head_of_state: ["presidential office", "throne room", "executive suite"],
  head_of_government: ["prime minister office", "cabinet meeting", "government council"],
  economic_indicators: ["stock exchange", "financial district", "trading floor"],
  demographics: ["city population", "urban crowd", "diverse community"],
  labor: ["modern workplace", "factory floor", "construction workers"],
  government: ["legislative chamber", "civic building", "courthouse"],
  fiscal: ["central bank", "treasury building", "financial documents"],
  trade: ["shipping port", "cargo containers", "international harbor"],
  productivity: ["research laboratory", "technology factory", "innovation center"],
  analytics: ["data visualization", "analytics dashboard", "satellite view"],
  defense_card: ["military base", "armed forces", "defense technology"],
  diplomacy_card: ["embassy building", "diplomatic reception", "flag ceremony"],
  // Executive tab contexts
  exec_issues: ["national agenda", "public forum", "civic engagement", "policy debate"],
  exec_meetings: ["conference room", "cabinet meeting", "boardroom", "round table"],
  exec_policies: ["policy documents", "legislative signing", "official decree"],
  exec_plans: ["strategic blueprint", "planning board", "development plan"],
  exec_decisions: ["executive decision", "judicial gavel", "command authority"],
  exec_politics: ["political rally", "campaign podium", "parliamentary debate"],
  // Diplomacy tab contexts
  diplo_network: ["embassy building", "diplomatic compound", "consulate"],
  diplo_missions: ["humanitarian mission", "peace delegation", "diplomatic envoy"],
  diplo_comms: ["communication satellite", "press briefing", "diplomatic dispatch"],
  diplo_events: ["diplomatic ceremony", "treaty signing", "international summit"],
  diplo_foreign_policy: ["foreign ministry", "international treaty", "world diplomacy"],
  diplo_alliances: ["allied flags", "alliance ceremony", "joint military exercise"],
  // Intelligence tab contexts
  intel_economic: ["financial analysis", "economic data center", "market intelligence"],
  intel_diplomatic: ["intelligence briefing", "geopolitical map", "global monitoring"],
  intel_policy: ["policy simulation", "think tank meeting", "governance research"],
  intel_forecasting: ["predictive analytics", "future projection", "trend analysis"],
  // Defense tab contexts
  defense_forces: ["military parade", "armed forces training", "military barracks"],
  defense_stability: ["civil defense", "stability operations", "peacekeeping"],
  defense_operations: ["military operations", "tactical planning", "deployment"],
  defense_threats: ["threat assessment", "surveillance monitor", "security patrol"],
  // Overview sub-tab contexts
  overview_economy: ["economic skyline", "financial center", "commercial district"],
  overview_labor: ["workforce modern office", "industrial workers", "career center"],
  overview_government: ["government dome", "civic architecture", "capitol plaza"],
  overview_demographics: ["diverse city crowd", "population census", "urban community"],
  overview_analytics: ["data dashboard", "statistical charts", "analytics workspace"],
  // Sector-specific contexts
  sector_agriculture: ["farming field aerial", "agriculture harvest", "rural farmland"],
  sector_industry: ["factory manufacturing", "industrial complex", "steel production"],
  sector_services: ["modern office tower", "service industry", "business center"],
  sector_technology: ["tech campus", "silicon valley", "digital innovation"],
  // Economic structure contexts
  economy_primary: ["agriculture drone farming", "coal mining quarry", "raw materials extraction"],
  economy_secondary: ["robotic manufacturing assembly", "heavy industry plant", "steel factory forge"],
  economy_tertiary: ["skyscraper commercial finance", "modern retail shopping mall", "banking glass atrium"],
  economy_quaternary: ["data center clean room", "bio research lab tech", "supercomputer grid server"],
  // Employment by sector contexts
  labor_primary: ["harvesting crops hands", "farmers working in fields", "fruit picking worker"],
  labor_secondary: ["welder sparks steel fabricator", "machinist at lathe workshop", "construction worker helmet"],
  labor_tertiary: ["barista pouring coffee customer", "doctor nurse consulting hospital", "office teamwork collaboration group"],
};

// ── Layer Functions ──────────────────────────────────────────────────────

function getGeographicKeyword(data: CountryImageData): string | null {
  const continent = data.continent;
  if (!continent) return null;
  const keywords = GEOGRAPHIC_KEYWORDS[continent];
  if (!keywords) return null;
  return pickDeterministic(keywords, `geo_${continent}_${data.region ?? ""}`);
}

function getEconomicKeyword(data: CountryImageData): string | null {
  const tier = data.economicTier;
  if (!tier) return null;
  const keywords = ECONOMIC_KEYWORDS[tier];
  if (!keywords) return null;
  return pickDeterministic(keywords, `econ_${tier}_${data.continent ?? ""}`);
}

function getGovernanceKeyword(data: CountryImageData): string | null {
  const gov = data.governmentType?.toLowerCase();
  if (!gov) return null;

  // Match partial keys
  for (const [key, keywords] of Object.entries(GOVERNANCE_KEYWORDS)) {
    if (gov.includes(key)) {
      return pickDeterministic(keywords, `gov_${gov}`);
    }
  }
  return null;
}

function getUrbanizationKeyword(data: CountryImageData): string | null {
  const urban = data.urbanPopulationPercent;
  if (urban == null) return null;

  const seed = `urban_${Math.round(urban / 10)}`;
  if (urban > 80)
    return pickDeterministic(["dense metropolis", "urban canyon", "city lights"], seed);
  if (urban > 50)
    return pickDeterministic(["suburban district", "mixed development", "town center"], seed);
  return pickDeterministic(["rural countryside", "pastoral landscape", "village life"], seed);
}

function getCoastalKeyword(data: CountryImageData): string | null {
  const coast = data.coastlineKm;
  if (coast == null) return null;

  if (coast > 1000)
    return pickDeterministic(["coastal harbor", "port city", "seaside skyline"], `coast_${coast}`);
  if (coast > 0)
    return pickDeterministic(["coastal town", "harbor view", "beach community"], `coast_${coast}`);
  return pickDeterministic(
    ["inland plateau", "continental interior", "mountain valley"],
    `coast_0`
  );
}

function getSectorKeyword(data: CountryImageData): string | null {
  const raw = data.sectorBreakdown;
  if (!raw) return null;

  try {
    const sectors = typeof raw === "string" ? JSON.parse(raw) : raw;
    const agri = sectors.agriculture ?? 0;
    const industry = sectors.industry ?? 0;
    const services = sectors.services ?? 0;

    const seed = `sector_${Math.round(agri)}_${Math.round(industry)}_${Math.round(services)}`;

    if (agri > 40)
      return pickDeterministic(
        ["agricultural fields", "farmland aerial", "harvest landscape"],
        seed
      );
    if (industry > 40)
      return pickDeterministic(
        ["industrial complex", "factory district", "manufacturing plant"],
        seed
      );
    if (services > 60)
      return pickDeterministic(["business district", "tech campus", "office towers"], seed);
  } catch {
    // ignore parse errors
  }
  return null;
}

function getContextKeyword(context: ImageContext, data: CountryImageData): string {
  const keywords = CONTEXT_KEYWORDS[context];
  if (!keywords) return "cityscape";
  return pickDeterministic(
    keywords,
    `ctx_${context}_${data.continent ?? ""}_${data.economicTier ?? ""}`
  );
}

// ── Query Builder ────────────────────────────────────────────────────────

function buildQuery(
  context: ImageContext,
  contextKw: string,
  geoKw: string | null,
  econKw: string | null,
  govKw: string | null,
  urbanKw: string | null,
  coastalKw: string | null,
  sectorKw: string | null
): string {
  // Section headers & hero: combine context + geographic/governance modifier
  if (context === "hero") {
    return [geoKw, econKw].filter(Boolean).join(" ") || contextKw;
  }

  if (["executive", "diplomacy", "intelligence", "defense"].includes(context)) {
    const modifier = govKw || geoKw || econKw;
    return modifier ? `${contextKw} ${modifier}` : contextKw;
  }

  // Tab-level and sector contexts: context + geographic/economic modifier
  if (
    context.startsWith("exec_") ||
    context.startsWith("diplo_") ||
    context.startsWith("intel_") ||
    context.startsWith("defense_") ||
    context.startsWith("overview_") ||
    context.startsWith("sector_")
  ) {
    const modifier = geoKw || econKw;
    return modifier ? `${contextKw} ${modifier}` : contextKw;
  }

  // Card-level contexts: context + specialty modifier
  const specialty = sectorKw || urbanKw || coastalKw || geoKw;
  return specialty ? `${contextKw} ${specialty}` : contextKw;
}

// ── Main Export ──────────────────────────────────────────────────────────

export function generateImageKeywords(
  countryData: CountryImageData,
  context: ImageContext
): ImageKeywordResult {
  const contextKw = getContextKeyword(context, countryData);
  const geoKw = getGeographicKeyword(countryData);
  const econKw = getEconomicKeyword(countryData);
  const govKw = getGovernanceKeyword(countryData);
  const urbanKw = getUrbanizationKeyword(countryData);
  const coastalKw = getCoastalKeyword(countryData);
  const sectorKw = getSectorKeyword(countryData);

  const query = buildQuery(context, contextKw, geoKw, econKw, govKw, urbanKw, coastalKw, sectorKw);

  // Trim to max 3 words for focused results (Unsplash works best with concise queries)
  const words = query.split(/\s+/).slice(0, 6).join(" ");

  return {
    query: words,
    fallbackQuery: contextKw,
    orientation: "landscape",
  };
}

// ── Extract helper ───────────────────────────────────────────────────────

/**
 * Extract the minimal CountryImageData from the full country object
 * returned by useCountryData()
 */
export function extractCountryImageData(country: any): CountryImageData | null {
  if (!country) return null;

  return {
    continent: country.continent ?? null,
    region: country.region ?? null,
    governmentType: country.governmentType ?? null,
    economicTier: country.economicTier ?? null,
    populationTier: country.populationTier ?? null,
    religion: country.religion ?? null,
    coastlineKm: country.coastlineKm ?? null,
    urbanPopulationPercent: country.urbanPopulationPercent ?? null,
    landArea: country.landArea ?? null,
    sectorBreakdown: country.economicProfile?.sectorBreakdown ?? null,
    innovationIndex: country.economicProfile?.innovationIndex ?? null,
    capitalCity: country.nationalIdentity?.capitalCity ?? null,
  };
}
