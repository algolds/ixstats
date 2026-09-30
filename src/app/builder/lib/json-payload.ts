/**
 * Builder state is typed with rich interfaces, but the country create/update and
 * draft endpoints accept loose JSON objects (Zod `.passthrough()` schemas / Prisma
 * Json) that the server validates at runtime. Interfaces lack the index signature
 * those JSON types require, so this is the single, explicit crossing point.
 *
 * The payload is round-tripped through JSON so it is real JSON on the wire: superjson
 * would otherwise ship `undefined` keys, `Date`s (e.g. tax exemption `endDate`) and
 * NaN/Infinity, all of which the server's JSON schemas reject.
 */
export function asJsonPayload<T>(payload: object): T {
  return JSON.parse(
    JSON.stringify(payload, (_key, value: unknown) =>
      typeof value === "number" && !Number.isFinite(value) ? undefined : value
    )
  ) as T;
}
