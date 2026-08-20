import { classifyCulture, CULTURES } from "~/lib/onoma/lexicon/culture-classifier";
import { CULTURAL_PROFILES } from "~/lib/onoma/cultural-profiles";

describe("classifyCulture", () => {
  // Held-out real names (not verbatim in training) that should resolve to a single culture.
  const singles: Array<[string, string]> = [
    ["Quintus", "latin"],
    ["Gunnar", "germanic"],
    ["Khalid", "arabic"],
    ["Hongwu", "east-asian"],
    ["Sukarno", "austronesian"],
    ["Vladimir", "slavic"],
  ];
  test.each(singles)("classifies %s as single %s", (name, expected) => {
    const r = classifyCulture(name);
    expect(r.compound).toBe(false);
    expect(r.culture).toBe(expected);
  });

  test("blended names resolve to a sorted compound A+B", () => {
    const r = classifyCulture("Kensonia");
    expect(r.compound).toBe(true);
    expect(r.components).toHaveLength(2);
    expect(r.culture).toBe(r.components.slice().sort().join("+")); // canonical order
    expect(CULTURES).toEqual(expect.arrayContaining(r.components));
  });

  test("non-letter input → mixed with zero confidence", () => {
    expect(classifyCulture("1234").culture).toBe("mixed");
    expect(classifyCulture("").confidence).toBe(0);
  });

  // Regression guard: when it commits to a SINGLE culture, it's right most of the
  // time on its own training names. Floor below the ~80% observed to avoid flakiness.
  test("single-culture precision ≥ 70% (resubstitution)", () => {
    let commit = 0;
    let correct = 0;
    for (const c of CULTURES) {
      const names = [
        ...((CULTURAL_PROFILES as any)[c].person || []),
        ...((CULTURAL_PROFILES as any)[c].city || []),
        ...((CULTURAL_PROFILES as any)[c].country || []),
      ];
      for (const n of names) {
        const r = classifyCulture(n);
        if (!r.compound) {
          commit++;
          if (r.culture === c) correct++;
        }
      }
    }
    expect(commit).toBeGreaterThan(0);
    expect(correct / commit).toBeGreaterThan(0.7);
  });
});
