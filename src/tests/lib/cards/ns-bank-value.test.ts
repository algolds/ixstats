/** @jest-environment node */
/**
 * An NS card's bank value is read the same way in TypeScript (`nsBankValue`) and in the card-values cron's SQL
 * (`nsBankValueSql`): a JSON string holding a plain decimal, else nothing. Otherwise a value one side writes would be
 * moved by the other.
 */
import { Prisma } from "@prisma/client";
import { nsBankValueSql } from "~/lib/cards/ns-bank-sql";
import { nsBankValue } from "~/lib/cards/ns-facts";

/** Stored `market_value`s and the bank value both sides read from them. */
const TABLE: Array<[string, Prisma.JsonValue, number | null]> = [
  ["a plain whole number", "5381", 5381],
  ["a plain decimal", "0.05", 0.05],
  ["trailing zeros", "1.00", 1],
  ["a leading plus", "+5", null],
  ["no whole part", ".5", null],
  ["no fraction digits", "5.", null],
  ["an exponent", "1e3", null],
  ["trailing text", "12abc", null],
  ["words", "n/a", null],
  ["a negative number", "-5", null],
  ["spaces", " 5", null],
  ["an empty string", "", null],
  ["more digits than a float holds", "9".repeat(400), null],
  ["a JSON number, not a string", 5, null],
];

/** The SQL fragment over `c`, as one text. */
const fragment = nsBankValueSql("c").sql;

/** What the fragment reads from a stored value: its string test and pattern, applied as Postgres applies them. */
function sqlReads(stored: Prisma.JsonValue): number | null {
  const pattern = /~ '([^']+)'/.exec(fragment)?.[1];
  if (pattern === undefined) throw new Error("the fragment has no pattern");
  return typeof stored === "string" && new RegExp(pattern).test(stored) ? Number(stored) : null;
}

describe("the NS bank value", () => {
  it.each(TABLE)("reads %s the same way in TypeScript and SQL", (_name, stored, expected) => {
    expect(nsBankValue({ nsData: { market_value: stored } })).toBe(expected);
    expect(sqlReads(stored)).toBe(expected);
  });

  it("is read in SQL from metadata.nsData.market_value, only when it is a JSON string", () => {
    expect(fragment).toBe(
      `(CASE WHEN jsonb_typeof(c.metadata->'nsData'->'market_value') = 'string' ` +
        `AND (c.metadata->'nsData'->>'market_value') ~ '^[0-9]{1,15}([.][0-9]{1,15})?$' ` +
        `THEN (c.metadata->'nsData'->>'market_value')::float8 END)`
    );
  });

  it("is nothing without NS facts", () => {
    expect(nsBankValue(null)).toBeNull();
    expect(nsBankValue({ nsData: "5" })).toBeNull();
    expect(nsBankValue({ nsData: {} })).toBeNull();
  });
});
