import {
  MAX_PNG_BASE64_LENGTH,
  MAX_PNG_BYTES,
  nationNameOptions,
  planColourMapping,
  rankColours,
} from "~/lib/maps/png-realm-map";

describe("MAX_PNG_BASE64_LENGTH", () => {
  it("is the base64 length of the largest accepted PNG", () => {
    expect(Buffer.alloc(MAX_PNG_BYTES).toString("base64")).toHaveLength(MAX_PNG_BASE64_LENGTH);
  });
});

describe("rankColours", () => {
  it("sorts by pixel count, largest first, with each colour's share of the detected pixels", () => {
    const ranked = rankColours([
      { hex: "#00FF00", pixelCount: 25 },
      { hex: "#ff0000", pixelCount: 50 },
      { hex: "#0000ff", pixelCount: 25 },
    ]);
    expect(ranked.map((c) => c.hex)).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
    expect(ranked.map((c) => c.share)).toEqual([0.5, 0.25, 0.25]);
  });

  it("gives zero shares when no pixels were counted, and leaves the input untouched", () => {
    const input = [
      { hex: "#aaaaaa", pixelCount: 0 },
      { hex: "#bbbbbb", pixelCount: 0 },
    ];
    expect(rankColours(input).map((c) => c.share)).toEqual([0, 0]);
    expect(input[0]!.hex).toBe("#aaaaaa");
    expect(rankColours([])).toEqual([]);
  });
});

describe("nationNameOptions", () => {
  it("merges the realm's countries and claimable nation pages, deduplicated and sorted", () => {
    expect(
      nationNameOptions(
        [{ name: "Zenith" }, { name: "Aurelia" }],
        [{ title: "Borealis" }, { title: "Aurelia" }]
      )
    ).toEqual(["Aurelia", "Borealis", "Zenith"]);
  });

  it("is empty before the realm loads", () => {
    expect(nationNameOptions(undefined, undefined)).toEqual([]);
  });
});

describe("planColourMapping", () => {
  const colours = rankColours([
    { hex: "#ff0000", pixelCount: 40 },
    { hex: "#00ff00", pixelCount: 30 },
    { hex: "#0000ff", pixelCount: 20 },
    { hex: "#ffffff", pixelCount: 10 },
  ]);

  it("maps assigned colours to trimmed nation names and counts the rest as dropped", () => {
    const plan = planColourMapping(
      colours,
      { "#ff0000": "  Aurelia ", "#00ff00": "Borealis", "#0000ff": "   " },
      new Set(["#ffffff"])
    );
    expect(plan.colorMapping).toEqual({ "#ff0000": "Aurelia", "#00ff00": "Borealis" });
    expect(plan.mapped).toBe(2);
    expect(plan.ignored).toBe(1);
    expect(plan.unmapped).toBe(1);
    expect(plan.duplicates).toEqual([]);
  });

  it("an ignored colour is dropped even when a nation was typed for it", () => {
    const plan = planColourMapping(colours, { "#ffffff": "Ocean" }, new Set(["#ffffff"]));
    expect(plan.colorMapping).toEqual({});
    expect(plan.ignored).toBe(1);
    expect(plan.unmapped).toBe(3);
  });

  it("reports a nation given more than one colour (only one region can carry its name)", () => {
    const plan = planColourMapping(
      colours,
      { "#ff0000": "Aurelia", "#00ff00": "Aurelia", "#0000ff": "Borealis" },
      new Set()
    );
    expect(plan.duplicates).toEqual(["Aurelia"]);
  });
});
