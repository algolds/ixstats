/** @jest-environment node */
/** The read-only counts the owner runs on production before the IxnayID identity work (design: order, step 1). */
import {
  CONVERSION_MARKER,
  countLegacyIdentity,
  heldLegacyNames,
  planConversion,
  type LegacyLinkRow,
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
const link = (over: Partial<LegacyLinkRow> & Pick<LegacyLinkRow, "userId">): LegacyLinkRow => ({
  clerkUserId: `user_${over.userId}`,
  username: "Alpha",
  verifiedAt: null,
  verifiedById: null,
  wikiUserId: null,
  ...over,
});
const pending = (
  userId: string,
  name: string,
  decisionNote: string,
  mwUserId: number | null = null
) => ({
  userId,
  name,
  status: "PENDING",
  visible: true,
  rightsPass: false,
  decidedById: null,
  decidedAt: null,
  mwUserId,
  decisionNote,
});
const FROM_UNVERIFIED = "Converted from an unverified wiki link";
const FROM_FIELD = "Converted from the old wiki name field";

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

describe("planConversion", () => {
  it("approves a token-proven link with rights, and a hidden user's claims stay private", () => {
    const plan = planConversion(
      snapshot({
        links: [link({ userId: "a", verifiedAt: at, wikiUserId: 7 })],
        users: [{ userId: "a", clerkUserId: "user_a", wikiUsername: "alpha_alt" }],
        hiddenClerkIds: new Set(["user_a"]),
      })
    );
    expect(plan.create).toEqual([
      {
        userId: "a",
        name: "Alpha",
        status: "APPROVED",
        visible: false,
        rightsPass: true,
        decidedById: null,
        decidedAt: at,
        mwUserId: 7,
        decisionNote: "Converted from a wiki link its account proved with a token",
      },
      {
        userId: "a",
        name: "Alpha alt",
        status: "PENDING",
        visible: false,
        rightsPass: false,
        decidedById: null,
        decidedAt: null,
        mwUserId: null,
        decisionNote: FROM_FIELD,
      },
    ]);
    expect(plan.skipped).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it("approves a link a system owner confirmed with rights, keeping who confirmed it", () => {
    const plan = planConversion(
      snapshot({ links: [link({ userId: "a", verifiedAt: at, verifiedById: "owner" })] })
    );
    expect(plan.create).toEqual([
      {
        userId: "a",
        name: "Alpha",
        status: "APPROVED",
        visible: true,
        rightsPass: true,
        decidedById: "owner",
        decidedAt: at,
        mwUserId: null,
        decisionNote: "Converted from a wiki link a system owner confirmed",
      },
    ]);
  });

  it("approves a link another administrator confirmed without rights", () => {
    const plan = planConversion(
      snapshot({ links: [link({ userId: "a", verifiedAt: at, verifiedById: "admin" })] })
    );
    expect(plan.create).toEqual([
      {
        userId: "a",
        name: "Alpha",
        status: "APPROVED",
        visible: true,
        rightsPass: false,
        decidedById: "admin",
        decidedAt: at,
        mwUserId: null,
        decisionNote: "Converted from a wiki link an administrator confirmed",
      },
    ]);
  });

  it("asks for an unverified link", () => {
    const plan = planConversion(snapshot({ links: [link({ userId: "a", username: "foo_bar" })] }));
    expect(plan.create).toEqual([pending("a", "Foo bar", FROM_UNVERIFIED)]);
  });

  it("asks for a legacy name that is not the user's own link name, after normalisation", () => {
    const plan = planConversion(
      snapshot({
        links: [link({ userId: "a", username: "Foo bar" })],
        users: [
          { userId: "a", clerkUserId: "user_a", wikiUsername: "foo_bar" },
          { userId: "b", clerkUserId: "user_b", wikiUsername: "beta" },
          { userId: "c", clerkUserId: "user_c", wikiUsername: "  " },
        ],
      })
    );
    expect(plan.create).toEqual([
      pending("a", "Foo bar", FROM_UNVERIFIED),
      pending("b", "Beta", FROM_FIELD),
    ]);
  });

  it("makes one claim per user and name, the link's, and keeps only real MediaWiki ids", () => {
    const plan = planConversion(
      snapshot({
        links: [
          link({ userId: "a", username: "Alpha", verifiedAt: at, wikiUserId: 1 }),
          link({ userId: "b", username: "Beta", wikiUserId: 42 }),
        ],
        users: [
          { userId: "a", clerkUserId: "user_a", wikiUsername: "alpha" },
          { userId: "b", clerkUserId: "user_b", wikiUsername: "Beta" },
        ],
      })
    );
    expect(plan.create).toEqual([
      expect.objectContaining({ userId: "a", name: "Alpha", status: "APPROVED", mwUserId: null }),
      pending("b", "Beta", FROM_UNVERIFIED, 42),
    ]);
  });

  it("keeps every claim of a user who left wiki attribution on visible", () => {
    const plan = planConversion(
      snapshot({
        links: [link({ userId: "a" }), link({ userId: "b", username: "Beta" })],
        hiddenClerkIds: new Set(["user_b"]),
      })
    );
    expect(plan.create.map((c) => [c.userId, c.visible])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("is a no-op on a second run, and never revives a revoked claim", () => {
    const plan = planConversion(
      snapshot({
        links: [link({ userId: "a", verifiedAt: at })],
        existingClaims: [{ userId: "a", name: "Alpha", status: "REVOKED" }],
      })
    );
    expect(plan.create).toEqual([]);
    expect(plan.skipped).toEqual([{ userId: "a", name: "Alpha", reason: "EXISTS" }]);
  });

  it("skips an approval for a name another account already holds, but still asks for it", () => {
    const plan = planConversion(
      snapshot({
        links: [link({ userId: "a", verifiedAt: at }), link({ userId: "c", username: "alpha" })],
        existingClaims: [{ userId: "b", name: "Alpha", status: "APPROVED" }],
      })
    );
    expect(plan.create).toEqual([pending("c", "Alpha", FROM_UNVERIFIED)]);
    expect(plan.skipped).toEqual([{ userId: "a", name: "Alpha", reason: "NAME_TAKEN" }]);
  });

  it("skips a name no MediaWiki user can hold", () => {
    const plan = planConversion(
      snapshot({
        links: [link({ userId: "a", username: "Bad|name" })],
        users: [{ userId: "b", clerkUserId: "user_b", wikiUsername: "x".repeat(86) }],
      })
    );
    expect(plan.create).toEqual([]);
    expect(plan.skipped).toEqual([
      { userId: "a", name: "Bad|name", reason: "INVALID" },
      { userId: "b", name: `X${"x".repeat(85)}`, reason: "INVALID" },
    ]);
  });

  it("reports a name two accounts would hold or ask for, and approves neither side of a tie", () => {
    const plan = planConversion(
      snapshot({
        links: [
          link({ userId: "u2", username: "Heku" }),
          link({ userId: "t1", username: "Tied", verifiedAt: at }),
          link({ userId: "t2", username: "tied", verifiedAt: at, verifiedById: "owner" }),
        ],
        users: [{ userId: "u1", clerkUserId: "user_u1", wikiUsername: "Heku" }],
        existingClaims: [
          { userId: "u3", name: "Heku", status: "PENDING" },
          { userId: "u4", name: "Tied", status: "REJECTED" },
        ],
      })
    );
    expect(plan.create).toEqual([
      pending("u2", "Heku", FROM_UNVERIFIED),
      pending("t1", "Tied", "Converted from a wiki link its account proved with a token"),
      pending("t2", "Tied", "Converted from a wiki link a system owner confirmed"),
      pending("u1", "Heku", FROM_FIELD),
    ]);
    expect(plan.conflicts).toEqual([
      { name: "Heku", userIds: ["u1", "u2", "u3"] },
      { name: "Tied", userIds: ["t1", "t2"] },
    ]);
  });

  it("names the marker the removal SQL waits for", () => {
    expect(CONVERSION_MARKER).toBe("WIKI_NAME_CLAIMS_CONVERTED");
  });
});
