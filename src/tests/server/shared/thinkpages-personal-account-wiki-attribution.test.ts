/**
 * A new personal persona ("post as yourself") is seeded from the player's names, and with wiki attribution
 * (`showWikiAttribution`) off never from their wiki name: the forum name, else the existing non-wiki fallback. The
 * switch is read once and a read error counts as off. An existing persona keeps the name it has.
 */
import { describe, it, expect } from "@jest/globals";
import { ensurePersonalAccount } from "~/server/shared/thinkpages-personal-account";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { privacyConfigRow, wikiAttributionOff } from "~/tests/helpers/privacy-config-fake";

const ME = "user_me";

/** A db with no personal persona yet, whose user row carries `names`. */
function newPersonaDb(names: { forumUsername: string | null; wikiUsername: string | null }) {
  const db = createMockPrisma();
  db.$transaction = jest.fn((cb: (tx: typeof db) => unknown) => cb(db));
  db.thinkpagesPersonalAccount.findUnique.mockResolvedValue(null);
  db.thinkpagesAccount.findUnique.mockResolvedValue(null);
  db.thinkpagesAccount.create.mockImplementation(async ({ data }: { data: object }) => ({
    id: "new_personal",
    ...data,
  }));
  db.user.findUnique.mockResolvedValue(names);
  return db;
}

const created = (db: ReturnType<typeof newPersonaDb>) =>
  ensurePersonalAccount(db as never, ME) as Promise<{ username: string; displayName: string }>;

describe("ensurePersonalAccount and wiki attribution", () => {
  it("seeds a player with the switch off from the forum name", async () => {
    const db = newPersonaDb({ forumUsername: "Rowan", wikiUsername: "Wiki Rowan" });
    db.userConnection.findMany.mockResolvedValue(wikiAttributionOff(ME));
    await expect(created(db)).resolves.toMatchObject({ username: "Rowan", displayName: "Rowan" });
    expect(db.userConnection.findMany).toHaveBeenCalledTimes(1);
  });

  it("seeds a player with the switch off and no forum name from the non-wiki fallback", async () => {
    const db = newPersonaDb({ forumUsername: null, wikiUsername: "WikiRowan" });
    db.userConnection.findMany.mockResolvedValue(wikiAttributionOff(ME));
    const persona = await created(db);
    expect(persona.username).toMatch(/^member_\d{4}$/);
    expect(persona.displayName).toBe("member");
    expect(JSON.stringify(db.thinkpagesAccount.create.mock.calls)).not.toContain("WikiRowan");
  });

  it("seeds a player with the switch on from the wiki name when there is no forum name", async () => {
    const db = newPersonaDb({ forumUsername: null, wikiUsername: "WikiRowan" });
    db.userConnection.findMany.mockResolvedValue([
      privacyConfigRow(ME, { showWikiAttribution: true }),
    ]);
    await expect(created(db)).resolves.toMatchObject({
      username: "WikiRowan",
      displayName: "WikiRowan",
    });
  });

  it("fails closed: a switch it cannot read keeps the wiki name out", async () => {
    const db = newPersonaDb({ forumUsername: null, wikiUsername: "WikiRowan" });
    db.userConnection.findMany.mockRejectedValue(new Error("db down"));
    const persona = await created(db);
    expect(persona.username).toMatch(/^member_\d{4}$/);
    expect(JSON.stringify(db.thinkpagesAccount.create.mock.calls)).not.toContain("WikiRowan");
  });

  it("keeps the explicit names the caller asked for", async () => {
    const db = newPersonaDb({ forumUsername: null, wikiUsername: "WikiRowan" });
    db.userConnection.findMany.mockResolvedValue(wikiAttributionOff(ME));
    await expect(
      ensurePersonalAccount(db as never, ME, { username: "rowan_g", displayName: "Rowan G" })
    ).resolves.toMatchObject({ username: "rowan_g", displayName: "Rowan G" });
  });

  it("never renames an existing persona, and reads no switch for it", async () => {
    const db = createMockPrisma();
    const existing = {
      id: "acc_personal",
      clerkUserId: ME,
      accountType: "personal",
      username: "WikiRowan",
      displayName: "WikiRowan",
      isActive: true,
    };
    db.thinkpagesPersonalAccount.findUnique.mockResolvedValue({
      clerkUserId: ME,
      accountId: existing.id,
    });
    db.thinkpagesAccount.findUnique.mockResolvedValue(existing);
    db.userConnection.findMany.mockResolvedValue(wikiAttributionOff(ME));
    await expect(ensurePersonalAccount(db as never, ME)).resolves.toBe(existing);
    expect(db.thinkpagesAccount.update).not.toHaveBeenCalled();
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });
});
