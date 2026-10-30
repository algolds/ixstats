/**
 * Heraldic lines of partition: the patterned edge each line style draws between two points, the
 * division pieces that share one partition line, and the ordinaries whose edges face the field.
 */
import { LINE_STYLES } from "~/lib/heraldry/constants";
import { styledEdge, partitionEdge } from "~/lib/heraldry/line-styles";
import { renderDivisionPaths, renderOrdinaryPath } from "~/lib/heraldry/svg-utils";

const COMMAND = /[MLQCAZ]/g;
const points = (fragment: string) =>
  [...fragment.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
const patterned = LINE_STYLES.map((s) => s.value).filter((s) => s !== "straight");
const t = ["or", "azure"] as const;

describe("styledEdge", () => {
  it("draws a straight line as a single segment", () => {
    expect(styledEdge(250, 500, 750, 500, "straight")).toBe("L 750,500");
  });

  it.each(patterned)(
    "draws %s as a repeating motif from the start point to the end point",
    (style) => {
      const path = styledEdge(250, 500, 750, 500, style);
      expect(path).toMatch(/^[LQCA] /);
      expect(path).not.toMatch(/^[LQCA] 250,500\b/);
      expect(path.endsWith("750,500")).toBe(true);
      expect(path.match(COMMAND)!.length).toBeGreaterThan(4);
    }
  );

  it("draws indented as teeth alternating above and below the line by one amplitude", () => {
    const teeth = points(styledEdge(250, 500, 750, 500, "indented")).slice(0, -1);
    expect(teeth.length).toBeGreaterThan(4);
    teeth.forEach(([, y], i) => expect(y).toBe(i % 2 === 0 ? 487.5 : 512.5));
  });

  it("draws dancetty with teeth twice as large as indented", () => {
    const teeth = points(styledEdge(250, 500, 750, 500, "dancetty")).slice(0, -1);
    expect(teeth.map(([, y]) => Math.abs(y! - 500))).toEqual(teeth.map(() => 25));
    expect(teeth).toHaveLength(10);
  });

  it("draws engrailed and invected as mirror images", () => {
    const engrailed = styledEdge(250, 500, 750, 500, "engrailed");
    expect(engrailed).toMatch(/^A [\d.]+ [\d.]+ 0 0 0 /);
    expect(styledEdge(250, 500, 750, 500, "invected")).toBe(
      engrailed.replace(/ 0 0 0 /g, " 0 0 1 ")
    );
  });
});

describe("partitionEdge", () => {
  const key = (p: number[]) => p.join(",");
  /** The start point and each segment's end point, in walking order. */
  const walk = (start: string, fragment: string) => [
    start,
    ...fragment.split(/(?=[LQCA] )/).map((seg) => key(points(seg).at(-1)!)),
  ];

  it.each(patterned)(
    "draws one %s line whichever way it is walked, so the pieces on either side meet without a seam",
    (style) => {
      const there = partitionEdge(250, 250, 750, 750, style);
      const back = partitionEdge(750, 750, 250, 250, style);
      expect(walk("750,750", back)).toEqual(walk("250,250", there).reverse());
      expect(points(back).map(key).sort()).toEqual(
        ["250,250", ...points(there).map(key)].filter((p) => p !== "750,750").sort()
      );
    }
  );
});

describe("division lines", () => {
  it("leaves a plain field alone", () => {
    expect(renderDivisionPaths("plain", [...t], "wavy")).toEqual(
      renderDivisionPaths("plain", [...t], "straight")
    );
  });

  it.each([
    "per-pale",
    "per-fess",
    "per-bend",
    "per-bend-sinister",
    "quarterly",
    "per-saltire",
    "per-chevron",
    "barry",
    "checky",
  ] as const)("draws the %s partition lines in the field's line style", (division) => {
    expect(renderDivisionPaths(division, [...t], "wavy")).not.toEqual(
      renderDivisionPaths(division, [...t], "straight")
    );
  });

  it("keeps the shield's own edges straight: only the partition line is patterned", () => {
    const [chief] = renderDivisionPaths("per-fess", [...t], "embattled");
    expect(chief!.path).toMatch(/^M 250,250 L 750,250 L 750,500 /);
    expect(chief!.path).toMatch(/L 250,250 Z$/);
  });
});

describe("ordinary edges", () => {
  const ys = (d: string) => points(d).map(([, y]) => y!);

  it("bites an engrailed fess's arcs into the fess, and pushes an invected fess's out", () => {
    const engrailed = renderOrdinaryPath("fess", "heater", "engrailed");
    expect(engrailed).toContain(" 0 0 0 ");
    expect(engrailed).not.toContain(" 0 0 1 ");
    expect(Math.min(...ys(engrailed))).toBe(437.5);
    expect(Math.max(...ys(engrailed))).toBe(562.5);
    const invected = renderOrdinaryPath("fess", "heater", "invected");
    expect(invected).toContain(" 0 0 1 ");
    expect(invected).not.toContain(" 0 0 0 ");
  });

  it("keeps edges on the shield's own edge straight", () => {
    expect(renderOrdinaryPath("chief", "heater", "wavy")).toMatch(
      /^M 250,250 L 750,250 L 750,375 Q /
    );
  });

  it.each(["bordure", "tressure"] as const)("draws a %s's curved edges unpatterned", (type) => {
    expect(renderOrdinaryPath(type, "heater", "wavy")).toBe(
      renderOrdinaryPath(type, "heater", "straight")
    );
  });
});
