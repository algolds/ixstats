/**
 * The cards admin Economy tab's number fields, each with its label and bounds. Client-safe, so the editor checks a
 * value against the bounds the server enforces and shows the same sentence the server would refuse it with.
 */
import type { CardEconomyConfig } from "~/lib/cards/economy-config";
import type { CardGeneralSettings } from "~/lib/cards/general-settings";
import { MAX_LISTING_PRICE } from "~/lib/cards/market/fees";
import type { CardValuationConfig } from "~/lib/cards/valuation";
import type { LorewardPlace, LorewardType } from "~/lib/vault/loreward-places";
import type { VaultBonusConfig } from "~/lib/vault/vault-bonus";

export interface EconomyNumberField<K extends string = string> {
  key: K;
  label: string;
  min: number;
  max?: number;
  /** Whole numbers only: credits and card counts. */
  whole?: boolean;
  /**
   * At most this many decimal places: rates and multiples applied in basis points or ten-thousandths, which would
   * otherwise cut a finer number short, and odds the stored config keeps to the hundredth.
   */
  decimals?: number;
  step?: number;
  hint?: string;
}

const figure = (value: number) => value.toLocaleString("en-US");

/** Whether `value` is a decimal of at most `places` places, as typed (0.29 is, though 0.29 × 100 is 28.999...). */
const hasPlaces = (value: number, places: number) => Number(value.toFixed(places)) === value;

/** Why `value` does not fit `field`, as a sentence naming the field; null when it fits. */
export function numberFieldProblem(field: EconomyNumberField, value: number): string | null {
  const fits =
    Number.isFinite(value) &&
    (!field.whole || Number.isInteger(value)) &&
    (field.decimals === undefined || hasPlaces(value, field.decimals)) &&
    value >= field.min &&
    (field.max === undefined || value <= field.max);
  if (fits) return null;
  const kind = field.whole ? "a whole number" : "a number";
  const range =
    field.max === undefined
      ? `of ${figure(field.min)} or more`
      : `from ${figure(field.min)} to ${figure(field.max)}`;
  const places =
    field.decimals === undefined ? "" : ` with at most ${field.decimals} decimal places`;
  return `${field.label}: enter ${kind} ${range}${places}.`;
}

// Ceilings against a slipped digit: a floor or bonus that is paid or minted at once.
const floor = { min: 0, max: 1_000_000 } as const;
const multiplier = { min: 0, max: 100, step: 0.1 } as const;
/** A rate, share or odd to the hundredth, and its input's step. */
const hundredths = { decimals: 2, step: 0.01 } as const;

export const CARD_VALUE_FIELDS: ReadonlyArray<EconomyNumberField<keyof CardValuationConfig>> = [
  { key: "floorCommon", label: "Common floor", ...floor },
  { key: "floorUncommon", label: "Uncommon floor", ...floor },
  { key: "floorRare", label: "Rare floor", ...floor },
  { key: "floorUltraRare", label: "Ultra rare floor", ...floor },
  { key: "floorEpic", label: "Epic floor", ...floor },
  { key: "floorLegendary", label: "Legendary floor", ...floor },
  {
    key: "nsPremium",
    label: "NationStates bank value multiplier",
    hint: "A NationStates card is worth at least its bank value times this",
    ...multiplier,
  },
  { key: "multSpecial", label: "Special card multiplier", ...multiplier },
  { key: "multNation", label: "Nation card multiplier", ...multiplier },
  {
    key: "multTrophy",
    label: "Trophy multiplier",
    hint: "A display value: trophies stay out of the dividend",
    ...multiplier,
    step: 0.05,
  },
  { key: "finishFoil", label: "Foil value multiplier", min: 1, max: 100, step: 0.5 },
  { key: "finishHolo", label: "Holo value multiplier", min: 1, max: 100, step: 0.5 },
  {
    key: "levelBonusPerLevel",
    label: "Level bonus per level",
    min: 0,
    max: 0.2,
    step: 0.01,
    hint: "0.02 is +2% for each level above 1",
  },
  {
    key: "levelBonusCap",
    label: "Level bonus cap",
    min: 0,
    max: 1,
    step: 0.05,
    hint: "0.2 is +20% at most",
  },
  {
    key: "medianSales",
    label: "Market median sales",
    min: 1,
    max: 50,
    whole: true,
    hint: "The median of this many recent sales",
  },
  {
    key: "medianDays",
    label: "Market median window (days)",
    min: 1,
    max: 365,
    whole: true,
    hint: "Only sales this recent count",
  },
];

