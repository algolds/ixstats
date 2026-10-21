import { buildProvinceMergePlan } from "~/lib/maps/province-importer/merge-plan";

describe("buildProvinceMergePlan", () => {
  it("merges a name collision and creates the rest (regression)", () => {
    const plan = buildProvinceMergePlan(
      [{ name: "eryx" }, { name: "caphiria 1" }],
      [{ id: "a", name: "eryx" }],
      false
    );
    expect(plan[0]!.existingId).toBe("a");
    expect(plan[1]!.existingId).toBeNull();
  });
  it("creates everything when replaceExisting is true", () => {
    const plan = buildProvinceMergePlan([{ name: "eryx" }], [{ id: "a", name: "eryx" }], true);
    expect(plan[0]!.existingId).toBeNull();
  });
});
