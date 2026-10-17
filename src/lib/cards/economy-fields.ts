/**
 * The cards admin Economy tab's number fields, each with its label and bounds. Client-safe, so the editor checks a
 * value against the bounds the server enforces and shows the same sentence the server would refuse it with.
 */
import type { CardGeneralSettings } from "~/lib/cards/general-settings";
import type { CardValuationConfig } from "~/lib/cards/valuation";
import type { LorewardPlace, LorewardType, VaultBonusConfig } from "~/lib/vault/vault-bonus";

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

const multiplier = { min: 0, step: 0.1 } as const;

export const CARD_VALUE_FIELDS: ReadonlyArray<EconomyNumberField<keyof CardValuationConfig>> = [
  { key: "floorCommon", label: "Common floor", min: 0 },
  { key: "floorUncommon", label: "Uncommon floor", min: 0 },
  { key: "floorRare", label: "Rare floor", min: 0 },
  { key: "floorUltraRare", label: "Ultra rare floor", min: 0 },
  { key: "floorEpic", label: "Epic floor", min: 0 },
  { key: "floorLegendary", label: "Legendary floor", min: 0 },
  {
    key: "nsPremium",
    label: "NationStates bank value multiplier",
    hint: "A NationStates card is worth at least its bank value times this",
    ...multiplier,
  },
  { key: "multSpecial", label: "Special card multiplier", ...multiplier },
  { key: "multNation", label: "Nation card multiplier", ...multiplier },
];

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
const credits = { min: 0, whole: true } as const;

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

export const LOREWARD_TYPES = [
  "daily",
  "weekly",
  "monthly",
] as const satisfies readonly LorewardType[];
export const LOREWARD_PLACES = ["winner", "runner-up"] as const satisfies readonly LorewardPlace[];

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

export const MAX_LOREWARD_PAYOUT = 100_000;

/** One cell of the Loreward payout grid ("Daily runner-up"), in IxC. */
export function lorewardPayoutField(type: LorewardType, place: LorewardPlace): EconomyNumberField {
  return {
    key: `${type}:${place}`,
    label: `${CONTEST_LABELS[type]} ${LOREWARD_PLACE_LABELS[place].toLowerCase()}`,
    ...credits,
    max: MAX_LOREWARD_PAYOUT,
  };
}

export const MAX_DAILY_IMPORT = 100;

/** A wiki's daily import count; `wiki` is its label ("IIWiki cards a day"). */
export function dailyImportCountField(wiki: string): EconomyNumberField {
  return { key: "count", label: `${wiki} cards a day`, min: 0, max: MAX_DAILY_IMPORT, whole: true };
}
