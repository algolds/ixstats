import { computeParimutuel, outcomeFromScores, type PoolEntry } from "~/lib/sports/predictions";

describe("outcomeFromScores", () => {
  test("maps scores to outcome", () => {
    expect(outcomeFromScores(2, 1)).toBe("home");
    expect(outcomeFromScores(0, 3)).toBe("away");
    expect(outcomeFromScores(1, 1)).toBe("draw");
  });
});

describe("computeParimutuel", () => {
  const pool: PoolEntry[] = [
    { id: "a", outcome: "home", stake: 100 },
    { id: "b", outcome: "home", stake: 50 },
    { id: "c", outcome: "away", stake: 90 },
  ];

  test("winners split the whole pool pro-rata; losers get nothing", () => {
    const s = computeParimutuel(pool, "home");
    const total = 240;
    // a and b share total in ratio 100:50
    expect(s.find((x) => x.id === "a")).toEqual({
      id: "a",
      status: "won",
      payout: (100 * total) / 150,
    });
    expect(s.find((x) => x.id === "b")).toEqual({
      id: "b",
      status: "won",
      payout: (50 * total) / 150,
    });
    expect(s.find((x) => x.id === "c")).toEqual({ id: "c", status: "lost", payout: 0 });
    // pool is conserved
    expect(s.reduce((acc, x) => acc + x.payout, 0)).toBeCloseTo(total);
  });

  test("nobody right → everyone refunded (void)", () => {
    const s = computeParimutuel(pool, "draw");
    expect(s.every((x) => x.status === "void")).toBe(true);
    expect(s.find((x) => x.id === "a")!.payout).toBe(100);
    expect(s.reduce((acc, x) => acc + x.payout, 0)).toBe(240);
  });
});
