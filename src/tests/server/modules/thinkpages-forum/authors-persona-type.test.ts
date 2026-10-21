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
});
