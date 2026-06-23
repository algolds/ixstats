import { formatCanonContext, canonContextHash, type CanonContext } from "./canon-context";

const base: CanonContext = {
  nation: { name: "Almadaria", leader: "Emperor Castos", governmentType: "Absolute Monarchy" },
  state: { approval: 65, stability: 80 },
  history: [{ description: "Border mobilization eased tensions", appliedIxTime: 1000 }],
  diplomacy: [{ otherName: "Verlandia", relationship: "ally", strength: 90 }],
  canonSource: "Almadaria",
};

describe("canon-context", () => {
  it("renders only the facts it was given", () => {
    const out = formatCanonContext(base);
    expect(out).toContain("Nation: Almadaria");
    expect(out).toContain("Emperor Castos");
    expect(out).toContain("Verlandia: ally");
    expect(out).toContain("Border mobilization eased tensions");
    expect(out).toContain('wiki page "Almadaria"');
  });

  it("omits absent fields instead of inventing them", () => {
    const sparse: CanonContext = {
      nation: { name: "Nowhere" },
      state: { approval: 50, stability: 50 },
      history: [],
      diplomacy: [],
    };
    const out = formatCanonContext(sparse);
    expect(out).toContain("Nation: Nowhere");
    expect(out).not.toContain("Leader:");
    expect(out).not.toContain("Key relationships:");
    expect(out).not.toContain("Canonical source:");
  });

  it("hash is stable for same canon and changes when canon changes", () => {
    expect(canonContextHash(base)).toBe(canonContextHash({ ...base }));
    const changed = { ...base, state: { approval: 10, stability: 80 } };
    expect(canonContextHash(changed)).not.toBe(canonContextHash(base));
  });
});
