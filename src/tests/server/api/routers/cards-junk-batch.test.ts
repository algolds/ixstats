/** @jest-environment node */
/** VT-9: cards.junkCards honours the admin junk batch limit. */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsInventoryRouter } from "~/server/api/routers/cards/inventory";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(cardsInventoryRouter);

describe("cards.junkCards batch limit", () => {
  it("refuses a batch larger than the configured limit before touching any card", async () => {
    const db = createMockPrisma();
    db.systemConfig.findMany.mockResolvedValue([
      { key: "card_system_max_junk_batch_size", value: "3" },
    ]);
    const caller = createCaller(createMockRouterContext({ db }) as never);
    jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(caller.junkCards({ ownershipIds: ["a", "b", "c", "d"] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });
});
