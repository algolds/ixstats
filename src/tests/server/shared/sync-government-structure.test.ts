import { syncGovernmentStructure } from "~/server/shared/country-mutation-helpers";

function makeTx() {
  return {
    governmentStructure: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: "gs_1" }),
    },
    governmentDepartment: { deleteMany: jest.fn() },
  };
}

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
