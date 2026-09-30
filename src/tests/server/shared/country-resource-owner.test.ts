import {
  resolveDepartmentCountryId,
  resolveMeetingCountryId,
  resolveOfficialCountryId,
  resolveStructureCountryId,
  resolveTransportRouteCountryId,
} from "~/server/shared/country-resource-owner";

/** A db whose every delegate's findUnique resolves to `row`. */
function dbReturning(row: object | null) {
  const findUnique = jest.fn().mockResolvedValue(row);
  const db = {
    cabinetMeeting: { findUnique },
    governmentStructure: { findUnique },
    governmentDepartment: { findUnique },
    governmentOfficial: { findUnique },
  };
  return { db, findUnique };
}

describe("Plan 332: country resource owner resolvers", () => {
  it("resolveMeetingCountryId reads CabinetMeeting.countryId", async () => {
    const { db, findUnique } = dbReturning({ countryId: "c1" });
    await expect(resolveMeetingCountryId(db, "m1")).resolves.toBe("c1");
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "m1" },
      select: { countryId: true },
    });
    await expect(resolveMeetingCountryId(dbReturning(null).db, "m1")).resolves.toBeNull();
  });

  it("resolveStructureCountryId reads GovernmentStructure.countryId", async () => {
    const { db, findUnique } = dbReturning({ countryId: "c1" });
    await expect(resolveStructureCountryId(db, "s1")).resolves.toBe("c1");
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "s1" },
      select: { countryId: true },
    });
    await expect(resolveStructureCountryId(dbReturning(null).db, "s1")).resolves.toBeNull();
  });

  it("resolveDepartmentCountryId goes through the department's structure", async () => {
    const { db } = dbReturning({ governmentStructure: { countryId: "c1" } });
    await expect(resolveDepartmentCountryId(db, "d1")).resolves.toBe("c1");
    await expect(resolveDepartmentCountryId(dbReturning(null).db, "d1")).resolves.toBeNull();
  });

  describe("resolveOfficialCountryId", () => {
    it("uses the official's structure first", async () => {
      const { db } = dbReturning({
        governmentStructure: { countryId: "c_structure" },
        department: { governmentStructure: { countryId: "c_department" } },
      });
      await expect(resolveOfficialCountryId(db, "o1")).resolves.toBe("c_structure");
    });

    it("falls back to the department's structure", async () => {
      const { db } = dbReturning({
        governmentStructure: null,
        department: { governmentStructure: { countryId: "c_department" } },
      });
      await expect(resolveOfficialCountryId(db, "o1")).resolves.toBe("c_department");
    });

    it("returns null for an orphaned or missing official", async () => {
      const orphan = dbReturning({ governmentStructure: null, department: null });
      await expect(resolveOfficialCountryId(orphan.db, "o1")).resolves.toBeNull();
      await expect(resolveOfficialCountryId(dbReturning(null).db, "o1")).resolves.toBeNull();
    });
  });

  it("resolveTransportRouteCountryId only matches a route in the named country", async () => {
    const findFirst = jest.fn().mockResolvedValue({ countryId: "c1" });
    await expect(
      resolveTransportRouteCountryId({ transportRoute: { findFirst } }, "r1", "c1")
    ).resolves.toBe("c1");
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "r1", countryId: "c1" },
      select: { countryId: true },
    });
    const missing = { transportRoute: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(resolveTransportRouteCountryId(missing, "r1", "c2")).resolves.toBeNull();
  });
});
