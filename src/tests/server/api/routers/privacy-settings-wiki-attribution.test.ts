/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
//
// Settings → Privacy & Security lists the accounts the viewer blocked and muted. A listed player who turned wiki
// attribution (`showWikiAttribution`) off is not labelled by their wiki name: the label falls through to the next
// one. The listed users are read in one query and their switch in one batch; a read error hides every wiki name.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { usersPreferencesRouter } from "~/server/api/routers/users/preferences";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { privacyConfigRow, wikiAttributionOff } from "~/tests/helpers/privacy-config-fake";

const ME = "clerk_me";
const at = new Date(0);

const person = (id: string, clerkUserId: string, wikiUsername: string, discord: string | null) => ({
  id,
  clerkUserId,
  wikiUsername,
  discordUsername: discord,
  country: null,
});

/** The viewer blocked `db_off` (by platform id) and muted `clerk_on` (by Clerk id). */
function makeDb(switches: () => Promise<ReturnType<typeof privacyConfigRow>[]>) {
  const db = createMockPrisma();
  db.userConnection.findFirst.mockResolvedValue(null);
  db.userConnection.findMany.mockImplementation(
    async (args: { where: { connectionType: string } }) => {
      switch (args.where.connectionType) {
        case "blocked":
          return [{ id: "b1", targetUserId: "db_off", targetCountryId: null, createdAt: at }];
        case "muted":
          return [{ id: "m1", targetUserId: "clerk_on", createdAt: at }];
        case "privacy_config":
          return switches();
        default:
          return [];
      }
    }
  );
  db.user.findMany.mockResolvedValue([
    person("db_off", "clerk_off", "Hidden Name", "offtag"),
    person("db_on", "clerk_on", "Shown Name", null),
  ]);
  return db;
}

async function lists(db: ReturnType<typeof makeDb>) {
  const ctx = createMockRouterContext({
    db,
    auth: { userId: ME },
    user: { id: "db_me", clerkUserId: ME, lastSeenAt: new Date() },
  });
  const settings = await createCallerFactory(usersPreferencesRouter)(
    ctx as never
  ).getPrivacySettings();
  return {
    blocked: settings.blockedAccounts.map((a) => a.label),
    muted: settings.mutedAccounts.map((a) => a.label),
  };
}

const privacyReads = (db: ReturnType<typeof makeDb>) =>
  db.userConnection.findMany.mock.calls.filter(
    ([args]: [{ where: { connectionType: string } }]) =>
      args.where.connectionType === "privacy_config"
  );

describe("users.getPrivacySettings: block and mute list labels and wiki attribution", () => {
  it("labels a player with the switch off by their next name, and one with it on by their wiki name", async () => {
    const db = makeDb(async () => [
      ...wikiAttributionOff("clerk_off"),
      privacyConfigRow("clerk_on", { showWikiAttribution: true }),
    ]);
    expect(await lists(db)).toEqual({ blocked: ["offtag"], muted: ["Shown Name"] });
  });

  it("reads the listed users in one query and their switch in one batch", async () => {
    const db = makeDb(async () => []);
    await lists(db);
    expect(db.user.findMany).toHaveBeenCalledTimes(1);
    expect(db.user.findFirst).not.toHaveBeenCalled();
    expect(privacyReads(db)).toHaveLength(1);
  });

  it("fails closed: a switch it cannot read hides every wiki name", async () => {
    const db = makeDb(async () => {
      throw new Error("db down");
    });
    expect(await lists(db)).toEqual({ blocked: ["offtag"], muted: ["User"] });
  });
});
