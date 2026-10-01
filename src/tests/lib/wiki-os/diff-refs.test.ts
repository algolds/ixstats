import { diffNeedsHistory, resolveDiffRefs } from "~/lib/wiki-os/diff-refs";

// Newest first, as the history lists them.
const HISTORY = ["9", "7", "5", "3"];

describe("resolveDiffRefs (plan 412)", () => {
  it("?diff=<ref>&oldid=<ref> compares the two", () => {
    expect(resolveDiffRefs({ oldid: "5", diff: "9" }, [])).toEqual({ fromrev: "5", torev: "9" });
  });

  it("?diff=<ref> alone is what that revision changed", () => {
    expect(resolveDiffRefs({ oldid: null, diff: "7" }, [])).toEqual({
      fromrev: undefined,
      torev: "7",
    });
  });

  it("?diff=prev&oldid=N is what N changed, and needs an oldid", () => {
    expect(resolveDiffRefs({ oldid: "5", diff: "prev" }, [])).toEqual({
      fromrev: undefined,
      torev: "5",
    });
    expect(resolveDiffRefs({ oldid: null, diff: "prev" }, [])).toBeNull();
  });

  it("?diff=next&oldid=N compares N with the revision after it", () => {
    expect(resolveDiffRefs({ oldid: "5", diff: "next" }, HISTORY)).toEqual({
      fromrev: "5",
      torev: "7",
    });
    expect(resolveDiffRefs({ oldid: "9", diff: "next" }, HISTORY)).toBeNull(); // nothing after the newest
    expect(resolveDiffRefs({ oldid: "4", diff: "next" }, HISTORY)).toBeNull(); // not in the history
    expect(resolveDiffRefs({ oldid: null, diff: "next" }, HISTORY)).toBeNull();
  });

  it("?diff=cur compares with the newest revision", () => {
    expect(resolveDiffRefs({ oldid: "3", diff: "cur" }, HISTORY)).toEqual({
      fromrev: "3",
      torev: "9",
    });
    expect(resolveDiffRefs({ oldid: null, diff: "cur" }, HISTORY)).toEqual({
      fromrev: undefined,
      torev: "9",
    });
    expect(resolveDiffRefs({ oldid: "3", diff: "cur" }, [])).toBeNull();
  });

  it("only next and cur need the history", () => {
    expect(diffNeedsHistory({ oldid: "5", diff: "next" })).toBe(true);
    expect(diffNeedsHistory({ oldid: "5", diff: "cur" })).toBe(true);
    expect(diffNeedsHistory({ oldid: "5", diff: "prev" })).toBe(false);
    expect(diffNeedsHistory({ oldid: "5", diff: "9" })).toBe(false);
  });
});
