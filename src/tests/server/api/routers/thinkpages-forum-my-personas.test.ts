/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const member = {
  id: "u1",
  clerkUserId: "clerk_1",
  countryId: "c1",
  email: "x@y.z",
  role: { name: "user", level: 100 },
};

const p1 = { id: "p1", displayName: "Aria", username: "aria" };
const p2 = { id: "p2", displayName: "Zed", username: "zed" };

/** The member's active personas, and the author persona of their newest post (undefined: no posts yet). */
function db(personas: object[], newest?: { authorPersonaId: string | null }) {
  return {
    thinkpagesAccount: { findMany: jest.fn(async () => personas) },
    forumPost: { findFirst: jest.fn(async () => newest ?? null) },
  };
}

const myPersonas = (fake: object) =>
  createCallerFactory(thinkpagesForumRouter)(
    createMockRouterContext({
      auth: { userId: "clerk_1" },
      user: member as never,
      db: fake,
    }) as never
  ).myPersonas();

describe("thinkpagesForum.myPersonas", () => {
  it("names the persona of the member's newest post as the last used", async () => {
    const out = await myPersonas(db([p1, p2], { authorPersonaId: "p2" }));
    expect(out).toEqual({ personas: [p1, p2], lastUsedPersonaId: "p2" });
  });

  it("looks at the member's own newest post by their user id", async () => {
    const fake = db([p1, p2], { authorPersonaId: "p2" });
    await myPersonas(fake);
    expect(fake.forumPost.findFirst).toHaveBeenCalledWith({
      where: { authorUserId: "u1" },
      orderBy: { createdAt: "desc" },
      select: { authorPersonaId: true },
    });
  });

  it("has no last used persona once it has been deactivated", async () => {
    const out = await myPersonas(db([p1], { authorPersonaId: "p2" }));
    expect(out).toEqual({ personas: [p1], lastUsedPersonaId: null });
  });

  it("has no last used persona when the newest post was as themself", async () => {
    const out = await myPersonas(db([p1, p2], { authorPersonaId: null }));
    expect(out.lastUsedPersonaId).toBeNull();
  });

  it("has no last used persona before any post", async () => {
    const out = await myPersonas(db([p1]));
    expect(out.lastUsedPersonaId).toBeNull();
  });

  it("lists only the caller's active personas by name", async () => {
    const fake = db([p1]);
    await myPersonas(fake);
    expect(fake.thinkpagesAccount.findMany).toHaveBeenCalledWith({
      where: { clerkUserId: "clerk_1", isActive: true, accountType: { not: "personal" } },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, username: true },
    });
  });
});
