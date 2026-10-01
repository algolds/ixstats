/** @jest-environment node */
/**
 * The hero card's reads: the server primes them and the client asks with the same inputs, so the
 * hydrated cache answers it (a different key would send the client to fetch, and the card to grow
 * after hydration again).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { heroCardInputs, mayNameCountry } from "~/lib/wiki-os/hero-card";

const source = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("mayNameCountry", () => {
  it("is true for a plain article title", () => {
    expect(mayNameCountry("Pelaxia")).toBe(true);
    expect(mayNameCountry("Economy of Urcea")).toBe(true);
  });

  it("is false for the Main Page, an empty title and anything in a namespace", () => {
    expect(mayNameCountry("Main Page")).toBe(false);
    expect(mayNameCountry("Main_Page")).toBe(false);
    expect(mayNameCountry("  ")).toBe(false);
    expect(mayNameCountry("Talk:Pelaxia")).toBe(false);
    expect(mayNameCountry("Category:Countries")).toBe(false);
  });
});

describe("heroCardInputs", () => {
  it("is each read's input, as the procedures take it", () => {
    expect(heroCardInputs("Pelaxia")).toEqual({
      parentCategories: { title: "Pelaxia" },
      awards: { title: "Pelaxia" },
      country: { id: "Pelaxia" },
    });
  });

  it("is what the client reader asks with", () => {
    const renderer = source("src/components/wiki-os/reader/ArticleRenderer.tsx");
    expect(renderer).toContain("heroCardInputs(title).country");
    expect(renderer).toContain("heroCardInputs(title).awards");
    expect(source("src/components/wiki-os/reader/CategoryBreadcrumb.tsx")).toContain(
      "heroCardInputs(title).parentCategories"
    );
  });
});
