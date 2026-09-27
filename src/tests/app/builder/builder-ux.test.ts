import {
  FIELD_IMPORTANCE,
  getFieldImportance,
  shouldAutoOpenAdvanced,
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

  it("puts every field the forms hide behind the disclosure in the advanced tier", () => {
    const disclosed: Record<string, string[]> = {
      identity: ["largestCity"],
      government: [
        "legislatureName",
        "executiveName",
        "judicialName",
        "auditLevel",
        "reserveTarget",
        "debtLimit",
      ],
      economics: [
        "youthUnemploymentRate",
        "seniorEmploymentRate",
        "unionizationRate",
        "collectiveBargainingCoverage",
        "paidVacationDays",
        "paidSickLeaveDays",
        "parentalLeaveWeeks",
        "netMigrationRate",
        "immigrationRate",
        "emigrationRate",
        "infantMortalityRate",
        "maternalMortalityRate",
        "healthExpenditureGDP",
      ],
    };
    for (const [section, fields] of Object.entries(disclosed)) {
      for (const field of fields) {
        expect(getFieldImportance(section, field)).toBe("advanced");
      }
    }
  });
});

describe("Plan 003 - Advanced options auto-open rule", () => {
  it("stays collapsed when advanced fields are empty, blank or missing", () => {
    expect(
      shouldAutoOpenAdvanced("government", {
        legislatureName: "",
        executiveName: "   ",
        judicialName: undefined,
      })
    ).toBe(false);
    expect(shouldAutoOpenAdvanced("identity", { largestCity: null })).toBe(false);
  });

  it("opens when any advanced field has a value", () => {
    expect(
      shouldAutoOpenAdvanced("government", {
        legislatureName: "",
        executiveName: "",
        judicialName: "High Court",
      })
    ).toBe(true);
  });

  it("ignores values of fields that are always visible", () => {
    expect(shouldAutoOpenAdvanced("government", { headOfState: "Emperor" })).toBe(false);
    expect(shouldAutoOpenAdvanced("identity", { countryName: "Eldoria" })).toBe(false);
  });

  it("treats a value equal to its default as untouched", () => {
    expect(
      shouldAutoOpenAdvanced(
        "identity",
        { largestCity: "Solace" },
        { defaults: { largestCity: "Solace" } }
      )
    ).toBe(false);
    expect(
      shouldAutoOpenAdvanced(
        "identity",
        { largestCity: "Port Vey" },
        { defaults: { largestCity: "Solace" } }
      )
    ).toBe(true);
    expect(
      shouldAutoOpenAdvanced(
        "economics",
        { paidVacationDays: 15, parentalLeaveWeeks: 12 },
        { defaults: { paidVacationDays: 15, parentalLeaveWeeks: 12 } }
      )
    ).toBe(false);
    expect(
      shouldAutoOpenAdvanced(
        "economics",
        { paidVacationDays: 15, parentalLeaveWeeks: 20 },
        { defaults: { paidVacationDays: 15, parentalLeaveWeeks: 12 } }
      )
    ).toBe(true);
  });

  it("counts a number as filled when there is no default, even zero", () => {
    expect(shouldAutoOpenAdvanced("economics", { netMigrationRate: 0 })).toBe(true);
    expect(
      shouldAutoOpenAdvanced(
        "economics",
        { netMigrationRate: 0 },
        { defaults: { netMigrationRate: 0 } }
      )
    ).toBe(false);
  });

  it("opens when an advanced field has a validation error, even if empty", () => {
    expect(
      shouldAutoOpenAdvanced(
        "government",
        { legislatureName: "", judicialName: "" },
        { errorFields: ["judicialName"] }
      )
    ).toBe(true);
  });

  it("ignores errors on fields outside the disclosure or outside the advanced tier", () => {
    expect(
      shouldAutoOpenAdvanced(
        "government",
        { legislatureName: "" },
        { errorFields: ["headOfState", "judicialName"] }
      )
    ).toBe(false);
    expect(
      shouldAutoOpenAdvanced("government", { headOfState: "" }, { errorFields: ["headOfState"] })
    ).toBe(false);
  });
});
