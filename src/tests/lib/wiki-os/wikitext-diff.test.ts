/** @jest-environment node */
import { describe, it, expect } from "@jest/globals";
import {
  DIFF_MAX_BYTES_PER_SIDE,
  DiffTooLargeError,
  diffWikitext,
  type DiffRow,
} from "~/lib/wiki-os/transformers/wikitext-diff";

const lines = (count: number, prefix = "line"): string[] =>
  Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);

const rowsOf = (diff: ReturnType<typeof diffWikitext>): DiffRow[] =>
  diff.hunks.flatMap((h) => h.rows);

/** The newer text rebuilt from every kept and added row of a context-free-of-limits diff. */
const rebuildNew = (a: string, b: string): string => {
  const { hunks } = diffWikitext(a, b, { context: Infinity });
  return hunks
    .flatMap((h) => h.rows)
    .filter((r) => r.type !== "removed")
    .map((r) => r.content)
    .join("\n");
};

const rebuildOld = (a: string, b: string): string => {
  const { hunks } = diffWikitext(a, b, { context: Infinity });
  return hunks
    .flatMap((h) => h.rows)
    .filter((r) => r.type !== "added")
    .map((r) => r.content)
    .join("\n");
};

describe("diffWikitext hunks", () => {
  it("keeps 3 lines of context: 2 changes in 1,000 lines are at most 20 rows", () => {
    const base = lines(1000);
    const changed = [...base];
    changed[99] = "line 100 EDITED";
    changed[799] = "line 800 EDITED";

    const diff = diffWikitext(base.join("\n"), changed.join("\n"));

    expect(diff.hunks).toHaveLength(2);
    expect(rowsOf(diff).length).toBeLessThanOrEqual(20);
    expect(diff.added).toBe(2);
    expect(diff.removed).toBe(2);
    // 3 unchanged rows before and after each change
    const first = diff.hunks[0]!.rows;
    expect(first.map((r) => r.type)).toEqual([
      "context",
      "context",
      "context",
      "removed",
      "added",
      "context",
      "context",
      "context",
    ]);
    expect(first[0]).toMatchObject({ content: "line 97", oldNumber: 97, newNumber: 97 });
    expect(diff.hunks[0]!.skipped).toBe(96);
    expect(diff.hunks[1]!.skipped).toBe(800 - 3 - 1 - 100 - 3);
  });

  it("merges changes whose context touches into one hunk", () => {
    const base = lines(30);
    const changed = [...base];
    changed[9] = "x";
    changed[16] = "y"; // 6 unchanged lines between: contexts meet
    changed[24] = "z"; // 7 unchanged lines between y and z: a second hunk

    const diff = diffWikitext(base.join("\n"), changed.join("\n"));

    expect(diff.hunks).toHaveLength(2);
    expect(diff.hunks[0]!.rows.filter((r) => r.type === "added").map((r) => r.content)).toEqual([
      "x",
      "y",
    ]);
    expect(diff.hunks[1]!.rows.filter((r) => r.type === "added").map((r) => r.content)).toEqual([
      "z",
    ]);
  });

  it("has no hunks for identical texts and shows an inserted line with its number", () => {
    expect(diffWikitext("a\nb", "a\nb")).toEqual({ hunks: [], added: 0, removed: 0 });

    const diff = diffWikitext("a\nc", "a\nb\nc");
    expect(rowsOf(diff)).toEqual([
      { type: "context", content: "a", oldNumber: 1, newNumber: 1 },
      { type: "added", content: "b", oldNumber: null, newNumber: 2 },
      { type: "context", content: "c", oldNumber: 2, newNumber: 3 },
    ]);
  });

  it("treats an empty side as no lines, not one empty line", () => {
    const created = diffWikitext("", "a\nb");
    expect(created.removed).toBe(0);
    expect(created.added).toBe(2);
    expect(diffWikitext("a\nb", "").removed).toBe(2);
    expect(diffWikitext("", "")).toEqual({ hunks: [], added: 0, removed: 0 });
  });

  it("lists the removed lines of a changed block before the added ones", () => {
    const diff = diffWikitext("a\nb\nc\nd", "a\nB\nC\nd", { context: 0 });
    expect(rowsOf(diff).map((r) => `${r.type[0]}:${r.content}`)).toEqual([
      "r:b",
      "r:c",
      "a:B",
      "a:C",
    ]);
  });
});

