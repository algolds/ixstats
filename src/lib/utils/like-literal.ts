/**
 * A value Postgres LIKE and ILIKE match literally: `\`, `%` and `_` escaped. Prisma's `mode: "insensitive"`
 * filters compile to ILIKE without escaping, so a user-typed `%` would otherwise match any row.
 */
export const likeLiteral = (value: string): string => value.replace(/[\\%_]/g, "\\$&");
