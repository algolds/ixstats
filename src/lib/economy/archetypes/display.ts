/**
 * Economic Archetype Display Copy
 *
 * Player-facing copy for the 20 built-in archetypes, keyed by archetype id (the `id` in
 * ./modern.json and ./historical.json, stored as `key` on EconomicArchetype rows). The plain
 * name leads; the archetype's original name becomes the inspiration line, for example
 * "Wealthy welfare state · inspired by the Nordic model".
 *
 * Bands describe the archetype's typical nation. The archetype data carries no population or
 * GDP figures, so each band comes from the region the archetype is modelled on (its `region`
 * field), noted per entry:
 * - Population: small (under 5 million), medium (5 to 50 million), large (50 to 200 million),
 *   very-large (over 200 million).
 * - Wealth (GDP per head, present-day US dollars): developing (under 4,000), emerging (4,000 to
 *   15,000), wealthy (15,000 to 55,000), very-wealthy (over 55,000). Historical archetypes use
 *   their standing within their own era: the richest economies of the age are wealthy, mixed
 *   trading and early industrial economies are emerging, and mainly agrarian empires (40% or
 *   more of output from farming in `sectorFocus`) are developing.
 *
 * `startingGovernmentForm` is a government form id from the builder's forms catalogue
 * (spec §4); the closest fit to the benchmark's real system of government.
 *
 * Copy rules: sentence case, plain words, no em dashes, no exclamation marks.
 *
 * @module archetype-display
 */

export type PopulationBand = "small" | "medium" | "large" | "very-large";
export type WealthBand = "developing" | "emerging" | "wealthy" | "very-wealthy";

export const POPULATION_BANDS: readonly PopulationBand[] = [
  "small",
  "medium",
  "large",
  "very-large",
];
export const WEALTH_BANDS: readonly WealthBand[] = [
  "developing",
  "emerging",
  "wealthy",
  "very-wealthy",
];

/** Government form ids from the builder's forms catalogue (spec §4). */
export const GOVERNMENT_FORM_IDS = [
  "parliamentary-republic",
  "presidential-republic",
  "federal-republic",
  "constitutional-monarchy",
  "absolute-monarchy",
  "one-party-state",
  "military-government",
  "theocracy",
  "technocracy",
  "merchant-oligarchy",
  "confederation",
] as const;
export type GovernmentFormId = (typeof GOVERNMENT_FORM_IDS)[number];

export interface ArchetypeDisplay {
  /** Plain-language name, for example "Wealthy welfare state". */
  displayName: string;
  /** One sentence on what playing this archetype is like. */
  pitch: string;
  /** Where the archetype comes from, for example "Inspired by the Nordic model". */
  inspiration: string;
  typicalPopulationBand: PopulationBand;
  typicalWealthBand: WealthBand;
  startingGovernmentForm: GovernmentFormId;
}

export type BuiltinArchetypeId =
  | "silicon-valley"
  | "nordic"
  | "asian-tiger"
  | "german-social-market"
  | "singapore"
  | "swiss"
  | "japanese"
  | "australian"
  | "brazilian"
  | "canadian"
  | "british-empire"
  | "venetian-republic"
  | "hanseatic-league"
  | "dutch-golden-age"
  | "industrial-revolution"
  | "soviet-command"
  | "american-gilded-age"
  | "french-mercantilism"
  | "ottoman-empire"
  | "chinese-ming-dynasty";

