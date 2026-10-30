import { compareToBaseline } from "../compiler-ratchet";

describe("compareToBaseline", () => {
  it("flags a file whose skips grew and a new file with skips", () => {
    expect(compareToBaseline({ "a.tsx": 3, "b.tsx": 1 }, { "a.tsx": 2 }).grew).toEqual([
      "a.tsx: 2 -> 3",
      "b.tsx: 0 -> 1",
    ]);
  });
  it("reports drops, including a file that reached zero", () => {
    expect(compareToBaseline({ "a.tsx": 1 }, { "a.tsx": 2, "c.tsx": 4 }).fell).toEqual([
      "a.tsx: 2 -> 1",
      "c.tsx: 4 -> 0",
    ]);
  });
  it("is silent when nothing moved", () => {
    expect(compareToBaseline({ "a.tsx": 2 }, { "a.tsx": 2 })).toEqual({ grew: [], fell: [] });
  });
});
