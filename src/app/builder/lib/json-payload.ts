/**
 * Builder state is typed with rich interfaces, but the country create/update and
 * draft endpoints accept loose JSON objects (Zod `.passthrough()` schemas / Prisma
 * Json) that the server validates at runtime. Interfaces lack the index signature
 * those JSON types require, so this is the single, explicit crossing point.
 */
export function asJsonPayload<T>(payload: object): T {
  return payload as T;
}
