/** @jest-environment node */
import { mentionSuggestions } from "~/server/modules/thinkpages-forum/mention-suggest";

interface PersonaArgs {
  where: { clerkUserId?: object; accountType?: { not: string } };
}

function suggestDb(
  users: Array<{ handle: string | null; clerkUserId: string }> = [],
  personas: Array<{ username: string; displayName: string; profileImageUrl: string | null }> = [],
  avatars: Array<{ clerkUserId: string; profileImageUrl: string | null }> = []
) {
  return {
    user: { findMany: jest.fn(async (_args: object) => users) },
    // personalAvatars and the persona search share this table
    thinkpagesAccount: {
      findMany: jest.fn(async (args: PersonaArgs) => (args.where.clerkUserId ? avatars : personas)),
    },
  };
}

describe("mentionSuggestions", () => {
  it("asks nothing for a query under two characters or with other characters", async () => {
    const db = suggestDb();
    for (const q of ["", "a", " k ", "@", "ki r", "k%", "x".repeat(25)]) {
      await expect(mentionSuggestions(db as never, q)).resolves.toEqual([]);
    }
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
  it("never suggests a personal persona: the persona search excludes personal accounts", async () => {
    const db = suggestDb([], [{ username: "AriaV", displayName: "Aria", profileImageUrl: null }]);
    await mentionSuggestions(db as never, "ar");
    const searches = db.thinkpagesAccount.findMany.mock.calls
      .map(([args]) => args)
      .filter((args) => !args.where.clerkUserId);
    expect(searches).toHaveLength(1);
    expect(searches[0]!.where).toMatchObject({ isActive: true, accountType: { not: "personal" } });
  });
  it("gives a handle suggestion exactly its four fields", async () => {
    const db = suggestDb([{ handle: "kirsten", clerkUserId: "clerk_k" }]);
    const [only] = await mentionSuggestions(db as never, "ki");
    expect(Object.keys(only!).sort()).toEqual(["avatarUrl", "kind", "label", "name"]);
  });

  it("never carries a player behind a persona: a persona suggestion has only its own data", async () => {
    const db = suggestDb(
      [],
      [{ username: "aria", displayName: "Aria Vance", profileImageUrl: null }]
    );
    const [only] = await mentionSuggestions(db as never, "ar");
    expect(Object.keys(only!).sort()).toEqual(["avatarUrl", "kind", "label", "name"]);
  });
});
