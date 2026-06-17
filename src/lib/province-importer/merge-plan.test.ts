import { buildProvinceMergePlan, subdivisionNameKey } from "../province-importer/merge-plan";

describe("buildProvinceMergePlan", () => {
  it("creates all when no existing subdivisions", () => {
    const plan = buildProvinceMergePlan([{ name: "A" }, { name: "B" }], [], false);
    expect(plan.every((e) => e.existingId === null)).toBe(true);
  });

  it("merges a name collision and creates the rest (regression)", () => {
    const plan = buildProvinceMergePlan(
      [{ name: "eryx" }, { name: "caphiria 1" }],
      [{ id: "a", name: "eryx" }],
      false
    );
    expect(plan[0]!.existingId).toBe("a");
    expect(plan[1]!.existingId).toBeNull();
  });

  it("matches case- and whitespace-insensitively", () => {
    const plan = buildProvinceMergePlan([{ name: "  eryx " }], [{ id: "a", name: "Eryx" }], false);
    expect(plan[0]!.existingId).toBe("a");
  });

  it("creates everything when replaceExisting is true", () => {
    const plan = buildProvinceMergePlan([{ name: "eryx" }], [{ id: "a", name: "eryx" }], true);
    expect(plan[0]!.existingId).toBeNull();
  });

  it("normalizes keys", () => {
    expect(subdivisionNameKey("  Foo Bar ")).toBe("foo bar");
  });
});
