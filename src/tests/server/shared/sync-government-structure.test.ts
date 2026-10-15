import {
  syncGovernmentComponents,
  syncGovernmentStructure,
} from "~/server/shared/country-mutation-helpers";

function makeTx(existingDepartments: { id: string; name: string }[] = []) {
  let created = 0;
  return {
    governmentStructure: {
      upsert: jest.fn().mockResolvedValue({ id: "gs_1" }),
      update: jest.fn(),
    },
    governmentDepartment: {
      findMany: jest.fn().mockResolvedValue(existingDepartments),
      create: jest.fn().mockImplementation(async () => ({ id: `new_${++created}` })),
      update: jest.fn().mockImplementation(async ({ where }) => ({ id: where.id })),
      deleteMany: jest.fn(),
    },
    budgetAllocation: { upsert: jest.fn() },
    revenueSource: { deleteMany: jest.fn(), createMany: jest.fn() },
    governmentComponent: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    componentSynergy: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
}

const dept = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  category: "Other",
  ...extra,
});

describe("syncGovernmentStructure", () => {
  it("saves the editor's nested structure fields instead of the defaults", async () => {
    const tx = makeTx();
    await syncGovernmentStructure(tx as never, "c_1", "Caphiria", {
      structure: {
        governmentName: "Imperial Government of Caphiria",
        governmentType: "Imperial Republic",
        headOfState: "Imperator",
        headOfGovernment: "Chancellor",
        legislatureName: "Senate",
        totalBudget: 500,
      },
    });

    const data = tx.governmentStructure.upsert.mock.calls[0][0].update;
    expect(data).toMatchObject({
      governmentName: "Imperial Government of Caphiria",
      governmentType: "Imperial Republic",
      headOfState: "Imperator",
      headOfGovernment: "Chancellor",
      legislatureName: "Senate",
      totalBudget: 500,
    });
  });

  it("still reads the flat shape, and falls back to defaults when names are blank", async () => {
    const tx = makeTx();
    await syncGovernmentStructure(tx as never, "c_1", "Caphiria", {
      governmentName: "",
      headOfState: "King",
    });

    const data = tx.governmentStructure.upsert.mock.calls[0][0].update;
    expect(data).toMatchObject({
      governmentName: "Government of Caphiria",
      governmentType: "Federal Republic",
      headOfState: "King",
    });
  });
});

describe("syncGovernmentStructure departments", () => {
  it("updates saved departments in place instead of deleting them all", async () => {
    const tx = makeTx([
      { id: "d_def", name: "Defence" },
      { id: "d_fin", name: "Finance" },
      { id: "d_old", name: "Agriculture" },
    ]);
    await syncGovernmentStructure(tx as never, "c_1", "Caphiria", {
      departments: [dept("Ministry of Defence", { id: "d_def" }), dept("Finance"), dept("Culture")],
    });

    const updatedIds = tx.governmentDepartment.update.mock.calls.map(([arg]) => arg.where.id);
    expect(updatedIds).toEqual(expect.arrayContaining(["d_def", "d_fin"]));
    expect(tx.governmentDepartment.create).toHaveBeenCalledTimes(1);
    // Only the department the input dropped goes; the cabinet of the others stays.
    expect(tx.governmentDepartment.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.governmentDepartment.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["d_old"] } },
    });
  });

  it("resolves the builder's index-keyed allocations and parent links to real ids", async () => {
    const tx = makeTx([{ id: "d_def", name: "Defence" }]);
    await syncGovernmentStructure(tx as never, "c_1", "Caphiria", {
      departments: [dept("Defence", { id: "d_def" }), dept("Army", { parentDepartmentId: "0" })],
      budgetAllocations: [
        { departmentId: "0", budgetYear: 2026, allocatedAmount: 100, allocatedPercent: 60 },
        { departmentId: "1", budgetYear: 2026, allocatedAmount: 50, allocatedPercent: 40 },
      ],
    });

    const upserts = tx.budgetAllocation.upsert.mock.calls.map(([arg]) => arg.where);
    expect(upserts).toEqual([
      { departmentId_budgetYear: { departmentId: "d_def", budgetYear: 2026 } },
      { departmentId_budgetYear: { departmentId: "new_1", budgetYear: 2026 } },
    ]);
    expect(tx.governmentDepartment.update).toHaveBeenCalledWith({
      where: { id: "new_1" },
      data: { parentDepartmentId: "d_def" },
    });
  });

  it("leaves departments alone when the input has none", async () => {
    const tx = makeTx([{ id: "d_def", name: "Defence" }]);
    await syncGovernmentStructure(tx as never, "c_1", "Caphiria", { departments: [] });

    expect(tx.governmentDepartment.findMany).not.toHaveBeenCalled();
    expect(tx.governmentDepartment.deleteMany).not.toHaveBeenCalled();
  });

  it("replaces only the active revenue sources", async () => {
    const tx = makeTx();
    await syncGovernmentStructure(tx as never, "c_1", "Caphiria", { revenueSources: [] });

    expect(tx.revenueSource.deleteMany).toHaveBeenCalledWith({
      where: { governmentStructureId: "gs_1", isActive: true },
    });
  });
});

describe("syncGovernmentComponents", () => {
  it("keeps the rows of components that stay, so their effectiveness survives", async () => {
    const tx = makeTx();
    const kept = { id: "gc_1", componentType: "RULE_OF_LAW", effectivenessScore: 82 };
    const dropped = {
      id: "gc_2",
      componentType: "MILITARY_ADMINISTRATION",
      effectivenessScore: 40,
    };
    tx.governmentComponent.findMany.mockResolvedValue([kept, dropped]);
    tx.governmentComponent.create.mockImplementation(async ({ data }) => ({
      id: "gc_3",
      ...data,
    }));

    await syncGovernmentComponents(tx as never, "c_1", [
      { componentType: "RULE_OF_LAW" },
      { componentType: "DEMOCRATIC_PROCESS" },
    ]);

    expect(tx.governmentComponent.create).toHaveBeenCalledTimes(1);
    expect(tx.governmentComponent.create.mock.calls[0][0].data.componentType).toBe(
      "DEMOCRATIC_PROCESS"
    );
    expect(tx.governmentComponent.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["gc_2"] } },
    });
  });
});
