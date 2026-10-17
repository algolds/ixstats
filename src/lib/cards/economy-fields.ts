/**
 * The cards admin Economy tab's number fields, each with its label and bounds. Client-safe, so the editor checks a
 * value against the bounds the server enforces and shows the same sentence the server would refuse it with.
 */
import type { CardGeneralSettings } from "~/lib/cards/general-settings";
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
  step?: number;
  hint?: string;
}

const figure = (value: number) => value.toLocaleString("en-US");

/** Why `value` does not fit `field`, as a sentence naming the field; null when it fits. */
export function numberFieldProblem(field: EconomyNumberField, value: number): string | null {
  const fits =
    Number.isFinite(value) &&
    (!field.whole || Number.isInteger(value)) &&
    value >= field.min &&
    (field.max === undefined || value <= field.max);
  if (fits) return null;
  const kind = field.whole ? "a whole number" : "a number";
  const range =
    field.max === undefined
      ? `of ${figure(field.min)} or more`
      : `from ${figure(field.min)} to ${figure(field.max)}`;
  return `${field.label}: enter ${kind} ${range}.`;
}

// Ceilings against a slipped digit: a floor or bonus that is paid or minted at once.
const floor = { min: 0, max: 1_000_000 } as const;
const multiplier = { min: 0, max: 100, step: 0.1 } as const;

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
    step: 0.5,
    hint: "On sales over 100 IxC",
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
