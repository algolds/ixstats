/** @jest-environment node */
/**
 * The price history chart sits in the card sheet in both themes, so its grid, axes, tooltip and line take the Facet
 * tokens, never a colour of their own (a dark-only hex vanishes on the light sheet).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");
const chart = readFileSync(
  resolve(ROOT, "src/components/cards/display/CardPriceHistoryChart.tsx"),
  "utf8"
);
const tokens = readFileSync(resolve(ROOT, "src/styles/facet/tokens.css"), "utf8");

describe("CardPriceHistoryChart colours", () => {
  it("names no colour literal", () => {
    expect(chart.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch)\(/gi) ?? []).toEqual([]);
  });

  it("takes every colour, shadow and radius from tokens.css", () => {
    const used = [...new Set(Array.from(chart.matchAll(/var\((--[\w-]+)\)/g), (m) => m[1]))];
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((name) => !tokens.includes(`${name}:`))).toEqual([]);
  });
});
