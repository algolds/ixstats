import { pickForExposure } from "./exposure-pick";

/** A seeded generator, so the sampling is repeatable. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

describe("pickForExposure", () => {
  it("returns n distinct nations, or all of them when there are fewer", () => {
    const nations = [1, 2, 3, 4, 5, 6].map((id) => ({ id, followers: 0 }));
    const picked = pickForExposure(nations, 4, seeded(1));
    expect(new Set(picked.map((p) => p.id)).size).toBe(4);
    expect(pickForExposure(nations.slice(0, 2), 4, seeded(1))).toHaveLength(2);
  });

  it("surfaces unfollowed nations far more often than heavily followed ones", () => {
    const nations = [
      { id: "quiet", followers: 0 },
      { id: "popular", followers: 20 },
    ];
    const random = seeded(7);
    let quietFirst = 0;
    for (let i = 0; i < 1000; i++) {
      if (pickForExposure(nations, 1, random)[0]!.id === "quiet") quietFirst++;
    }
    expect(quietFirst).toBeGreaterThan(900);
    expect(quietFirst).toBeLessThan(1000);
  });
});
