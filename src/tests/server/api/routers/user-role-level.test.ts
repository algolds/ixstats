/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
//
// users.getUserWithRole is public and answers for any Clerk id: ThinkPages staff moderation compares a post
// author's role level with their own (useThinkpagesPost). It returns that level only, never the user row, so no
// name (wiki, Discord, forum) or id reaches the caller, whatever the author's privacy switches.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { usersProfileRouter } from "~/server/api/routers/users/profile";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const AUTHOR = "clerk_author";

function makeDb(author: { role: { level: number } | null } | null) {
  const db = createMockPrisma();
  db.user.findUnique.mockResolvedValue(
    author && {
      id: "db_author",
      clerkUserId: AUTHOR,
      wikiUsername: "Wiki Author",
      discordUsername: "authortag",
      ...author,
    }
  );
  return db;
}

async function lookUp(db: ReturnType<typeof makeDb>, viewer: string | null) {
  const ctx = createMockRouterContext({
    db,
    auth: viewer ? { userId: viewer } : null,
    user: viewer ? { id: `db_${viewer}`, clerkUserId: viewer } : null,
  });
  return createCallerFactory(usersProfileRouter)(ctx as never).getUserWithRole({
    clerkUserId: AUTHOR,
  });
}

describe("users.getUserWithRole returns the role level only", () => {
  it.each([
    ["another player", "clerk_viewer"],
    ["a signed-out visitor", null],
    ["the user themself", AUTHOR],
  ])("gives %s the level and nothing else", async (_who, viewer) => {
    const db = makeDb({ role: { level: 20 } });
    const result = await lookUp(db, viewer);
    expect(result).toEqual({ roleLevel: 20 });
    expect(JSON.stringify(result)).not.toMatch(/Wiki Author|authortag|db_author/);
  });

  it("selects the role level alone", async () => {
    const db = makeDb({ role: { level: 20 } });
    await lookUp(db, "clerk_viewer");
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: AUTHOR },
      select: { role: { select: { level: true } } },
    });
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });

  it("is null for an unknown user, one without a role, or a read error", async () => {
    expect(await lookUp(makeDb(null), "clerk_viewer")).toEqual({ roleLevel: null });
    expect(await lookUp(makeDb({ role: null }), "clerk_viewer")).toEqual({ roleLevel: null });
    const failing = makeDb(null);
    failing.user.findUnique.mockRejectedValue(new Error("db down"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await lookUp(failing, "clerk_viewer")).toEqual({ roleLevel: null });
    error.mockRestore();
  });
});
