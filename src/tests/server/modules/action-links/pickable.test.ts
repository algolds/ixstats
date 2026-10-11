/** @jest-environment node */
import { pickableActivityWhere } from "~/server/modules/action-links";

describe("pickableActivityWhere", () => {
  it("is the country's public rows without the denylisted titles", () => {
    expect(pickableActivityWhere("c1")).toMatchObject({
      countryId: "c1",
      visibility: "public",
      title: {
        notIn: [
          "Names Generated in Onoma Lab",
          "Naming Dictionary Shared",
          "New Nation Founded",
          "Leadership Established",
        ],
      },
    });
  });

  it("leaves out each denylisted event type with a clause that keeps rows without metadata", () => {
    expect(pickableActivityWhere("c1").AND).toEqual([
      {
        OR: [
          { metadata: null },
          { NOT: { metadata: { contains: '"eventType":"economic_tier_change"' } } },
        ],
      },
      {
        OR: [
          { metadata: null },
          { NOT: { metadata: { contains: '"eventType":"achievement_unlocked"' } } },
        ],
      },
    ]);
  });
});
