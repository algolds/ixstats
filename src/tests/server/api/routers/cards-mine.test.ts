/** @jest-environment node */
/** cards.listMine: the caller's own copies only. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cards/hub/mine", () => {
  const actual = jest.requireActual<typeof import("~/lib/cards/hub/mine")>("~/lib/cards/hub/mine");
  return {
    ...actual,
    listMine: jest.fn(async () => ({
      rows: [],
      total: 0,
      nextCursor: null,
      realms: [],
      totalCopies: 0,
    })),
  };
});

import { createCallerFactory } from "~/server/api/trpc";
import { cardsMineRouter } from "~/server/api/routers/cards/mine";
import { listMine } from "~/lib/cards/hub/mine";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(cardsMineRouter);

describe("cards.listMine", () => {
  beforeEach(() => jest.mocked(listMine).mockClear());

  it("lists the caller's copies with the parsed query", async () => {
    const db = createMockPrisma();
    const caller = createCaller(
      createMockRouterContext({
        db,
        auth: { userId: "clerk_me" },
        user: { id: "db_me", clerkUserId: "clerk_me" },
      }) as never
    );
    await expect(caller.listMine({ rarities: ["RARE"], sort: "value" })).resolves.toEqual({
      rows: [],
      total: 0,
      nextCursor: null,
      realms: [],
      totalCopies: 0,
    });
    expect(listMine).toHaveBeenCalledWith(
      db,
      "db_me",
      expect.objectContaining({ rarities: ["RARE"], sort: "value", limit: 60 })
    );
  });

  it("refuses a signed-out caller and an unknown sort", async () => {
    const signedOut = createCaller(createMockRouterContext({ auth: null, user: null }) as never);
    // The auth middleware throws the app's UnauthorizedError; a server caller wraps it as the cause.
    await expect(signedOut.listMine({})).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
    const caller = createCaller(createMockRouterContext({ db: createMockPrisma() }) as never);
    await expect(caller.listMine({ sort: "price" as never })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(listMine).not.toHaveBeenCalled();
  });
});
