/** @jest-environment node */
/**
 * cards.inscribe and cards.reportInscription: signed-in, rate-limited per procedure and bounded. The signer's name to
 * freeze comes from the one naming rule, which the router reads (card modules may not read identity).
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: jest.fn() },
}));
jest.mock("~/server/modules/identity/identity.player-names", () => ({
  loadPlayerNames: jest.fn(),
}));
jest.mock("~/server/modules/cards/inscriptions", () => ({
  inscribeCopy: jest.fn(),
  reportInscription: jest.fn(),
}));

import { rateLimiter } from "~/lib/cache";
import { createCallerFactory } from "~/server/api/trpc";
import { cardsInscriptionsRouter } from "~/server/api/routers/cards/inscriptions";
import { inscribeCopy, reportInscription } from "~/server/modules/cards/inscriptions";
import { loadPlayerNames } from "~/server/modules/identity/identity.player-names";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(cardsInscriptionsRouter);
const check = jest.mocked(rateLimiter.check);
const signedIn = (db = createMockPrisma()) =>
  createCaller(
    createMockRouterContext({
      db,
      user: { id: "u1", clerkUserId: "user_1" },
      rateLimitIdentifier: "user_1",
    }) as never
  );
const signedOut = () => createCaller(createMockRouterContext({ auth: null, user: null }) as never);

beforeEach(() => {
  jest.clearAllMocks();
  check.mockResolvedValue({ success: true, remaining: 59, resetAt: new Date() });
  jest.mocked(inscribeCopy).mockResolvedValue({ inscription: "gg", name: "@ixnay" });
  jest.mocked(reportInscription).mockResolvedValue({ reportId: "r1" });
  jest
    .mocked(loadPlayerNames)
    .mockResolvedValue(new Map([["u1", { handle: "ixnay", displayName: "@ixnay" }]]));
});

describe("cards.inscribe", () => {
  it("signs as the signed-in player, freezing the name other players read", async () => {
    const db = createMockPrisma();
    await expect(signedIn(db).inscribe({ ownershipId: "own_1", text: " gg " })).resolves.toEqual({
      inscription: "gg",
      name: "@ixnay",
    });
    expect(loadPlayerNames).toHaveBeenCalledWith(["u1"]);
    expect(inscribeCopy).toHaveBeenCalledWith(db, {
      userId: "u1",
      ownershipId: "own_1",
      text: " gg ",
      now: expect.any(Date),
      signerName: "@ixnay",
    });
  });

  it("passes no name for a player other players cannot name, nor their passport handle", async () => {
    jest
      .mocked(loadPlayerNames)
      .mockResolvedValue(new Map([["u1", { handle: "user_1", displayName: null }]]));
    await signedIn().inscribe({ ownershipId: "own_1", text: "gg" });
    expect(jest.mocked(inscribeCopy).mock.calls[0]![1]).toMatchObject({ signerName: null });

    jest.mocked(loadPlayerNames).mockResolvedValue(new Map());
    await signedIn().inscribe({ ownershipId: "own_1", text: "gg" });
    expect(jest.mocked(inscribeCopy).mock.calls[1]![1]).toMatchObject({ signerName: null });
  });

  it("is rate-limited on its own bucket, and refuses past the limit before reading anything", async () => {
    await signedIn().inscribe({ ownershipId: "own_1", text: "gg" });
    expect(check).toHaveBeenCalledWith("user_1", "mutation:inscribe", {
      maxRequests: 60,
      windowMs: 60_000,
    });
    check.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });
    await expect(signedIn().inscribe({ ownershipId: "own_1", text: "gg" })).rejects.toThrow(
      /Too many requests/
    );
    expect(loadPlayerNames).toHaveBeenCalledTimes(1);
    expect(inscribeCopy).toHaveBeenCalledTimes(1);
  });

  it("refuses a signed-out caller", async () => {
    await expect(signedOut().inscribe({ ownershipId: "own_1", text: "gg" })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    expect(inscribeCopy).not.toHaveBeenCalled();
  });

  it.each([
    ["no copy", { ownershipId: "", text: "gg" }],
    ["a copy id past 64 characters", { ownershipId: "o".repeat(65), text: "gg" }],
    ["text past 240 characters", { ownershipId: "own_1", text: "t".repeat(241) }],
  ])("refuses %s", async (_, input) => {
    await expect(signedIn().inscribe(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(loadPlayerNames).not.toHaveBeenCalled();
    expect(inscribeCopy).not.toHaveBeenCalled();
  });

  it("takes raw text up to 240 characters, which the module cleans and holds to 60", async () => {
    await signedIn().inscribe({ ownershipId: "o".repeat(64), text: "t".repeat(240) });
    expect(inscribeCopy).toHaveBeenCalledTimes(1);
  });
});

describe("cards.reportInscription", () => {
  it("files the report as the signed-in player", async () => {
    const db = createMockPrisma();
    await expect(
      signedIn(db).reportInscription({ ownershipId: "own_1", reason: "a slur" })
    ).resolves.toEqual({ reportId: "r1" });
    expect(reportInscription).toHaveBeenCalledWith(db, {
      reporterId: "u1",
      ownershipId: "own_1",
      reason: "a slur",
    });
    expect(check).toHaveBeenCalledWith("user_1", "mutation:reportInscription", {
      maxRequests: 60,
      windowMs: 60_000,
    });
  });

  it("refuses a signed-out caller", async () => {
    await expect(
      signedOut().reportInscription({ ownershipId: "own_1", reason: "a slur" })
    ).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
    expect(reportInscription).not.toHaveBeenCalled();
  });

  it.each([
    ["no copy", { ownershipId: "", reason: "a slur" }],
    ["a copy id past 64 characters", { ownershipId: "o".repeat(65), reason: "a slur" }],
    ["a reason past 1,000 characters", { ownershipId: "own_1", reason: "r".repeat(1001) }],
  ])("refuses %s", async (_, input) => {
    await expect(signedIn().reportInscription(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(reportInscription).not.toHaveBeenCalled();
  });

  it("takes a reason of 1,000 characters, which the module holds to 500", async () => {
    await signedIn().reportInscription({ ownershipId: "own_1", reason: "r".repeat(1000) });
    expect(reportInscription).toHaveBeenCalledTimes(1);
  });
});