/** The rarity floors, lowest rarity first. */
const FLOOR_KEYS = [
  "floorCommon",
  "floorUncommon",
  "floorRare",
  "floorUltraRare",
  "floorEpic",
  "floorLegendary",
] as const satisfies ReadonlyArray<keyof CardValuationConfig>;

/** Why the floors do not rise with rarity, as a sentence; null when each is at least the one below it. */
export function floorsProblem(
  values: Readonly<Record<(typeof FLOOR_KEYS)[number], number>>
): string | null {
  const rising = FLOOR_KEYS.every((key, i) => i === 0 || values[key] >= values[FLOOR_KEYS[i - 1]]);
  return rising ? null : "Each rarity needs a floor at least as high as the one below it";
}

export const MARKET_FIELDS: ReadonlyArray<EconomyNumberField<keyof CardGeneralSettings>> = [
  {
    key: "auctionHouseRakePct",
    label: "Market fee (%)",
    min: 0,
    max: 50,
    ...hundredths,
    hint: "On sales and trade credits over the no-fee amount",
  },
  {
    key: "maxInventoryCards",
    label: "Base card capacity",
    min: 10,
    max: 100_000,
    whole: true,
    hint: "Cards a player can hold before capacity upgrades",
  },
];

type BonusAmount = Exclude<keyof VaultBonusConfig, "enabled">;
const credits = { min: 0, max: 100_000, whole: true } as const;

export const BONUS_FIELDS: ReadonlyArray<EconomyNumberField<BonusAmount>> = [
  { key: "newPlayer", label: "New player", ...credits },
  { key: "nsPerCard", label: "NationStates import, per card", ...credits },
  { key: "nsCap", label: "NationStates import, most per nation", ...credits },
  { key: "achievementCommon", label: "Common achievement", ...credits },
  { key: "achievementUncommon", label: "Uncommon achievement", ...credits },
  { key: "achievementRare", label: "Rare achievement", ...credits },
  { key: "achievementEpic", label: "Epic achievement", ...credits },
  { key: "achievementLegendary", label: "Legendary achievement", ...credits },
];

/** The bonuses' master switch, stored as 1 (paying) or 0. */
export const BONUS_SWITCH_FIELD: EconomyNumberField<"enabled"> = {
  key: "enabled",
  label: "Pay bonuses",
  min: 0,
  max: 1,
  whole: true,
};

const CONTEST_LABELS: Record<LorewardType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};
export const LOREWARD_PLACE_LABELS: Record<LorewardPlace, string> = {
  winner: "Winner",
  "runner-up": "Runner-up",
};

export const lorewardContestLabel = (type: LorewardType): string => CONTEST_LABELS[type];

/** One cell of the Loreward payout grid ("Daily runner-up"), in IxC. */
export function lorewardPayoutField(type: LorewardType, place: LorewardPlace): EconomyNumberField {
  return {
    key: `${type}:${place}`,
    label: `${CONTEST_LABELS[type]} ${LOREWARD_PLACE_LABELS[place].toLowerCase()}`,
    ...credits,
  };
}

export const MAX_DAILY_IMPORT = 100;

/** A wiki's daily import count; `wiki` is its label ("IIWiki cards a day"). */
export function dailyImportCountField(wiki: string): EconomyNumberField {
  return { key: "count", label: `${wiki} cards a day`, min: 0, max: MAX_DAILY_IMPORT, whole: true };
}

/**
 * Why a wiki's daily import cannot be saved, as a sentence; null when it can. Switched on, it needs at least one card
 * a day, since the nightly run skips a wiki with none.
 */
export function dailyImportProblem(
  wiki: string,
  setting: { enabled: boolean; count: number }
): string | null {
  const countProblem = numberFieldProblem(dailyImportCountField(wiki), setting.count);
  if (countProblem) return countProblem;
  return setting.enabled && setting.count === 0
    ? "Set how many cards a day, or switch the daily import off."
    : null;
}

type EconomyKey = keyof CardEconomyConfig;
type EconomyValues = Readonly<Record<EconomyKey, number>>;

