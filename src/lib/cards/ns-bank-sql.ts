import { Prisma } from "@prisma/client";
import { NS_BANK_VALUE_PATTERN } from "./ns-facts";

/**
 * `<alias>`'s NS bank value as float8, or NULL when it is missing or not a plain decimal string: the SQL twin of
 * `nsBankValue` (src/lib/cards/ns-facts.ts), with the same pattern. The guard keeps one bad value from failing a
 * statement over every card.
 */
export function nsBankValueSql(alias: string): Prisma.Sql {
  const json = `${alias}.metadata->'nsData'->'market_value'`;
  const text = `${alias}.metadata->'nsData'->>'market_value'`;
  return Prisma.raw(
    `(CASE WHEN jsonb_typeof(${json}) = 'string' AND (${text}) ~ '${NS_BANK_VALUE_PATTERN}' ` +
      `THEN (${text})::float8 END)`
  );
}
