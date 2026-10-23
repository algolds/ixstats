/** @jest-environment node */
/** The read-only counts the owner runs on production before the IxnayID identity work (design: order, step 1). */
import {
  countLegacyIdentity,
  heldLegacyNames,
  type LegacySnapshot,
} from "~/lib/identity/legacy-identity";

const at = new Date("2026-10-01T00:00:00Z");
const snapshot = (over: Partial<LegacySnapshot> = {}): LegacySnapshot => ({
  links: [],
  users: [],
  hiddenClerkIds: new Set(),
  systemOwnerUserIds: new Set(["owner"]),
  existingClaims: [],
  ...over,
});

describe("countLegacyIdentity", () => {
  it("splits the IxWiki links by who verified them", () => {
    const counts = countLegacyIdentity(
      snapshot({
        links: [
          {
            userId: "a",
            clerkUserId: "user_a",
            username: "Alpha",
            verifiedAt: at,
            verifiedById: null,
            wikiUserId: 3,
          },
          {
            userId: "b",
            clerkUserId: "user_b",
            username: "Beta",
            verifiedAt: at,
            verifiedById: "admin",
            wikiUserId: null,
          },
          {
            userId: "c",
            clerkUserId: "user_c",
            username: "Gamma",
            verifiedAt: at,
            verifiedById: "owner",
            wikiUserId: null,
          },
          {
            userId: "d",
            clerkUserId: "user_d",
            username: "Delta",
            verifiedAt: null,
            verifiedById: null,
            wikiUserId: null,
          },
        ],
      })
    );
    expect(counts.links).toEqual({
      verifiedByToken: 1,
      verifiedByAdmin: 1,
      verifiedBySystemOwner: 1,
      unverified: 1,
    });
  });

  it("compares legacy names with the user's own link after MediaWiki normalisation", () => {
    const counts = countLegacyIdentity(
      snapshot({
        links: [
          {
            userId: "a",
            clerkUserId: "user_a",
            username: "Foo bar",
            verifiedAt: at,
            verifiedById: null,
            wikiUserId: null,
          },
        ],
        users: [
          { userId: "a", clerkUserId: "user_a", wikiUsername: "foo_bar" },
          { userId: "b", clerkUserId: "user_b", wikiUsername: "Other" },
        ],
      })
    );
    expect(counts.usersWithLegacyName).toBe(2);
    expect(counts.legacyNameMatchesOwnLink).toBe(1);
    expect(counts.legacyNameDiffers).toBe(0);
  });

  it("lists names two users hold, and counts hidden users who hold a name", () => {
    const counts = countLegacyIdentity(
      snapshot({
        links: [
          {
            userId: "a",
            clerkUserId: "user_a",
            username: "Shared",
            verifiedAt: null,
            verifiedById: null,
            wikiUserId: null,
          },
        ],
        users: [{ userId: "b", clerkUserId: "user_b", wikiUsername: "shared" }],
        hiddenClerkIds: new Set(["user_b"]),
      })
    );
    expect(counts.contestedNames).toEqual(["Shared"]);
    expect(counts.hiddenUsersWithNames).toBe(1);
  });
});

describe("heldLegacyNames", () => {
  it("is every normalised link and legacy name, without blanks", () => {
    const names = heldLegacyNames(
      snapshot({
        links: [
          {
            userId: "a",
            clerkUserId: "user_a",
            username: "foo_bar",
            verifiedAt: null,
            verifiedById: null,
            wikiUserId: null,
          },
        ],
        users: [
          { userId: "b", clerkUserId: "user_b", wikiUsername: "baz" },
          { userId: "c", clerkUserId: "user_c", wikiUsername: "  " },
        ],
      })
    );
    expect([...names].sort()).toEqual(["Baz", "Foo bar"]);
  });
});
