/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
//
// users.getUserWithRole is public and answers for any Clerk id (ThinkPages reads a post author's role level with it).
// Another user's wiki name is left out while they hide wiki attribution (`showWikiAttribution`); a switch that cannot
// be read counts as off. A caller asking for themself still gets their own name.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { usersProfileRouter } from "~/server/api/routers/users/profile";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { privacyConfigRow, wikiAttributionOff } from "~/tests/helpers/privacy-config-fake";

const AUTHOR = "clerk_author";

function makeDb() {
  const db = createMockPrisma();
  db.user.findUnique.mockResolvedValue({
    id: "db_author",
    clerkUserId: AUTHOR,
    wikiUsername: "Wiki Author",
    role: { name: "member", level: 100, rolePermissions: [] },
    country: null,
  });
  return db;
}

async function lookUp(db: ReturnType<typeof makeDb>, viewer: string | null) {
  const ctx = createMockRouterContext({
    db,
    auth: viewer ? { userId: viewer } : null,
    user: viewer ? { id: `db_${viewer}`, clerkUserId: viewer } : null,
  });
  const { user } = await createCallerFactory(usersProfileRouter)(ctx as never).getUserWithRole({
    clerkUserId: AUTHOR,
  });
  return user;
}

describe("users.getUserWithRole and wiki attribution", () => {
  it.each([
    ["another player", "clerk_viewer"],
    ["a signed-out visitor", null],
  ])("sends %s no wiki name of a user with the switch off", async (_who, viewer) => {
    const db = makeDb();
    db.userConnection.findMany.mockResolvedValue(wikiAttributionOff(AUTHOR));
    const user = await lookUp(db, viewer);
    expect(user).toMatchObject({ wikiUsername: null, role: { level: 100 } });
    expect(db.userConnection.findMany).toHaveBeenCalledTimes(1);
  });

  it("keeps the wiki name of a user with the switch on", async () => {
    const db = makeDb();
    db.userConnection.findMany.mockResolvedValue([
      privacyConfigRow(AUTHOR, { showWikiAttribution: true }),
    ]);
    expect((await lookUp(db, "clerk_viewer"))?.wikiUsername).toBe("Wiki Author");
  });

  it("fails closed: a switch it cannot read hides the wiki name", async () => {
    const db = makeDb();
    db.userConnection.findMany.mockRejectedValue(new Error("db down"));
    const user = await lookUp(db, "clerk_viewer");
    expect(user).toMatchObject({ wikiUsername: null, role: { level: 100 } });
  });

  it("gives a caller their own wiki name without reading the switch", async () => {
    const db = makeDb();
    db.userConnection.findMany.mockResolvedValue(wikiAttributionOff(AUTHOR));
    expect((await lookUp(db, AUTHOR))?.wikiUsername).toBe("Wiki Author");
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });
});