// The card economy's numbers, bounded as `clampEconomyConfig` bounds them, so a saved number reads back unchanged.
const percent = { min: 0, max: 100, ...hundredths } as const;
const dust = { min: 0, max: 1_000_000, whole: true } as const;
const xp = { min: 0, max: 100_000, whole: true } as const;

const FINISH_FIELDS: ReadonlyArray<EconomyNumberField<EconomyKey>> = [
  { key: "finishFoilPct", label: "Foil chance (%)", ...percent },
  { key: "finishHoloPct", label: "Holo chance (%)", ...percent },
];

const DAILY_ODDS_FIELDS: ReadonlyArray<EconomyNumberField<EconomyKey>> = [
  { key: "dailyCommonPct", label: "Common (%)", ...percent },
  { key: "dailyUncommonPct", label: "Uncommon (%)", ...percent },
  { key: "dailyRarePct", label: "Rare (%)", ...percent },
  { key: "dailyUltraRarePct", label: "Ultra rare (%)", ...percent },
  { key: "dailyEpicPct", label: "Epic (%)", ...percent },
  { key: "dailyLegendaryPct", label: "Legendary (%)", ...percent },
];

const DUST_FIELDS: ReadonlyArray<EconomyNumberField<EconomyKey>> = [
  { key: "dustCommon", label: "Common dust", ...dust },
  { key: "dustUncommon", label: "Uncommon dust", ...dust },
  { key: "dustRare", label: "Rare dust", ...dust },
  { key: "dustUltraRare", label: "Ultra rare dust", ...dust },
  { key: "dustEpic", label: "Epic dust", ...dust },
  { key: "dustLegendary", label: "Legendary dust", ...dust },
  { key: "dustFoilMult", label: "Foil dust multiple", min: 1, max: 10, whole: true },
  { key: "dustHoloMult", label: "Holo dust multiple", min: 1, max: 100, whole: true },
  {
    key: "dustImportMult",
    label: "Imported NationStates share",
    min: 0,
    max: 1,
    ...hundredths,
    hint: "0.25 is a quarter of the Standard dust",
  },
];

const CRAFT_FIELDS: ReadonlyArray<EconomyNumberField<EconomyKey>> = [
  { key: "craftDustMult", label: "Craft dust multiple", min: 1, max: 100, ...hundredths },
  { key: "fusionCopies", label: "Copies per fusion", min: 2, max: 10, whole: true },
];

const LISTING_FIELDS: ReadonlyArray<EconomyNumberField<EconomyKey>> = [
  {
    key: "listingFee",
    label: "Listing fee (IxC)",
    min: 0,
    max: 100_000,
    whole: true,
    hint: "For an auction or a fixed-price listing",
  },
  {
    key: "listingFeeFeatured",
    label: "Featured listing fee (IxC)",
    min: 0,
    max: 100_000,
    whole: true,
  },
  { key: "listingRefundPct", label: "Refund on cancel or expiry (%)", ...percent },
  {
    key: "listingDays",
    label: "Listing length (days)",
    min: 1,
    max: 60,
    whole: true,
    hint: "For a fixed-price listing",
  },
  {
    key: "saleFeeThreshold",
    label: "No market fee at or under (IxC)",
    min: 0,
    max: MAX_LISTING_PRICE,
    whole: true,
  },
  {
    key: "royaltyPct",
    label: "Nation royalty (%)",
    min: 0,
    max: 50,
    ...hundredths,
    hint: "Of the amount, paid out of the market fee",
  },
];

const XP_FIELDS: ReadonlyArray<EconomyNumberField<EconomyKey>> = [
  { key: "xpPack", label: "Pack XP", ...xp },
  { key: "xpDaily", label: "Daily card XP", ...xp },
  { key: "xpTradePerCard", label: "Trade XP", ...xp, hint: "For each card traded" },
  {
    key: "xpAuctionWin",
    label: "Market purchase XP",
    ...xp,
    hint: "An auction win, a buyout or a fixed-price purchase",
  },
  { key: "xpHoldingTick", label: "Holding XP per day", ...xp },
  { key: "xpDailyCapPerCopy", label: "Daily XP cap per copy", ...xp },
];

