import { withoutSavedSections } from "~/app/builder/hooks/useBuilderPersistence";

jest.mock("~/trpc/react", () => ({ api: {} }));

const payload = (motto: string) =>
  ({
    id: "c_1",
    name: "Caphiria",
    economicInputs: { nationalIdentity: { motto } },
    governmentStructure: { departments: [{ name: "Defence" }] },
    taxSystemData: { taxSystem: { taxSystemName: "Imperial" } },
  }) as never;

describe("withoutSavedSections", () => {
  it("leaves out the government and tax the server already has", () => {
    const sent = withoutSavedSections(payload("Ad astra"), payload("Ex unitate"));

    expect(sent).toEqual({
      id: "c_1",
      name: "Caphiria",
      economicInputs: { nationalIdentity: { motto: "Ad astra" } },
    });
  });

  it("sends a section that changed, and everything before the first save", () => {
    const changed = {
      ...(payload("Ad astra") as object),
      governmentStructure: { departments: [] },
    } as never;

    expect(withoutSavedSections(changed, payload("Ad astra"))).toHaveProperty(
      "governmentStructure"
    );
    expect(withoutSavedSections(payload("Ad astra"), null)).toHaveProperty("taxSystemData");
  });
});