describe("diffWikitext correctness", () => {
  it("rebuilds both texts from the rows, for random edits", () => {
    let seed = 12345;
    const rand = (max: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % max;
    };
    for (let round = 0; round < 60; round++) {
      const a = Array.from({ length: rand(40) }, () => `l${rand(6)}`);
      const b = a.filter(() => rand(4) !== 0);
      for (let i = rand(6); i > 0; i--) b.splice(rand(b.length + 1), 0, `n${rand(6)}`);
      const textA = a.join("\n");
      const textB = b.join("\n");
      expect(rebuildNew(textA, textB)).toBe(textB);
      expect(rebuildOld(textA, textB)).toBe(textA);
    }
  });

  it("finds the shortest script, not just a valid one", () => {
    const diff = diffWikitext("a\nb\nc\nd\ne\nf", "a\nc\nd\nx\ne\nf");
    expect(diff.removed).toBe(1);
    expect(diff.added).toBe(1);
  });

  it("replaces the middle of two completely different large texts instead of hanging", () => {
    const a = lines(8000, "old").join("\n");
    const b = lines(8000, "new").join("\n");
    const started = Date.now();

    const diff = diffWikitext(a, b);

    expect(Date.now() - started).toBeLessThan(5000);
    expect(diff.removed).toBe(8000);
    expect(diff.added).toBe(8000);
  });

  it("keeps the common head and tail out of the search for a small edit in a large text", () => {
    const a = lines(50_000);
    const b = [...a];
    b[25_000] = "changed";

    const diff = diffWikitext(a.join("\n"), b.join("\n"));

    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
    expect(rowsOf(diff)).toHaveLength(8);
  });
});

describe("diffWikitext size cap", () => {
  it("refuses a side over 2 MB, counted in UTF-8 bytes", () => {
    const over = "x".repeat(DIFF_MAX_BYTES_PER_SIDE + 1);
    expect(() => diffWikitext(over, "a")).toThrow(DiffTooLargeError);
    expect(() => diffWikitext("a", over)).toThrow(DiffTooLargeError);
    // 3-byte characters: 700k of them are 2.1 MB although the string is shorter than the limit
    expect(() => diffWikitext("€".repeat(700_000), "a")).toThrow(DiffTooLargeError);
  });

  it("accepts a side of exactly 2 MB", () => {
    const exact = "x".repeat(DIFF_MAX_BYTES_PER_SIDE);
    expect(diffWikitext(exact, exact).hunks).toEqual([]);
  });
});

describe("diffWikitext word marks", () => {
  it("marks the changed words of a replaced line, on both sides, as ranges", () => {
    const diff = diffWikitext("The quick brown fox", "The quick red fox");
    const [removed, added] = rowsOf(diff);

    expect(removed).toMatchObject({ type: "removed", marks: [[10, 15]] });
    expect(added).toMatchObject({ type: "added", marks: [[10, 13]] });
    expect(removed!.content.slice(10, 15)).toBe("brown");
    expect(added!.content.slice(10, 13)).toBe("red");
  });

  it("does not mark a line pair that shares nothing, nor an unpaired line", () => {
    const [removed, added] = rowsOf(diffWikitext("alpha", "beta"));
    expect(removed!.marks).toBeUndefined();
    expect(added!.marks).toBeUndefined();

    const inserted = rowsOf(diffWikitext("a", "a\nnew line"));
    expect(inserted.every((r) => r.marks === undefined)).toBe(true);
  });

  it("skips marks for a line pair longer than 2,000 characters", () => {
    const long = "word ".repeat(450); // 2,250 characters
    const [removed, added] = rowsOf(diffWikitext(`${long}one`, `${long}two`));
    expect(removed!.marks).toBeUndefined();
    expect(added!.marks).toBeUndefined();
  });

  it("never turns line text into markup: content stays plain text", () => {
    const [removed, added] = rowsOf(diffWikitext("<b>x</b> & y", "<i>x</i> & y"));
    expect(removed!.content).toBe("<b>x</b> & y");
    expect(added!.content).toBe("<i>x</i> & y");
  });
});
