/** @jest-environment node */
/**
 * The tRPC client's wire settings: a mutation is never re-sent in production (a lost response would run a payment
 * twice), and what the client serialises validates like plain JSON (undefined keys dropped, so a builder save with
 * an optional field left out passes its record and union schemas) while nulls and Dates survive. Folds
 * client-transformer.test.ts.
 */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import SuperJSON from "superjson";
import { z } from "zod";
import { clientTransformer } from "~/trpc/client-transformer";

describe("createQueryClient", () => {
  afterEach(() => {
    jest.resetModules();
  });

  it("never re-sends a mutation in production, where a lost response would run it twice", async () => {
    const previous = process.env.NODE_ENV;
    Object.assign(process.env, { NODE_ENV: "production" });
    try {
      const { createQueryClient } = await import("~/trpc/query-client");
      expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(0);
    } finally {
      Object.assign(process.env, { NODE_ENV: previous });
    }
  });
});

describe("the client transformer", () => {
  it("drops undefined keys so records and unions validate, and keeps nulls and Dates", () => {
    const schema = z.object({ m: z.record(z.string(), z.number()), n: z.string().optional() });
    const date = new Date("2030-01-01");
    const input = {
      m: { a: 1, b: undefined },
      n: undefined,
      list: [{ x: undefined, y: 2 }],
      z: null,
      d: date,
    };
    const wire = SuperJSON.deserialize(clientTransformer.input.serialize(input));
    expect(wire).toEqual({ m: { a: 1 }, list: [{ y: 2 }], z: null, d: date });
    expect(schema.safeParse(wire).success).toBe(true);
  });
});
