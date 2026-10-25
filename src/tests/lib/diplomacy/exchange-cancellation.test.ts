/** @jest-environment node */
/**
 * WP-DE leftover: cancelling a cultural exchange applies the reputation penalty it reports (the host's embassies in
 * each participant's country lose it, never below 0), lowers each relation and stores its band, and notifies each
 * participant through the notifications module instead of a console line.
 */
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn(async () => ({})) },
}));

import { notificationAPI } from "~/lib/notifications/api";
import { applyExchangeCancellation } from "~/lib/diplomacy/exchange-cancellation";

function makeDb() {
  return {
    country: { findUnique: jest.fn(async () => ({ name: "Hostland" })) },
    diplomaticRelation: {
      findFirst: jest.fn(async () => ({ id: "rel1", strength: 60, culturalExchange: "High" })),
      update: jest.fn(async () => ({})),
    },
    embassy: {
      findMany: jest.fn(async () => [
        { id: "e1", reputation: 50 },
        { id: "e2", reputation: 5 },
      ]),
      update: jest.fn(async () => ({})),
    },
  };
}

it("applies the reputation and relation penalties and notifies the participant", async () => {
  const db = makeDb();
  const penalties = await applyExchangeCancellation(db as never, {
    id: "x1",
    title: "Harbour Festival",
    hostCountryId: "host",
    participatingCountries: [{ countryId: "guest" }],
  });

  expect(penalties).toEqual({ reputationLoss: -15, relationshipPenalty: 8, affectedCountries: 1 });
  expect(db.embassy.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { guestCountryId: "host", hostCountryId: "guest" } })
  );
  expect(db.embassy.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { reputation: 35 } });
  expect(db.embassy.update).toHaveBeenCalledWith({ where: { id: "e2" }, data: { reputation: 0 } });
  expect(db.diplomaticRelation.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "rel1" },
      data: expect.objectContaining({ strength: 52, culturalExchange: "Medium" }),
    })
  );
  expect(notificationAPI.create).toHaveBeenCalledWith(
    expect.objectContaining({
      countryId: "guest",
      category: "diplomatic",
      message: "Hostland cancelled Harbour Festival",
    })
  );
});
