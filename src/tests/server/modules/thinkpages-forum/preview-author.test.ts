import { previewAuthorOf, type AuthorMaps } from "~/server/modules/thinkpages-forum/authors";

const maps: AuthorMaps = {
  users: new Map([
    [
      "u1",
      {
        name: "jane",
        handle: "jane",
        avatarUrl: "https://img.example/jane.png",
        flagUrl: "https://flags.example/eurth.png",
      },
    ],
  ]),
  personas: new Map([
    [
      "p1",
      {
        displayName: "Eurth Daily",
        username: "eurthdaily",
        avatarUrl: "https://img.example/p.png",
        personaType: "media",
      },
    ],
  ]),
};

describe("previewAuthorOf", () => {
  it("shows a persona by name and picture only, even when the row's user has a flag", () => {
    const author = previewAuthorOf(
      { authorUserId: "u1", authorPersonaId: "p1", importedAuthorName: null },
      maps,
      "Member"
    );
    expect(author).toEqual({
      name: "Eurth Daily",
      avatarUrl: "https://img.example/p.png",
      flagUrl: null,
      persona: true,
      personaType: "media",
    });
    expect(JSON.stringify(author)).not.toMatch(/jane|eurth\.png/);
  });

  it("shows a member by public name, picture and flag", () => {
    expect(
      previewAuthorOf(
        { authorUserId: "u1", authorPersonaId: null, importedAuthorName: null },
        maps,
        "Member"
      )
    ).toEqual({
      name: "jane",
      avatarUrl: "https://img.example/jane.png",
      flagUrl: "https://flags.example/eurth.png",
      persona: false,
      personaType: null,
    });
  });

  it("falls back to the imported name, then to the fallback, with no flag", () => {
    const row = { authorUserId: null, authorPersonaId: null };
    expect(
      previewAuthorOf({ ...row, importedAuthorName: "OldName" }, maps, "Member")
    ).toMatchObject({
      name: "OldName",
      flagUrl: null,
    });
    expect(previewAuthorOf({ ...row, importedAuthorName: null }, maps, "Member").name).toBe(
      "Member"
    );
  });
});
