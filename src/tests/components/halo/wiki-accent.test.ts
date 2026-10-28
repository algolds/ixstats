/** @jest-environment node */
import fs from "fs";
import path from "path";
import { accentMix, wikiAccent } from "~/components/halo/plugins/wiki/accent";

const halo = path.resolve(__dirname, "../../../components/halo");
const walk = (d: string): string[] =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(path.join(d, e.name))
        : /\.tsx?$/.test(e.name)
          ? [path.join(d, e.name)]
          : []
    );
const all = walk(halo)
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");

describe("wiki accent", () => {
  it("falls back to the app tint", () => {
    expect(wikiAccent(null)).toBe("var(--tint)");
    expect(wikiAccent({ primary: "#7a1f1f" })).toBe("#7a1f1f");
  });
  it("mixes any colour, tokens included", () => {
    expect(accentMix("var(--tint)", 12)).toBe("color-mix(in srgb, var(--tint) 12%, transparent)");
  });
  it("Halo has no hardcoded blue, white text or glow shadows", () => {
    expect(all).not.toMatch(/#3b82f6|rgba\(59, 130, 246|text-white|boxShadow/);
  });
});
