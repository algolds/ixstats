// src/lib/cards/ns-facts.ts
/**
 * NationStates card facts (cards refresh §2.1). An NS card keeps facts only, in `Card.metadata.nsData`: the nation
 * (NS card id and name), the NS season, region, category, flag and the NS bank value (`market_value`). Government,
 * badges, trophies and the card stats are gone. Client-safe and pure.
 */
import type { Prisma } from "@prisma/client";

export const NS_FACT_KEYS = [
  "id",
  "name",
  "flag",
  "region",
  "category",
  "season",
  "market_value",
] as const;
export type NsFactKey = (typeof NS_FACT_KEYS)[number];
export type NsFacts = Partial<Record<NsFactKey, string>>;

type JsonInput = Prisma.JsonValue | null | undefined;

/** A JSON value that is an object (not an array or null): the one guard for reading card metadata and filters. */
export const isJsonObject = (value: JsonInput): value is Prisma.JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function factValue(value: Prisma.JsonValue | undefined): string | undefined {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** The fact keys of each source merged, the first source holding a key winning; anything else is dropped. */
export function pickNsFacts(...sources: JsonInput[]): NsFacts {
  const objects = sources.filter(isJsonObject);
  const facts: NsFacts = {};
  for (const key of NS_FACT_KEYS) {
    const value = objects.map((source) => factValue(source[key])).find((v) => v !== undefined);
    if (value !== undefined) facts[key] = value;
  }
  return facts;
}

/** The facts stored on a card; empty for a card without them. */
export function nsFactsOf(metadata: JsonInput): NsFacts {
  return isJsonObject(metadata) ? pickNsFacts(metadata.nsData) : {};
}

/** An NS API card's facts (`NSCard` from src/lib/nationstates/api-client.ts), for a new or refreshed card. */
export function nsFactsFromApi(card: Partial<Record<NsFactKey, string | null>>): NsFacts {
  const facts: NsFacts = {};
  for (const key of NS_FACT_KEYS) {
    const value = card[key]?.trim();
    if (value) facts[key] = value;
  }
  return facts;
}

/**
 * A bank value as NationStates writes it: a plain decimal, at most 15 digits either side of the point, so it always
 * fits a float. The card-values cron's SQL reads it with the same pattern (src/lib/cards/ns-bank-sql.ts).
 */
export const NS_BANK_VALUE_PATTERN = "^[0-9]{1,15}([.][0-9]{1,15})?$";
const PLAIN_DECIMAL = new RegExp(NS_BANK_VALUE_PATTERN);

/**
 * The NS bank value NationStates reports for the card, or null when unknown: the stored string as it is, read only
 * when it is a plain decimal, exactly as the SQL reads it, so a value written here is not moved by the cron.
 */
export function nsBankValue(metadata: JsonInput): number | null {
  const nsData = isJsonObject(metadata) ? metadata.nsData : undefined;
  const value = isJsonObject(nsData) ? nsData.market_value : undefined;
  return typeof value === "string" && PLAIN_DECIMAL.test(value) ? Number(value) : null;
}

/** An importing nation as the import ledger and the once-per-nation bonus key it. */
export function nsNationKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

/** `metadata` with its NS facts replaced by `facts`; the other keys are kept. */
export function withNsFacts(metadata: JsonInput, facts: NsFacts): Prisma.JsonObject {
  return { ...(isJsonObject(metadata) ? metadata : {}), nsData: facts };
}
