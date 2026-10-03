import { matchExpression } from "~/lib/maps/match-expression";

describe("matchExpression", () => {
  it("builds a match with every pair then the fallback", () => {
    expect(
      matchExpression(
        ["get", "k"],
        [
          ["a", 1],
          ["b", 2],
        ],
        0
      )
    ).toEqual(["match", ["get", "k"], "a", 1, "b", 2, 0]);
  });

  it("returns a plain literal fallback instead of an invalid case-less match for no pairs", () => {
    const expr = matchExpression(["get", "k"], [], "#e8e5da");
    expect(expr).toEqual(["literal", "#e8e5da"]);
  });

  it("keeps the first output for a duplicate label (MapLibre rejects repeated branch labels)", () => {
    const expr = matchExpression(
      ["get", "k"],
      [
        ["a", 1],
        ["b", 2],
        ["a", 3],
      ],
      0
    );
    expect(expr).toEqual(["match", ["get", "k"], "a", 1, "b", 2, 0]);
  });
});
