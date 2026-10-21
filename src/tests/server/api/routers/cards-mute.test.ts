/** @jest-environment node */
/** cards mute procedures: the signed-in player mutes notices about one card. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cards/card-notify", () => ({ isCardMuted: jest.fn(), setCardMute: jest.fn() }));

import { Prisma } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { isCardMuted, setCardMute } from "~/lib/cards/card-notify";
import { cardsMuteRouter } from "~/server/api/routers/cards/mute";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(cardsMuteRouter);
const signedIn = (db = createMockPrisma()) =>
  createCaller(
    createMockRouterContext({
      db,
      user: { id: "u1", clerkUserId: "user_1" },
      rateLimitIdentifier: `me_${Math.random()}`,
    }) as never
  );

beforeEach(() => jest.clearAllMocks());

describe("cards mute procedures", () => {
  it("reads and writes the signed-in player's mute", async () => {
    jest.mocked(isCardMuted).mockResolvedValue(true);
    jest.mocked(setCardMute).mockResolvedValue(undefined);
    const db = createMockPrisma();
    const caller = signedIn(db);
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
    await expect(signedIn().setCardMute({ cardId: "", muted: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(setCardMute).not.toHaveBeenCalled();
  });

  it("answers an unknown card as not found, and leaves other failures alone", async () => {
    jest
      .mocked(setCardMute)
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("fk", { code: "P2003", clientVersion: "test" })
      )
      .mockRejectedValueOnce(new Error("connection reset"));
    await expect(signedIn().setCardMute({ cardId: "gone", muted: true })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No such card",
    });
    await expect(signedIn().setCardMute({ cardId: "card_1", muted: true })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