export const ARCHETYPE_DISPLAY: Record<BuiltinArchetypeId, ArchetypeDisplay> = {
  // Modern
  "silicon-valley": {
    // California: about 39 million people, GDP per head above 90,000.
    displayName: "Tech startup hub",
    pitch:
      "New companies, investors and skilled workers drive fast growth, with less security for workers.",
    inspiration: "Inspired by Silicon Valley",
    typicalPopulationBand: "medium",
    typicalWealthBand: "very-wealthy",
    startingGovernmentForm: "federal-republic",
  },
  nordic: {
    // Denmark, Sweden, Norway, Finland: 5.5 to 10.5 million people, GDP per head 55,000 to 90,000.
    displayName: "Wealthy welfare state",
    pitch: "High taxes pay for free healthcare and education, and people trust their government.",
    inspiration: "Inspired by the Nordic model",
    typicalPopulationBand: "medium",
    typicalWealthBand: "very-wealthy",
    startingGovernmentForm: "constitutional-monarchy",
  },
  "asian-tiger": {
    // South Korea, Taiwan: 23 to 52 million people, GDP per head about 33,000.
    displayName: "Fast-growing export economy",
    pitch: "The state steers industry to build high-tech goods and sell them to the world.",
    inspiration: "Inspired by the Asian tiger economies",
    typicalPopulationBand: "medium",
    typicalWealthBand: "wealthy",
    startingGovernmentForm: "presidential-republic",
  },
  "german-social-market": {
    // Germany: about 84 million people, GDP per head about 52,000.
    displayName: "Skilled industrial economy",
    pitch:
      "Strong factories and apprenticeships, with unions and employers sharing the big decisions.",
    inspiration: "Inspired by Germany's social market economy",
    typicalPopulationBand: "large",
    typicalWealthBand: "wealthy",
    startingGovernmentForm: "federal-republic",
  },
  singapore: {
    // Singapore: about 6 million people, GDP per head above 80,000.
    displayName: "Trading city-state",
    pitch:
      "A small, efficient state that draws global business with low taxes and clean government.",
    inspiration: "Inspired by Singapore",
    typicalPopulationBand: "medium",
    typicalWealthBand: "very-wealthy",
    startingGovernmentForm: "technocracy",
  },
  swiss: {
    // Switzerland: about 9 million people, GDP per head about 100,000.
    displayName: "Stable high-value economy",
    pitch:
      "Precision industry, banking and strong local government keep the economy steady and rich.",
    inspiration: "Inspired by Switzerland",
    typicalPopulationBand: "medium",
    typicalWealthBand: "very-wealthy",
    startingGovernmentForm: "federal-republic",
  },
  japanese: {
    // Japan: about 124 million people, GDP per head about 34,000.
    displayName: "High-tech industrial nation",
    pitch:
      "Large companies and a skilled workforce build advanced products, with steady but slow growth.",
    inspiration: "Inspired by Japan",
    typicalPopulationBand: "large",
    typicalWealthBand: "wealthy",
    startingGovernmentForm: "constitutional-monarchy",
  },
  australian: {
    // Australia: about 27 million people, GDP per head about 65,000.
    displayName: "Resource-rich open economy",
    pitch: "Mining and farming exports pay for a comfortable way of life built on services.",
    inspiration: "Inspired by Australia",
    typicalPopulationBand: "medium",
    typicalWealthBand: "very-wealthy",
    startingGovernmentForm: "constitutional-monarchy",
  },
  brazilian: {
    // Brazil: about 216 million people, GDP per head about 10,000.
    displayName: "Large emerging economy",
    pitch:
      "Farming, mining and industry drive growth in a big country still closing its wealth gaps.",
    inspiration: "Inspired by Brazil",
    typicalPopulationBand: "very-large",
    typicalWealthBand: "emerging",
    startingGovernmentForm: "federal-republic",
  },
  canadian: {
    // Canada: about 40 million people, GDP per head about 53,000.
    displayName: "Resource-rich welfare state",
    pitch: "Natural resources and trade pay for public healthcare and strong social programmes.",
    inspiration: "Inspired by Canada",
    typicalPopulationBand: "medium",
    typicalWealthBand: "wealthy",
    startingGovernmentForm: "constitutional-monarchy",
  },

  // Historical
  "british-empire": {
    // Empire of several hundred million people; the richest major economy of its age.
    displayName: "Global trading empire",
    pitch: "Sea power, colonies and industry make your nation the centre of world trade.",
    inspiration: "Inspired by the British Empire",
    typicalPopulationBand: "very-large",
    typicalWealthBand: "wealthy",
    startingGovernmentForm: "constitutional-monarchy",
  },
  "venetian-republic": {
    // About 2 million people with its mainland lands; among the richest states of its age.
    displayName: "Merchant republic",
    pitch:
      "Trade, banking and skilled crafts make a small state rich, run by its leading families.",
    inspiration: "Inspired by the Republic of Venice",
    typicalPopulationBand: "small",
    typicalWealthBand: "wealthy",
    startingGovernmentForm: "merchant-oligarchy",
  },
  "hanseatic-league": {
    // A league of trading cities with well under 5 million people in all.
    displayName: "League of trading cities",
    pitch:
      "Independent trading cities work together to protect their merchants and shipping routes.",
    inspiration: "Inspired by the Hanseatic League",
    typicalPopulationBand: "small",
    typicalWealthBand: "emerging",
    startingGovernmentForm: "confederation",
  },
  "dutch-golden-age": {
    // About 2 million people; the highest income per head in the world at the time.
    displayName: "Banking and shipping republic",
    pitch: "Shipping, banking and new ideas turn a small nation into a commercial leader.",
    inspiration: "Inspired by the Dutch Golden Age",
    typicalPopulationBand: "small",
    typicalWealthBand: "wealthy",
    startingGovernmentForm: "merchant-oligarchy",
  },
  "industrial-revolution": {
    // Great Britain, about 10 to 20 million people; still 20% farming in a fast-changing economy.
    displayName: "Early industrial nation",
    pitch: "Factories, steam power and new inventions transform a farming society.",
    inspiration: "Inspired by the Industrial Revolution in Britain",
    typicalPopulationBand: "medium",
    typicalWealthBand: "emerging",
    startingGovernmentForm: "constitutional-monarchy",
  },
  "soviet-command": {
    // Soviet Union, about 200 to 290 million people; a middle-income industrial economy.
    displayName: "Planned industrial state",
    pitch: "The state owns industry and plans what gets made, with jobs for all but little choice.",
    inspiration: "Inspired by the Soviet Union",
    typicalPopulationBand: "very-large",
    typicalWealthBand: "emerging",
    startingGovernmentForm: "one-party-state",
  },
  "american-gilded-age": {
    // United States, about 50 to 76 million people; overtaking Britain in income per head.
    displayName: "Booming industrial frontier",
    pitch:
      "Railways, factories and big business drive rapid growth, with wide gaps between rich and poor.",
    inspiration: "Inspired by the American Gilded Age",
    typicalPopulationBand: "large",
    typicalWealthBand: "wealthy",
    startingGovernmentForm: "federal-republic",
  },
  "french-mercantilism": {
    // France under Colbert, about 20 million people; 35% of output still from farming.
    displayName: "Royal trading state",
    pitch: "The crown backs royal workshops and luxury goods to build national wealth.",
    inspiration: "Inspired by French mercantilism",
    typicalPopulationBand: "medium",
    typicalWealthBand: "emerging",
    startingGovernmentForm: "absolute-monarchy",
  },
  "ottoman-empire": {
    // About 25 to 35 million people; 45% of output from farming.
    displayName: "Crossroads empire",
    pitch:
      "A large, varied empire that lives on farming and grows rich from control of trade routes.",
    inspiration: "Inspired by the Ottoman Empire",
    typicalPopulationBand: "medium",
    typicalWealthBand: "developing",
    startingGovernmentForm: "absolute-monarchy",
  },
  "chinese-ming-dynasty": {
    // About 100 to 160 million people; 50% of output from farming.
    displayName: "Imperial farming state",
    pitch:
      "A vast farming society run by educated officials, with skilled crafts and limited foreign trade.",
    inspiration: "Inspired by Ming dynasty China",
    typicalPopulationBand: "large",
    typicalWealthBand: "developing",
    startingGovernmentForm: "absolute-monarchy",
  },
};

/** Display copy for an archetype id, or undefined for custom archetypes without written copy. */
export function getArchetypeDisplay(id: string): ArchetypeDisplay | undefined {
  return Object.prototype.hasOwnProperty.call(ARCHETYPE_DISPLAY, id)
    ? ARCHETYPE_DISPLAY[id as BuiltinArchetypeId]
    : undefined;
}
