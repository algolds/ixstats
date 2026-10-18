/** @jest-environment node */
import { authorsOf } from "~/server/modules/thinkpages-forum";
import { previewAuthorOf } from "~/server/modules/thinkpages-forum/authors";

function db(accounts: Array<{ id: string; accountType: string }>) {
  return {
    user: { findMany: jest.fn(async () => []) },
    thinkpagesAccount: {
      findMany: jest.fn(async () =>
        accounts.map((a) => ({
          id: a.id,
          displayName: `Name ${a.id}`,
          username: `user_${a.id}`,
          profileImageUrl: null,
          accountType: a.accountType,
        }))
      ),
    },
  };
}

describe("authorsOf persona types", () => {
  it("selects accountType and returns each persona's type, null for a personal account", async () => {
    const store = db([
      { id: "g", accountType: "government" },
      { id: "p", accountType: "personal" },
    ]);
    const out = await authorsOf(store as never, [], ["g", "p"]);
    expect(store.thinkpagesAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ accountType: true }) })
    );
    expect(out.personas.get("g")?.personaType).toBe("government");
    expect(out.personas.get("p")?.personaType).toBeNull();
  });

  it("gives a persona preview its type and still no flag", async () => {
    const maps = await authorsOf(db([{ id: "m", accountType: "media" }]) as never, [], ["m"]);
    const preview = previewAuthorOf(
      { authorUserId: "u_player", authorPersonaId: "m", importedAuthorName: null },
      maps,
      "Member"
    );
    expect(preview).toEqual({
      name: "Name m",
      avatarUrl: null,
      flagUrl: null,
      persona: true,
      personaType: "media",
    });
  });

  it("gives a member and an imported author no persona type", () => {
    const maps = {
      users: new Map([["u1", { name: "Kir", handle: "kir", avatarUrl: null, flagUrl: "/f.png" }]]),
      personas: new Map(),
    };
    expect(
      previewAuthorOf(
        { authorUserId: "u1", authorPersonaId: null, importedAuthorName: null },
        maps as never,
        "M"
      ).personaType
    ).toBeNull();
    expect(
      previewAuthorOf(
        { authorUserId: null, authorPersonaId: null, importedAuthorName: "Old" },
        maps as never,
        "M"
      ).personaType
    ).toBeNull();
  });
});
