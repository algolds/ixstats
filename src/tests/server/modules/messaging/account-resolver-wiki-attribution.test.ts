/**
 * Messaging account names honour wiki attribution (`showWikiAttribution`): a participant who turned it off is
 * never named by their wiki name in conversations, messages or search results, for any viewer, themself included
 * (as display-names.ts and the forum do). The switch is read in one batch and a read error hides every wiki name.
 */
import { describe, it, expect } from "@jest/globals";
import { batchResolveMessagingAccounts } from "~/server/modules/messaging/account-resolver";
import { UNKNOWN_DISPLAY_NAME } from "~/server/shared/display-names";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { privacyConfigRow, wikiAttributionOff } from "~/tests/helpers/privacy-config-fake";

/** Two players named only by their wiki names (no nation, no forum name); one also has a persona. */
function wikiNamedPlayers() {
  const db = createMockPrisma();
  db.user.findMany.mockResolvedValue([
    { clerkUserId: "u_off", forumUsername: null, wikiUsername: "Hidden", country: null },
    { clerkUserId: "u_on", forumUsername: null, wikiUsername: "Shown", country: null },
  ]);
  db.thinkpagesAccount.findMany.mockResolvedValue([
    { clerkUserId: "u_off", displayName: "Persona", username: "persona" },
  ]);
  return db;
}

const names = async (db: ReturnType<typeof wikiNamedPlayers>) => {
  const accounts = await batchResolveMessagingAccounts(["u_off", "u_on"], db as never);
  return Object.fromEntries([...accounts].map(([id, a]) => [id, a.displayName]));
};

describe("batchResolveMessagingAccounts and wiki attribution", () => {
  it("names a player with the switch off by their next name, and one with it on by their wiki name", async () => {
    const db = wikiNamedPlayers();
    db.userConnection.findMany.mockResolvedValue([
      ...wikiAttributionOff("u_off"),
      privacyConfigRow("u_on", { showWikiAttribution: true }),
    ]);
    expect(await names(db)).toEqual({ u_off: "Persona", u_on: "Shown" });
  });

  it("reads the switch in batches, never once per participant", async () => {
    const db = wikiNamedPlayers();
    db.userConnection.findMany.mockResolvedValue(wikiAttributionOff("u_off"));
    await names(db);
    const reads = db.userConnection.findMany.mock.calls.map(([args]) => args.where.userId.in);
    expect(reads[0]).toEqual(["u_off", "u_on"]);
    expect(reads.length).toBeLessThanOrEqual(2);
  });

  it("fails closed: a switch it cannot read hides every wiki name", async () => {
    const db = wikiNamedPlayers();
    db.userConnection.findMany.mockRejectedValue(new Error("db down"));
    expect(await names(db)).toEqual({ u_off: "Persona", u_on: UNKNOWN_DISPLAY_NAME });
  });

  it("keeps a nation name without reading the switch", async () => {
    const db = createMockPrisma();
    db.user.findMany.mockResolvedValue([
      {
        clerkUserId: "u_nation",
        forumUsername: null,
        wikiUsername: null,
        country: { slug: "eldoria", name: "Eldoria", flag: null },
      },
    ]);
    const accounts = await batchResolveMessagingAccounts(["u_nation"], db as never);
    expect(accounts.get("u_nation")).toMatchObject({ displayName: "Eldoria", username: "eldoria" });
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });
});
