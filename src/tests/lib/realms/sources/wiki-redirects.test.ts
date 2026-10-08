import { describe, it, expect } from "@jest/globals";
import type { WikiQuery } from "~/lib/realms/lore-import";
import { resolveWikiRedirects } from "~/lib/realms/sources/wiki-redirects";

describe("resolveWikiRedirects", () => {
  it("maps redirecting links to their target, through normalization, and leaves plain pages out", async () => {
    const query: WikiQuery = async (_params, schema) =>
      schema.parse({
        query: {
          normalized: [{ from: "salvia", to: "Salvia" }],
          redirects: [{ from: "Salvia", to: "Sanctum Imperium Catholicum" }],
        },
      });
    expect(await resolveWikiRedirects(query, ["salvia", "Orioni", "salvia"])).toEqual({
      salvia: "Sanctum Imperium Catholicum",
    });
  });

  it("asks in batches of 50", async () => {
    const asked: number[] = [];
    const query: WikiQuery = async (params, schema) => {
      asked.push((params.titles ?? "").split("|").length);
      return schema.parse({});
    };
    await resolveWikiRedirects(
      query,
      Array.from({ length: 120 }, (_, i) => `Page ${i}`)
    );
    expect(asked).toEqual([50, 50, 20]);
  });
});
