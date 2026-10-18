/** @jest-environment node */
/** cards mute procedures: the signed-in player mutes notices about one card. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cards/card-notify", () => ({ isCardMuted: jest.fn(), setCardMute: jest.fn() }));

import { createCallerFactory } from "~/server/api/trpc";
import { isCardMuted, setCardMute } from "~/lib/cards/card-notify";
import { cardsMuteRouter } from "~/server/api/routers/cards/mute";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(cardsMuteRouter);

beforeEach(() => jest.clearAllMocks());

describe("cards mute procedures", () => {
  it("reads and writes the signed-in player's mute", async () => {
    jest.mocked(isCardMuted).mockResolvedValue(true);
    jest.mocked(setCardMute).mockResolvedValue(undefined);
    const db = createMockPrisma();
    const caller = createCaller(
      createMockRouterContext({
        db,
        user: { id: "u1", clerkUserId: "user_1" },
        rateLimitIdentifier: `me_${Math.random()}`,
      }) as never
    );
    expect(await caller.getCardMute({ cardId: "card_1" })).toBe(true);
    expect(isCardMuted).toHaveBeenCalledWith(db, "u1", "card_1");
    expect(await caller.setCardMute({ cardId: "card_1", muted: false })).toEqual({ muted: false });
    expect(setCardMute).toHaveBeenCalledWith(db, "u1", "card_1", false);
  });

  it("refuses a signed-out caller and a missing card", async () => {
    const signedOut = createCaller(createMockRouterContext({ auth: null, user: null }) as never);
    // The auth middleware throws the app's UnauthorizedError; a server caller wraps it as the cause.
    await expect(signedOut.getCardMute({ cardId: "card_1" })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    await expect(signedOut.setCardMute({ cardId: "card_1", muted: true })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    const caller = createCaller(
      createMockRouterContext({
        db: createMockPrisma(),
        user: { id: "u1", clerkUserId: "user_1" },
        rateLimitIdentifier: `me_${Math.random()}`,
      }) as never
    );
    await expect(caller.setCardMute({ cardId: "", muted: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(setCardMute).not.toHaveBeenCalled();
  });
});
