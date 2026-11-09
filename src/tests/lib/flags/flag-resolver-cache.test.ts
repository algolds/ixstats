/** @jest-environment node */
/** The resolver's memory cache is bounded: it never holds more than 2000 entries. */
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  fetchMediaWikiImageBatch: jest.fn(async () => new Map()),
}));

import { ServerFlagResolver } from "~/lib/flags/flag-resolver.server";

describe("ServerFlagResolver memory cache", () => {
  it("stays at or under 2000 entries after resolving 2001 distinct names", async () => {
    const resolver = new ServerFlagResolver();
    const names = Array.from({ length: 2001 }, (_, i) => `Realm Number ${i}`);
    await resolver.resolveBatch(names);
    expect(resolver.stats().memoryCacheSize).toBeLessThanOrEqual(2000);
    expect(resolver.stats().memoryCacheSize).toBe(2000);
  });
});
