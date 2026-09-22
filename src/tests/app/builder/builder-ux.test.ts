import {
  FIELD_IMPORTANCE,
  getFieldImportance,
} from "~/app/builder/lib/field-importance";

describe("Plan 003 - Builder UX Field Importance", () => {
  it("defines primary, secondary, and advanced field tiers for identity", () => {
    expect(FIELD_IMPORTANCE.identity?.countryName).toBe("primary");
    expect(FIELD_IMPORTANCE.identity?.flagUrl).toBe("primary");
    expect(FIELD_IMPORTANCE.identity?.motto).toBe("secondary");
    expect(FIELD_IMPORTANCE.identity?.callingCode).toBe("advanced");
  });

  it("defines primary, secondary, and advanced field tiers for government", () => {
    expect(FIELD_IMPORTANCE.government?.governmentType).toBe("primary");
    expect(FIELD_IMPORTANCE.government?.headOfState).toBe("primary");
    expect(FIELD_IMPORTANCE.government?.legislatureName).toBe("advanced");
  });

  it("defines primary, secondary, and advanced field tiers for economics", () => {
    expect(FIELD_IMPORTANCE.economics?.gdpNominal).toBe("primary");
    expect(FIELD_IMPORTANCE.economics?.population).toBe("primary");
    expect(FIELD_IMPORTANCE.economics?.giniCoefficient).toBe("secondary");
    expect(FIELD_IMPORTANCE.economics?.inflationRate).toBe("advanced");
  });

  it("falls back to secondary for unmapped fields", () => {
    expect(getFieldImportance("identity", "unknownField")).toBe("secondary");
    expect(getFieldImportance("nonExistentSection", "anyField")).toBe("secondary");
  });
});
