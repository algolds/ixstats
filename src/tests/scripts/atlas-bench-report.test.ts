/**
 * @jest-environment node
 */
import {
  atMost,
  exactly,
  exitCode,
  info,
  markedPayload,
  matches,
  median,
  percentile,
  renderResults,
  RESULT_MARKER,
  type TargetResult,
} from "../../../scripts/perf/atlas-bench-report";

describe("atMost", () => {
  it("passes at and under the limit and fails over it", () => {
    expect(atMost("a", 50, 50, "ms").pass).toBe(true);
    expect(atMost("a", 3.2, 50, "ms").pass).toBe(true);
    expect(atMost("a", 50.01, 50, "ms").pass).toBe(false);
  });

  it("never passes a value that was not measured", () => {
    expect(atMost("a", Number.NaN, 50, "ms").pass).toBe(false);
    expect(atMost("a", Number.POSITIVE_INFINITY, 50, "ms").pass).toBe(false);
  });

  it("writes the measured value and the limit with their unit", () => {
    const result = atMost("layer hit", 0.314, 50, "ms");
    expect(result.measured).toBe("0.31 ms");
    expect(result.target).toBe("<= 50 ms");
  });

  it("writes a bare count without a trailing space", () => {
    const result = atMost("queries", 0, 0, "");
    expect(result.measured).toBe("0");
    expect(result.target).toBe("<= 0");
  });
});

describe("exactly", () => {
  it("passes only on the expected value", () => {
    expect(exactly("status", 304, 304, "").pass).toBe(true);
    expect(exactly("status", 200, 304, "").pass).toBe(false);
    expect(exactly("status", Number.NaN, 304, "").pass).toBe(false);
  });

  it("writes the target with an equals sign", () => {
    expect(exactly("checks", 1, 1, "").target).toBe("= 1");
  });
});

describe("matches", () => {
  it("passes only when the measured text is the expected text", () => {
    const header = "public, max-age=31536000, immutable";
    expect(matches("header", header, header).pass).toBe(true);
    expect(matches("header", "private, no-store", header).pass).toBe(false);
    expect(matches("header", "", header).pass).toBe(false);
  });

  it("writes both texts as given", () => {
    const result = matches("header", "no-cache", "immutable");
    expect(result.measured).toBe("no-cache");
    expect(result.target).toBe("immutable");
  });
});

describe("median", () => {
  it("is the middle value, or the mean of the middle two", () => {
    expect(median([9, 1, 5])).toBe(5);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([7])).toBe(7);
  });

  it("does not reorder its input and is NaN for no values", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
    expect(median([])).toBeNaN();
  });
});

describe("percentile", () => {
  it("is the smallest value that at least p of the values are at or below (nearest rank)", () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(percentile(values, 0.95)).toBe(19);
    expect(percentile(values, 1)).toBe(20);
    expect(percentile(values, 0.5)).toBe(10);
    expect(percentile([5], 0.95)).toBe(5);
  });

  it("is not the maximum when one frame in twenty is slow", () => {
    const frames = [...Array.from({ length: 19 }, () => 1), 4.5];
    expect(percentile(frames, 0.95)).toBe(1);
    expect(Math.max(...frames)).toBe(4.5);
  });

  it("does not reorder its input and is NaN for none", () => {
    const values = [3, 1, 2];
    percentile(values, 0.95);
    expect(values).toEqual([3, 1, 2]);
    expect(percentile([], 0.95)).toBeNaN();
  });
});

describe("info", () => {
  it("is a line with a number and no target", () => {
    const line = info("slowest drag frame", 4.5, "ms", "frame 12");
    expect(line.measured).toBe("4.5 ms");
    expect(line.target).toBe("not gated");
    expect(line.informational).toBe(true);
    expect(line.detail).toBe("frame 12");
  });
});

describe("markedPayload", () => {
  it("returns the text after the last marker line, whatever else the process printed", () => {
    const stdout = [
      "[DATABASE] Development mode",
      `${RESULT_MARKER}{"a":1}`,
      "warning: something",
      `${RESULT_MARKER}{"a":2}`,
      "",
    ].join("\n");
    expect(markedPayload(stdout)).toBe('{"a":2}');
  });

  it("is null when no line carries the marker", () => {
    expect(markedPayload("nothing here\n")).toBeNull();
    expect(markedPayload("")).toBeNull();
  });
});

describe("exitCode", () => {
  const pass = atMost("p", 1, 2, "ms");
  const fail = atMost("f", 3, 2, "ms");

  it("is 0 when every target passes", () => {
    expect(exitCode([pass, pass])).toBe(0);
  });

  it("is 1 when any target fails", () => {
    expect(exitCode([pass, fail, pass])).toBe(1);
  });

  it("is 1 when nothing was measured", () => {
    expect(exitCode([])).toBe(1);
  });

  it("is not decided by an informational line, however slow", () => {
    expect(exitCode([pass, info("slowest frame", 900, "ms")])).toBe(0);
    expect(exitCode([info("slowest frame", 1, "ms")])).toBe(1);
  });
});

describe("renderResults", () => {
  const results: TargetResult[] = [
    atMost("layer route hit", 0.31, 50, "ms", "cold 345 ms"),
    atMost("geo profile", 512, 400, "ms"),
  ];

  it("prints one PASS or FAIL line per target, with the detail under it", () => {
    const lines = renderResults(results).split("\n");
    expect(lines[0]).toMatch(/^PASS +layer route hit +0\.31 ms +<= 50 ms$/);
    expect(lines[1]).toBe("      cold 345 ms");
    expect(lines[2]).toMatch(/^FAIL +geo profile +512 ms +<= 400 ms$/);
  });

  it("ends with the count of targets that pass", () => {
    const text = renderResults(results);
    expect(text.split("\n").at(-1)).toBe("1 of 2 targets pass");
  });

  it("marks an informational line INFO and leaves it out of the count of targets", () => {
    const text = renderResults([...results, info("slowest drag frame", 4.5, "ms", "frame 12")]);
    const lines = text.split("\n");
    expect(lines[3]).toMatch(/^INFO +slowest drag frame +4\.5 ms +not gated$/);
    expect(lines[4]).toBe("      frame 12");
    expect(lines.at(-1)).toBe("1 of 2 targets pass");
  });

  it("aligns the measured column across lines", () => {
    const [first, , second] = renderResults(results).split("\n");
    expect(first!.indexOf("0.31 ms")).toBe(second!.indexOf("512 ms"));
  });
});
