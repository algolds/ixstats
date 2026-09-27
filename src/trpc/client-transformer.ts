import SuperJSON from "superjson";

/**
 * Drops `undefined` properties from plain objects (recursively, through arrays).
 * superjson otherwise ships them explicitly, and Zod records/unions such as
 * `z.record(z.string(), z.number())` reject an explicit `undefined` value even
 * though a missing key would pass. Dates, Maps, Sets etc. are left for superjson.
 */
export function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value === null || typeof value !== "object") return value;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) out[k] = stripUndefined(v);
  }
  return out;
}

/** Wire-compatible with the server's SuperJSON transformer; only cleans outgoing inputs. */
export const clientTransformer = {
  input: {
    serialize: (object: unknown) => SuperJSON.serialize(stripUndefined(object)),
    deserialize: (object: Parameters<typeof SuperJSON.deserialize>[0]) => SuperJSON.deserialize(object),
  },
  output: SuperJSON,
};
