import { diplomaticCulturalNpcResponsesRouter } from "../../../../server/api/routers/diplomacy/cultural/npc/responses";
import { createCallerFactory } from "../../../../server/api/trpc";
import { createMockRouterContext } from "../../../helpers/router-context";

describe("Plan 159: Diplomacy NPC Responses Query Batching", () => {
  const createCaller = createCallerFactory(diplomaticCulturalNpcResponsesRouter);

  it("batches diplomaticRelation and embassy queries into 1 call each for all participants", async () => {
    const relationFindManyMock = jest.fn().mockResolvedValue([
      { country1: "p-country-1", country2: "host-country", relationship: "alliance", strength: 90 },
      { country1: "p-country-2", country2: "host-country", relationship: "friendly", strength: 75 },
    ]);
    const embassyFindManyMock = jest.fn().mockResolvedValue([
      { guestCountryId: "p-country-1", hostCountryId: "other", specialization: "cultural", level: 3, influence: 80 },
    ]);

    const mockDb = {
      culturalExchange: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ex-1",
          type: "cultural_festival",
          title: "Great Exhibition",
          description: "A grand festival",
          hostCountryName: "Hostland",
          startDate: new Date("2026-06-01"),
          endDate: new Date("2026-06-10"),
          participatingCountries: [
            { countryId: "host-country", countryName: "Hostland", role: "host" },
            { countryId: "p-country-1", countryName: "Participant 1", role: "partner" },
            { countryId: "p-country-2", countryName: "Participant 2", role: "partner" },
          ],
        }),
      },
      diplomaticRelation: {
        findMany: relationFindManyMock,
      },
      embassy: {
        findMany: embassyFindManyMock,
      },
    };

    const ctx = createMockRouterContext({
      db: mockDb,
      auth: null,
    });
    const caller = createCaller(ctx as any);

    const responses = await (caller as any).getNPCCulturalResponses({
      exchangeId: "ex-1",
      hostCountryId: "host-country",
    });

    // Assert query batching: host excluded, exactly 1 batch query per relation & embassy table
    expect(relationFindManyMock).toHaveBeenCalledTimes(1);
    expect(embassyFindManyMock).toHaveBeenCalledTimes(1);

    // Assert 2 participant responses returned (excluding host)
    expect(responses).toHaveLength(2);
    expect(responses[0].countryId).toBe("p-country-1");
    expect(responses[1].countryId).toBe("p-country-2");
  });
});
