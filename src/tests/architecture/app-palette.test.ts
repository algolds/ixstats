import { APP_IDS, APP_TINTS, APP_TINT_LIGHTNESS, BRAND_TINTS } from "~/lib/design/tokens";

/** The default tint is an ink (a near-neutral), so it has no hue to clash and sits off the palette's lightness. */
const INK = "default";

/** OKLCH lightness, chroma and hue of an sRGB hex colour. */
function oklch(hex: string): { l: number; c: number; h: number } {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255)) as [
    number,
    number,
    number,
  ];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    c: Math.hypot(a, bb),
    h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360,
  };
}

const hueGap = (x: number, y: number) => Math.min(Math.abs(x - y), 360 - Math.abs(x - y));
const entries = Object.entries(APP_TINTS).filter(([app]) => app !== INK);

describe("Facet app palette", () => {
  it.each(["light", "dark"] as const)(
    "gives every app its own hue, 30 degrees clear (%s)",
    (mode) => {
      const close: string[] = [];
      entries.forEach(([a, x], i) =>
        entries.slice(i + 1).forEach(([b, y]) => {
          const gap = hueGap(oklch(x[mode].tint).h, oklch(y[mode].tint).h);
          if (gap < 30) close.push(`${a}/${b}: ${gap.toFixed(1)}`);
        })
      );
      expect(close).toEqual([]);
    }
  );

  it.each(["light", "dark"] as const)(
    "draws every non-brand tint at the palette's one lightness (%s)",
    (mode) => {
      for (const [app, sets] of entries) {
        if ((BRAND_TINTS as readonly string[]).includes(app)) continue;
        expect([app, oklch(sets[mode].tint).l.toFixed(2)]).toEqual([
          app,
          APP_TINT_LIGHTNESS[mode].toFixed(2),
        ]);
      }
    }
  );

  it.each(["light", "dark"] as const)("keeps the default an ink, not a colour (%s)", (mode) => {
    expect(oklch(APP_TINTS[INK][mode].tint).c).toBeLessThan(0.04);
  });

  it("has no Intel or Sports tint: Defense wears MyCountry's, Sports wears Labs'", () => {
    expect(APP_IDS).not.toContain("intel");
    expect(APP_IDS).not.toContain("sports");
    expect(APP_IDS).toContain("labs");
  });
});
