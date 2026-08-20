import { assignBucket, topCompounds } from "~/lib/onoma/lexicon/bucket";
import { classifyCulture } from "~/lib/onoma/lexicon/culture-classifier";

describe("assignBucket", () => {
  test("single-culture name → its culture regardless of kept set", () => {
    expect(assignBucket("Vladimir", new Set())).toBe("slavic");
  });

  test("kept compound stays compound; tail compound collapses to a single culture", () => {
    // Kensonia classifies as the compound latin+slavic.
    const r = classifyCulture("Kensonia");
    expect(r.compound).toBe(true);
    expect(assignBucket("Kensonia", new Set([r.culture]))).toBe(r.culture); // kept
    const collapsed = assignBucket("Kensonia", new Set()); // not kept → dominant single
    expect(r.components).toContain(collapsed);
    expect(collapsed).not.toContain("+");
  });
});

describe("topCompounds", () => {
  test("returns at most n compound labels, each an A+B", () => {
    const names = ["Kensonia", "Solafioden", "Vladimir", "Quintus", "Armenwerke"];
    const top = topCompounds(names, 2);
    expect(top.length).toBeLessThanOrEqual(2);
    for (const c of top) expect(c).toMatch(/^[a-z-]+\+[a-z-]+$/);
  });
});
