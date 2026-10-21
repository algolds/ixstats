/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/thinkpages-forum", () => {
  const actual = jest.requireActual("~/server/modules/thinkpages-forum");
  return {
    ...actual,
    // The caller as the module's actor, without the moderator lookups (they are not under test here).
    forumActorOf: jest.fn(
      async (
        _db: object,
        user: { id: string; clerkUserId: string; countryId?: string | null; role?: object }
      ) => ({
        id: user.id,
        clerkUserId: user.clerkUserId,
        countryId: user.countryId ?? null,
        role: user.role,
      })
    ),
    createAdvert: jest.fn(),
    advertRealmsOf: jest.fn(),
    advertStatus: jest.fn(),
    setAdvertLocked: jest.fn(),
    afterThreadStarted: jest.fn(async () => undefined),
  };
});

import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { mapError } from "~/server/api/routers/thinkpagesForum/viewer";
import { afterThreadStarted, createAdvert, ForumError } from "~/server/modules/thinkpages-forum";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const member = {
  id: "u1",
  clerkUserId: "clerk_1",
  countryId: "c1",
  email: "x@y.z",
  role: { name: "user", level: 100 },
};
const caller = (user: object | null) =>
  createCallerFactory(thinkpagesForumRouter)(
    createMockRouterContext({
      auth: user ? { userId: "clerk_1" } : null,
      user: user as never,
      db: {},
    }) as never
  );
const created = { threadId: "t_new", postId: "p_new", formatting: "done" as const };
const NEW = { realm: "eurth", title: "Join Eurth", wikitext: "Come and play." };

/** The error a promise rejects with, typed as a TRPCError. */
async function rejection(call: Promise<unknown>): Promise<TRPCError> {
  const caught = await call.then(
    () => null,
    (error: Error) => error
  );
  if (!(caught instanceof TRPCError)) throw new Error("expected a TRPCError");
  return caught;
}

beforeEach(() => {
  for (const level of ["log", "info", "warn"] as const)
    jest.spyOn(console, level).mockImplementation(() => undefined);
  jest.clearAllMocks();
  jest.mocked(createAdvert).mockResolvedValue(created);
  jest.mocked(afterThreadStarted).mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("thinkpagesForum.createAdvert", () => {
  it("never fails or waits on a hook that fails", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(afterThreadStarted).mockRejectedValue(new Error("notice outage"));
    await expect(caller(member).createAdvert(NEW)).resolves.toEqual(created);
    await new Promise((resolve) => setImmediate(resolve));
    expect(logged).toHaveBeenCalledWith(
      "[thinkpages-forum] Write hook failed:",
      expect.objectContaining({ message: "notice outage" })
    );
    logged.mockRestore();
  });

  it("maps the module's CONFLICT to a TRPCError that names the existing thread", async () => {
    jest.mocked(createAdvert).mockRejectedValue(
      new ForumError("CONFLICT", "This realm already has an advert.", undefined, {
        threadId: "t_old",
      })
    );
    const error = await rejection(caller(member).createAdvert(NEW));
    expect(error.code).toBe("CONFLICT");
    expect(error.cause).toMatchObject({ context: { threadId: "t_old" } });
    expect(afterThreadStarted).not.toHaveBeenCalled();
  });

  it("bounds the title and needs a signed-in caller", async () => {
    await expect(caller(member).createAdvert({ ...NEW, title: "ab" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller(member).createAdvert({ ...NEW, title: "x".repeat(201) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller(null).createAdvert(NEW)).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    expect(createAdvert).not.toHaveBeenCalled();
  });
});
describe("mapError", () => {
  const thrown = (error: Error): TRPCError => {
    try {
      mapError(error);
    } catch (caught) {
      if (caught instanceof TRPCError) return caught;
    }
    throw new Error("mapError did not throw a TRPCError");
  };

  it("publishes a ForumError's context", () => {
    const out = thrown(new ForumError("CONFLICT", "x", undefined, { threadId: "t1" }));
    expect(out.code).toBe("CONFLICT");
    expect(out.cause).toMatchObject({ context: { threadId: "t1" } });
  });

  it("still publishes a rate-limit wait, and gives a plain refusal no cause", () => {
    const limited = thrown(new ForumError("TOO_MANY_REQUESTS", "slow", 12));
    expect(limited.code).toBe("TOO_MANY_REQUESTS");
    expect(limited.cause).toMatchObject({ context: { retryAfterSeconds: 12 } });
    expect(thrown(new ForumError("FORBIDDEN", "no")).cause).toBeUndefined();
  });

  it("rethrows anything else", () => {
    const plain = new Error("boom");
    expect(() => mapError(plain)).toThrow(plain);
  });
});
