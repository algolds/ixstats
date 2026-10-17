/**
 * The Overview feed's details as an admin reads them. The audit rows name rarities, card types, source wikis and
 * Economy fields by their keys ("Rarity COMMON → RARE", "Daily import: althistory on"); this shows the admin's labels.
 * The server has already named the players and cards.
 */
import { CARD_WIKI_SOURCES, cardSourceLabel } from "~/lib/cards/card-sources";
import {
  BONUS_FIELDS,
  BONUS_SWITCH_FIELD,
  CARD_VALUE_FIELDS,
  MARKET_FIELDS,
} from "~/lib/cards/economy-fields";
import { CARD_TYPE_LABELS, RARITY_LABELS, labelOf } from "../shared/card-labels";

const RARITY_KEY = new RegExp(`\\b(${Object.keys(RARITY_LABELS).join("|")})\\b`, "g");
/** A Library filter's card type ("type SPECIAL"); a bare key such as NS could be an admin's own words. */
const TYPE_KEY = new RegExp(`\\btype (${Object.keys(CARD_TYPE_LABELS).join("|")})\\b`, "g");
/** Where a row names a source wiki: a rarity table, a daily import, a Library filter. */
const SOURCE_KEY = /(^Rarity table: |^Daily import: |\bsource )([a-z]+)\b/g;
/** An Economy save's fields, "Card values: floorRare 120, nsPremium 1.5". */
const FIELD_SAVE = /^(Card values|Market|Bonuses): (.+)$/;

const SOURCE_LABELS: ReadonlyMap<string, string> = new Map(
  CARD_WIKI_SOURCES.map((source): [string, string] => [source, cardSourceLabel(source)])
);
const FIELD_LABELS: ReadonlyMap<string, string> = new Map(
  [...CARD_VALUE_FIELDS, ...MARKET_FIELDS, BONUS_SWITCH_FIELD, ...BONUS_FIELDS].map(
    (field): [string, string] => [field.key, field.label]
  )
);

/** "floorRare 120, nsPremium 1.5" → "Rare floor 120, NationStates bank value multiplier 1.5". */
function fieldLabels(fields: string): string {
  return fields
    .split(", ")
    .map((field) => {
      const [key = "", ...value] = field.split(" ");
      return [FIELD_LABELS.get(key) ?? key, ...value].join(" ");
    })
    .join(", ");
}

export function feedDetail(detail: string): string {
  const fields = FIELD_SAVE.exec(detail);
  if (fields) return `${fields[1]}: ${fieldLabels(fields[2] ?? "")}`;
  return detail
    .replace(SOURCE_KEY, (match, lead: string, key: string) =>
      SOURCE_LABELS.has(key) ? `${lead}${SOURCE_LABELS.get(key)}` : match
    )
    .replace(TYPE_KEY, (_match, key: string) => `type ${labelOf(CARD_TYPE_LABELS, key)}`)
    .replace(RARITY_KEY, (key) => labelOf(RARITY_LABELS, key));
}
