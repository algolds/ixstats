import { CORE_COMMANDS, CORE_FEATURES } from "~/components/halo/halo-registry";
describe("Halo registry: ThinkPages destinations", () => {
  it("gives every command a unique name (result ids are built from it)", () => {
    const names = CORE_COMMANDS.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("Halo registry: card destinations", () => {
  it("lists each entry once, so a search never shows the same result twice", () => {
    const names = [...CORE_COMMANDS, ...CORE_FEATURES].map((e) => e.name);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });
});
