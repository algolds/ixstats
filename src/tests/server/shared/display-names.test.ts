import { describe, it, expect } from "@jest/globals";
import { resolveDisplayNames, UNKNOWN_DISPLAY_NAME } from "~/server/shared/display-names";
import { createMockPrisma } from "~/tests/helpers/mock-db";

describe("resolveDisplayNames (SL-12)", () => {
  it("resolves nation, forum, wiki and ThinkPages names in at most two queries", async () => {
    const db = createMockPrisma();
    db.user.findMany.mockResolvedValue([
      {
        clerkUserId: "u_nation",
        forumUsername: "f",
        wikiUsername: "w",
        country: { name: "Urcea" },
      },
      { clerkUserId: "u_forum", forumUsername: "ForumName", wikiUsername: "w", country: null },
      { clerkUserId: "u_wiki", forumUsername: null, wikiUsername: "WikiName", country: null },
      { clerkUserId: "u_bare", forumUsername: null, wikiUsername: null, country: null },
    ]);
    db.thinkpagesAccount.findMany.mockResolvedValue([
      { clerkUserId: "u_bare", displayName: "Persona", username: "persona" },
    ]);

    const names = await resolveDisplayNames(db as never, [
      "u_nation",
      "u_forum",
      "u_wiki",
      "u_bare",
      "u_ghost",
      "u_nation",
    ]);

    expect(Object.fromEntries(names)).toEqual({
      u_nation: "Urcea",
      u_forum: "ForumName",
      u_wiki: "WikiName",
      u_bare: "Persona",
      u_ghost: UNKNOWN_DISPLAY_NAME,
    });
    expect(db.user.findMany).toHaveBeenCalledTimes(1);
    expect(db.thinkpagesAccount.findMany).toHaveBeenCalledTimes(1);
    expect(db.thinkpagesAccount.findMany.mock.calls[0][0].where.clerkUserId.in).toEqual([
      "u_bare",
      "u_ghost",
    ]);
  });

  it("skips the ThinkPages query when every user has a linked name", async () => {
    const db = createMockPrisma();
    db.user.findMany.mockResolvedValue([
      { clerkUserId: "u1", forumUsername: "One", wikiUsername: null, country: null },
    ]);

    const names = await resolveDisplayNames(db as never, ["u1"]);

    expect(names.get("u1")).toBe("One");
    expect(db.thinkpagesAccount.findMany).not.toHaveBeenCalled();
  });
});
