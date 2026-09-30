import SuperJSON from "superjson";
import { z } from "zod";
import { clientTransformer, stripUndefined } from "~/trpc/client-transformer";

describe("tRPC client transformer", () => {
  it("drops undefined keys so records/unions validate like plain JSON", () => {
    const schema = z.object({ m: z.record(z.string(), z.number()), n: z.string().optional() });
    const input = { m: { a: 1, b: undefined }, n: undefined, list: [{ x: undefined, y: 2 }] };
    const wire = SuperJSON.deserialize(clientTransformer.input.serialize(input));
    expect(wire).toEqual({ m: { a: 1 }, list: [{ y: 2 }] });
    expect(schema.safeParse(wire).success).toBe(true);
  });

  it("keeps nulls, Dates, Maps and Sets intact", () => {
    const date = new Date("2030-01-01");
    const input = { a: null, d: date, m: new Map([["k", 1]]), s: new Set([1]) };
    const wire = SuperJSON.deserialize(clientTransformer.input.serialize(input)) as typeof input;
    expect(wire.a).toBeNull();
    expect(wire.d).toEqual(date);
    expect(wire.m.get("k")).toBe(1);
    expect(wire.s.has(1)).toBe(true);
    expect(stripUndefined(undefined)).toBeUndefined();
  });
});
