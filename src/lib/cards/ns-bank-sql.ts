import { Prisma } from "@prisma/client";

/** The JSON path of an NS card's bank value: the SQL twin of Phase 1's `nsBankValue` (src/lib/cards/ns-facts.ts). */
const NS_BANK_PATH = `metadata->'nsData'->>'market_value'`;

/**
 * `<alias>`'s NS bank value as float8, or NULL when it is missing or not a plain number. The guard keeps one bad value
 * from failing a statement over every card.
 */
export function nsBankValueSql(alias: string): Prisma.Sql {
  const path = `${alias}.${NS_BANK_PATH}`;
  return Prisma.raw(`(CASE WHEN (${path}) ~ '^[0-9]+([.][0-9]+)?$' THEN (${path})::float8 END)`);
}
