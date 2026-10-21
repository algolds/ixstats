/** @jest-environment node */
/** cards.requestTakedown: a signed-in player asks for a card that is not from NationStates to come down. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/cards/cards.compliance", () => ({ requestTakedown: jest.fn() }));

import { createCallerFactory } from "~/server/api/trpc";
import { requestTakedown } from "~/server/modules/cards/cards.compliance";
import { cardsTakedownsRouter } from "~/server/api/routers/cards/takedowns";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(cardsTakedownsRouter);
const signedIn = (db = createMockPrisma()) =>
  createCaller(
    createMockRouterContext({
      db,
      user: { id: "u1", clerkUserId: "user_1" },
      rateLimitIdentifier: `me_${Math.random()}`,
    }) as never
  );
const REASON = "It shows my house without asking";

beforeEach(() => jest.clearAllMocks());

describe("cards.requestTakedown", () => {
  it("files the request as the signed-in player, with the reason and contact trimmed", async () => {
    jest.mocked(requestTakedown).mockResolvedValue({ status: "filed" });
    const db = createMockPrisma();

    await expect(
      signedIn(db).requestTakedown({
        cardId: "card_1",
        reason: `  ${REASON}  `,
        contact: " me@example.org ",
      })
    ).resolves.toEqual({ status: "filed" });
    expect(requestTakedown).toHaveBeenCalledWith(db, {
      cardId: "card_1",
      reason: REASON,
      contact: "me@example.org",
      requesterId: "u1",
    });
  });

  it("refuses a signed-out caller", async () => {
    const signedOut = createCaller(createMockRouterContext({ auth: null, user: null }) as never);
    // The auth middleware throws the app's UnauthorizedError; a server caller wraps it as the cause.
    await expect(
      signedOut.requestTakedown({ cardId: "card_1", reason: REASON })
    ).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
    expect(requestTakedown).not.toHaveBeenCalled();
  });

  it.each([
    ["no card", { cardId: "", reason: REASON }],
    ["a card id past 64 characters", { cardId: "c".repeat(65), reason: REASON }],
    ["a reason under 10 characters once trimmed", { cardId: "card_1", reason: "  too short " }],
    ["a reason past 1,000 characters", { cardId: "card_1", reason: "r".repeat(1001) }],
    [
      "a contact past 200 characters",
      { cardId: "card_1", reason: REASON, contact: "c".repeat(201) },
    ],
  ])("refuses %s", async (_, input) => {
    await expect(signedIn().requestTakedown(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(requestTakedown).not.toHaveBeenCalled();
  });

  it("takes a reason of 10 and of 1,000 characters, and a contact of 200", async () => {
    jest.mocked(requestTakedown).mockResolvedValue({ status: "already" });
    await expect(
      signedIn().requestTakedown({ cardId: "card_1", reason: "r".repeat(10) })
    ).resolves.toEqual({ status: "already" });
    await signedIn().requestTakedown({
      cardId: "card_1",
      reason: "r".repeat(1000),
      contact: "c".repeat(200),
    });
    expect(requestTakedown).toHaveBeenCalledTimes(2);
  });
});
