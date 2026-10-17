/** @jest-environment node */
import { afterEach, describe, expect, it, jest } from "@jest/globals";

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
