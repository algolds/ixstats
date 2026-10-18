/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
//
// wikios.getAuthorProfile names a wiki account and, for a player, their nation and role. With wiki attribution
// (`showWikiAttribution`) off the wiki name is not tied to the player: a profile asked for by name carries no
// country and no role, for every caller (as users.resolveWikiAuthor). A switch that cannot be read counts as off. The
// caller's own profile (no name asked) still shows their own nation.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { lorewardUserStats: { findUnique: jest.fn(), count: jest.fn() } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/storage", () => ({
  __esModule: true,
  findWikiProfileUser: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getUserContribs: jest.fn(),
  getUserInfo: jest.fn(),
  getBacklinks: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosUserTalkRouter } from "~/server/api/routers/wikios/user-talk";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";
import { findWikiProfileUser } from "~/lib/wiki-os/storage";
import {
  privacyConfigRow,
  privacyConnections,
  wikiAttributionOff,
} from "~/tests/helpers/privacy-config-fake";

const NATION = { id: "c1", name: "Eldoria", flag: null };
const OWNER = { clerkUserId: "clerk_owner", country: NATION, role: { name: "member", level: 50 } };

function caller(connections: ReturnType<typeof privacyConnections>, signedInAs?: string) {
  const ctx = createMockRouterContext({
    db: { userConnection: connections },
    auth: signedInAs ? { userId: signedInAs } : null,
    user: signedInAs
      ? { id: "db_owner", clerkUserId: signedInAs, wikiUsername: "Ruler", country: NATION }
      : null,
  });
  return createCallerFactory(wikiosUserTalkRouter)(ctx as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(findWikiProfileUser).mockResolvedValue(OWNER as never);
  jest.mocked(db.lorewardUserStats.findUnique).mockResolvedValue(null);
});

describe("wikios.getAuthorProfile and wiki attribution", () => {
  it.each([
    ["a visitor", undefined],
    ["the owner", "clerk_owner"],
  ])("gives %s no nation or role for a wiki name whose owner turned it off", async (_who, as) => {
    const connections = privacyConnections(wikiAttributionOff("clerk_owner"));
    const result = await caller(connections, as).getAuthorProfile({ username: "Ruler" });
    expect(result).toMatchObject({ username: "Ruler", country: null, role: null });
    expect(connections.findMany).toHaveBeenCalledTimes(1);
  });

  it("ties the wiki name to the nation and role while the switch is on", async () => {
    const connections = privacyConnections([
      privacyConfigRow("clerk_owner", { showWikiAttribution: true }),
    ]);
    const result = await caller(connections).getAuthorProfile({ username: "Ruler" });
    expect(result).toMatchObject({ country: NATION, role: { name: "member", level: 50 } });
    expect(JSON.stringify(result)).not.toContain("clerk_owner");
  });

  it("fails closed: a switch it cannot read leaves the nation and role out", async () => {
    const connections = privacyConnections();
    connections.findMany.mockRejectedValue(new Error("db down"));
    const result = await caller(connections).getAuthorProfile({ username: "Ruler" });
    expect(result).toMatchObject({ country: null, role: null });
  });

  it("still shows the caller their own nation on their own profile", async () => {
    const connections = privacyConnections(wikiAttributionOff("clerk_owner"));
    const result = await caller(connections, "clerk_owner").getAuthorProfile();
    expect(result).toMatchObject({ username: "Ruler", country: NATION });
    expect(findWikiProfileUser).not.toHaveBeenCalled();
  });
});