/** A sum of percentages in hundredths, so 66.67 + 33.33 is exactly 100. */
const inHundredths = (values: readonly number[]) =>
  Math.round(values.reduce((sum, value) => sum + value, 0) * 100);
const asPercent = (hundredthsOf: number) => `${figure(hundredthsOf / 100)}%`;

function finishOddsProblem(values: EconomyValues): string | null {
  const total = inHundredths([values.finishFoilPct, values.finishHoloPct]);
  return total <= 10_000
    ? null
    : `Foil and Holo chances add up to ${asPercent(total)}. Keep them at 100% or less.`;
}

function dailyOddsProblem(values: EconomyValues): string | null {
  const total = inHundredths(DAILY_ODDS_FIELDS.map((field) => values[field.key]));
  return total === 10_000 ? null : `The daily odds add up to ${asPercent(total)}. Make them 100%.`;
}

/**
 * Why fusing and breaking down could make dust: a fused copy must never break down for more than the copies it took,
 * so Foil is at most `fusionCopies` × Standard and Holo from Foil to `fusionCopies` × Foil.
 */
function dustLoopProblem(values: EconomyValues): string | null {
  const { fusionCopies: copies, dustFoilMult: foil, dustHoloMult: holo } = values;
  if (foil > copies) {
    return `The Foil dust multiple can be at most the copies per fusion, ${copies}, or fusing would make dust.`;
  }
  if (holo < foil || holo > copies * foil) {
    return `The Holo dust multiple needs to be from ${foil} to ${copies * foil}: at least the Foil multiple, and at most the copies per fusion times it.`;
  }
  return null;
}

export interface EconomySection {
  id: "finishes" | "daily" | "dust" | "crafting" | "listings" | "xp";
  title: string;
  description: string;
  saveLabel: string;
  fields: ReadonlyArray<EconomyNumberField<EconomyKey>>;
  /** A rule across numbers, read with the stored ones the section does not hold. */
  check?: (values: EconomyValues) => string | null;
}

/** The Economy tab's card economy numbers, one card each, saved on its own. */
export const ECONOMY_SECTIONS: readonly EconomySection[] = [
  {
    id: "finishes",
    title: "Finish roll at mint",
    description: "For each copy from a pack or the daily card. The rest are Standard.",
    saveLabel: "Save finishes",
    fields: FINISH_FIELDS,
    check: finishOddsProblem,
  },
  {
    id: "daily",
    title: "Daily card odds",
    description:
      "Percent per rarity, adding up to 100 like a pack's odds. A rarity with no cards gives its share to the others.",
    saveLabel: "Save daily odds",
    fields: DAILY_ODDS_FIELDS,
    check: dailyOddsProblem,
  },
  {
    id: "dust",
    title: "Dust",
    description:
      "Dust for breaking down a Standard copy. Foil and Holo copies give whole multiples of it, and imported NationStates copies a share.",
    saveLabel: "Save dust",
    fields: DUST_FIELDS,
    check: dustLoopProblem,
  },
  {
    id: "crafting",
    title: "Crafting and fusion",
    description:
      "A craft costs this many times the card's Standard dust, plus its rarity floor in IxC. A fusion takes this many copies of one card at one finish.",
    saveLabel: "Save crafting",
    fields: CRAFT_FIELDS,
    check: dustLoopProblem,
  },
  {
    id: "listings",
    title: "Listings and royalty",
    description:
      "The market fee rate is under Market and capacity. The nation royalty comes out of that fee.",
    saveLabel: "Save listings",
    fields: LISTING_FIELDS,
  },
  {
    id: "xp",
    title: "Card XP",
    description:
      "XP a copy gains. A copy gains at most its daily cap in a UTC day, from every source together, and levels stop at 10.",
    saveLabel: "Save XP",
    fields: XP_FIELDS,
  },
];

export const ECONOMY_FIELDS: ReadonlyArray<EconomyNumberField<EconomyKey>> =
  ECONOMY_SECTIONS.flatMap((section) => section.fields);

/** The first section rule `values` break, as a sentence; null when they hold. The server checks every save with it. */
export function economyProblem(values: EconomyValues): string | null {
  for (const section of ECONOMY_SECTIONS) {
    const problem = section.check?.(values) ?? null;
    if (problem) return problem;
  }
  return null;
}
