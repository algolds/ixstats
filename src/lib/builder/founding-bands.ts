/**
 * Founding size and wealth bands (redesign spec §1 Step 4, D17).
 *
 * The builder asks "How big and how wealthy?" with four plain bands each. Every band maps to a
 * representative figure, which the server uses when the player does not enter an exact one.
 * Shared by the builder UI and `computeFoundingSnapshot`, so a band always means the same number.
 */

export const POPULATION_BAND_IDS = ["small", "medium", "large", "very-large"] as const;
export type PopulationBandId = (typeof POPULATION_BAND_IDS)[number];

export const WEALTH_BAND_IDS = ["developing", "emerging", "wealthy", "very-wealthy"] as const;
export type WealthBandId = (typeof WEALTH_BAND_IDS)[number];

/** Inclusive lower bound, exclusive upper bound; `max: null` is open-ended. */
export interface BandRange {
  min: number;
  max: number | null;
}

export interface FoundingBand<Id extends string> {
  id: Id;
  label: string;
  /** One plain line under the label. */
  hint: string;
  range: BandRange;
  /** The figure the band stands for: people for population, USD per person for wealth. */
  figure: number;
}

export const POPULATION_BANDS: ReadonlyArray<FoundingBand<PopulationBandId>> = [
  {
    id: "small",
    label: "Small",
    hint: "Under 5 million people, like a city state or island nation",
    range: { min: 0, max: 5_000_000 },
    figure: 2_500_000,
  },
  {
    id: "medium",
    label: "Medium",
    hint: "5 to 50 million people, the size of most nations",
    range: { min: 5_000_000, max: 50_000_000 },
    figure: 20_000_000,
  },
  {
    id: "large",
    label: "Large",
    hint: "50 to 200 million people, a regional power",
    range: { min: 50_000_000, max: 200_000_000 },
    figure: 100_000_000,
  },
  {
    id: "very-large",
    label: "Very large",
    hint: "Over 200 million people, one of the most populous nations",
    range: { min: 200_000_000, max: null },
    figure: 300_000_000,
  },
];

export const WEALTH_BANDS: ReadonlyArray<FoundingBand<WealthBandId>> = [
  {
    id: "developing",
    label: "Developing",
    hint: "Most people get around on foot, by bus or by motorbike",
    range: { min: 0, max: 8_000 },
    figure: 4_000,
  },
  {
    id: "emerging",
    label: "Emerging",
    hint: "A growing middle class is buying its first cars",
    range: { min: 8_000, max: 25_000 },
    figure: 15_000,
  },
  {
    id: "wealthy",
    label: "Wealthy",
    hint: "Most people own a car",
    range: { min: 25_000, max: 55_000 },
    figure: 40_000,
  },
  {
    id: "very-wealthy",
    label: "Very wealthy",
    hint: "Most families own their home and holiday abroad",
    range: { min: 55_000, max: null },
    figure: 70_000,
  },
];

function bandFor<Id extends string>(bands: ReadonlyArray<FoundingBand<Id>>, value: number): Id {
  const v = Number.isNaN(value) ? 0 : value;
  const match = bands.find((band) => band.range.max === null || v < band.range.max);
  return (match ?? bands[bands.length - 1]!).id;
}

/** The population band a head count falls in. */
export function bandForPopulation(population: number): PopulationBandId {
  return bandFor(POPULATION_BANDS, population);
}

/** The wealth band a GDP per capita (USD) falls in. */
export function bandForGdpPerCapita(gdpPerCapita: number): WealthBandId {
  return bandFor(WEALTH_BANDS, gdpPerCapita);
}

/** The representative population of a band. */
export function figureForPopulationBand(id: PopulationBandId): number {
  return POPULATION_BANDS.find((band) => band.id === id)!.figure;
}

/** The representative GDP per capita (USD) of a band. */
export function figureForWealthBand(id: WealthBandId): number {
  return WEALTH_BANDS.find((band) => band.id === id)!.figure;
}
