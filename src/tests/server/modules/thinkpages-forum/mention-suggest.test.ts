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

  it("matches handles and personas by prefix, case-insensitively, and drops a leading @", async () => {
    const db = suggestDb(
      [{ handle: "kirsten", clerkUserId: "clerk_k" }],
      [{ username: "KirNews", displayName: "Kir News", profileImageUrl: "/n.png" }],
      [{ clerkUserId: "clerk_k", profileImageUrl: "/k.png" }]
    );
    const out = await mentionSuggestions(db as never, "@Ki");
    expect(out).toEqual([
      { kind: "user", name: "kirsten", label: "kirsten", avatarUrl: "/k.png" },
      { kind: "persona", name: "KirNews", label: "Kir News", avatarUrl: "/n.png" },
    ]);
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { handle: { startsWith: "ki" } } })
    );
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

  it("lets the handle win a shared name, skips personas that could never be typed, and returns at most 6", async () => {
    const personas = [
      { username: "kirk", displayName: "A", profileImageUrl: null },
      { username: "kir.dot", displayName: "B", profileImageUrl: null },
      ...Array.from({ length: 12 }, (_, i) => ({
        username: `kirx${i}`,
        displayName: `P${i}`,
        profileImageUrl: null,
      })),
    ];
    const db = suggestDb([{ handle: "kirk", clerkUserId: "clerk_kirk" }], personas);
    const out = await mentionSuggestions(db as never, "kir");
    expect(out).toHaveLength(6);
    expect(out[0]).toMatchObject({ kind: "user", name: "kirk" });
    expect(out.some((s) => s.name === "kir.dot")).toBe(false);
    expect(out.filter((s) => s.name.toLowerCase() === "kirk")).toHaveLength(1);
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 6 }));
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
