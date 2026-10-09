/** @jest-environment node */
import {
  canPostInCategory,
  canSeeRealm,
  loadForumRealm,
  realmPostingAccess,
  type ForumRealm,
} from "~/server/modules/thinkpages-forum";

const role = (name: string, level: number) => ({ name, level });
const admin = { id: "u_admin", clerkUserId: "admin", countryId: null, role: role("admin", 10) };
const founder = {
  id: "u_founder",
  clerkUserId: "founder",
  countryId: null,
  role: role("user", 100),
};
const officer = {
  id: "u_officer",
  clerkUserId: "officer",
  countryId: null,
  role: role("user", 100),
};
const claimsOfficer = {
  id: "u_claims",
  clerkUserId: "claims",
  countryId: null,
  role: role("user", 100),
};
const owner = {
  id: "u_owner",
  clerkUserId: "owner",
  countryId: "c_eurth",
  role: role("user", 100),
};
const next = { id: "u_next", clerkUserId: "next", countryId: null, role: role("user", 100) };
const plain = { id: "u_plain", clerkUserId: "plain", countryId: null, role: role("user", 100) };

const EURTH: ForumRealm = {
  id: "r_eurth",
  slug: "eurth",
  name: "Eurth",
  status: "active",
  ownerId: "founder",
};
const IXWORLD: ForumRealm = {
  id: "default",
  slug: "ixworld",
  name: "IxWorld",
  status: "active",
  ownerId: "system",
};
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

interface Ban {
  countryId: string;
  kind: string;
  until: Date | null;
  reason: string | null;
  createdAt: Date;
}
interface Claim {
  userId: string;
  countryId: string;
  reviewedAt: Date;
}
interface Where {
  realmId?: string;
  ownerUserId?: string;
  userId?: string;
  countryId?: { in?: string[] };
}

function accessDb(opts: { owned?: Record<string, string[]>; bans?: Ban[]; claims?: Claim[] } = {}) {
  const owned = opts.owned ?? { u_owner: ["c_eurth"] };
  const officers = [
    { userId: "officer", powers: ["board"] },
    { userId: "claims", powers: ["claims"] },
  ];
  return {
    country: {
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        (owned[where.ownerUserId ?? ""] ?? []).map((id) => ({ id }))
      ),
    },
    realmOfficer: {
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        officers.filter((o) => o.userId === where.userId)
      ),
    },
    realmBoardBan: {
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        (opts.bans ?? []).filter(
          (b) => !where.countryId?.in || where.countryId.in.includes(b.countryId)
        )
      ),
    },
    realmClaim: {
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        (opts.claims ?? []).filter(
          (c) =>
            (!where.userId || c.userId === where.userId) &&
            (!where.countryId?.in || where.countryId.in.includes(c.countryId))
        )
      ),
    },
    realm: { findUnique: jest.fn(async () => null) },
  };
}

describe("loadForumRealm", () => {
  const rows = [
    { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" },
  ];
  function realmDb(extra: typeof rows = []) {
    const all = [...rows, ...extra];
    return {
      realm: {
        findUnique: jest.fn(
          async ({ where }: { where: { slug?: string; id?: string } }) =>
            all.find((r) =>
              where.slug !== undefined ? r.slug === where.slug : r.id === where.id
            ) ?? null
        ),
      },
    };
  }

  it("synthesizes IxWorld for its slugs and id when it has no realm row", async () => {
    for (const ref of [{ slug: "ixworld" }, { slug: "default" }, { id: "default" }]) {
      await expect(loadForumRealm(realmDb() as never, ref)).resolves.toEqual(IXWORLD);
    }
  });

  it("names IxWorld from its row when one exists, under the ixworld slug", async () => {
    const db = realmDb([
      {
        id: "default",
        slug: "default",
        name: "IxWorld Prime",
        status: "active",
        ownerId: "system",
      },
    ]);
    await expect(loadForumRealm(db as never, { slug: "ixworld" })).resolves.toEqual({
      ...IXWORLD,
      name: "IxWorld Prime",
    });
    await expect(loadForumRealm(db as never, { id: "default" })).resolves.toEqual({
      ...IXWORLD,
      name: "IxWorld Prime",
    });
  });

  it("loads a realm row by slug and by id", async () => {
    const db = realmDb();
    await expect(loadForumRealm(db as never, { slug: "eurth" })).resolves.toEqual(EURTH);
    await expect(loadForumRealm(db as never, { id: "r_eurth" })).resolves.toEqual(EURTH);
    expect(db.realm.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "eurth" } })
    );
    expect(db.realm.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r_eurth" } })
    );
  });

  it("returns null for an unknown realm", async () => {
    await expect(loadForumRealm(realmDb() as never, { slug: "nowhere" })).resolves.toBeNull();
    await expect(loadForumRealm(realmDb() as never, { id: "r_nowhere" })).resolves.toBeNull();
  });
});

describe("canSeeRealm", () => {
  it("hides draft and generating realms from plain users and anonymous, not from the founder or an admin", () => {
    for (const status of ["draft", "generating"]) {
      const realm = { ...EURTH, status };
      expect(canSeeRealm(plain, realm)).toBe(false);
      expect(canSeeRealm(null, realm)).toBe(false);
      expect(canSeeRealm(officer, realm)).toBe(false);
      expect(canSeeRealm(founder, realm)).toBe(true);
      expect(canSeeRealm(admin, realm)).toBe(true);
    }
  });

  it("shows active and archived realms to anyone", () => {
    for (const status of ["active", "archived"]) {
      expect(canSeeRealm(null, { ...EURTH, status })).toBe(true);
      expect(canSeeRealm(plain, { ...EURTH, status })).toBe(true);
    }
  });
});

describe("realmPostingAccess", () => {
  it("1. refuses anonymous with a sign-in notice", async () => {
    const db = accessDb();
    await expect(realmPostingAccess(db as never, null, EURTH)).resolves.toEqual({
      ownedCountryIds: [],
      isModerator: false,
      restriction: null,
      canPost: false,
      notice: "Sign in and claim a nation in Eurth to post here.",
    });
    expect(db.country.findMany).not.toHaveBeenCalled();
  });

  it("2. lets a site admin post without nations, without a restriction lookup, even in an archived realm", async () => {
    for (const realm of [EURTH, { ...EURTH, status: "archived" }]) {
      const db = accessDb({ owned: {} });
      const access = await realmPostingAccess(db as never, admin, realm);
      expect(access).toMatchObject({
        isModerator: true,
        canPost: true,
        restriction: null,
        notice: null,
      });
      expect(db.realmBoardBan.findMany).not.toHaveBeenCalled();
      expect(db.realmClaim.findMany).not.toHaveBeenCalled();
    }
  });

  it("3. makes the founder and a board officer moderators, never looking up restrictions", async () => {
    for (const viewer of [founder, officer]) {
      const db = accessDb({
        owned: { u_founder: ["c_f"], u_officer: ["c_o"] },
        bans: [
          { countryId: "c_f", kind: "ban", until: null, reason: "x", createdAt: day("2026-01-01") },
          { countryId: "c_o", kind: "ban", until: null, reason: "x", createdAt: day("2026-01-01") },
        ],
      });
      const access = await realmPostingAccess(db as never, viewer, EURTH);
      expect(access).toMatchObject({
        isModerator: true,
        canPost: true,
        restriction: null,
        notice: null,
      });
      expect(db.realmBoardBan.findMany).not.toHaveBeenCalled();
    }
  });

  it("4. lets the owner of a nation in the realm post", async () => {
    const db = accessDb();
    const access = await realmPostingAccess(db as never, owner, EURTH);
    expect(access).toEqual({
      ownedCountryIds: ["c_eurth"],
      isModerator: false,
      restriction: null,
      canPost: true,
      notice: null,
    });
    expect(db.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { realmId: "r_eurth", ownerUserId: "u_owner" } })
    );
  });

  it("5. refuses a signed-in user with no nation in the realm, and an officer without the board power", async () => {
    for (const viewer of [plain, claimsOfficer]) {
      const access = await realmPostingAccess(accessDb() as never, viewer, EURTH);
      expect(access).toMatchObject({
        isModerator: false,
        canPost: false,
        notice: "Only owners of a nation in Eurth can post here.",
      });
    }
  });

  it("6. refuses a muted or banned owner with the board's restriction message", async () => {
    const mute = {
      countryId: "c_eurth",
      kind: "mute",
      until: day("2026-10-20"),
      reason: "Cool off",
      createdAt: day("2026-10-01"),
    };
    const access = await realmPostingAccess(accessDb({ bans: [mute] }) as never, owner, EURTH);
    expect(access).toMatchObject({
      canPost: false,
      restriction: { kind: "mute", until: day("2026-10-20"), reason: "Cool off" },
      notice: "Your nation is muted on this board until 2026-10-20: Cool off",
    });
    const ban = { ...mute, kind: "ban", until: null, reason: null };
    await expect(
      realmPostingAccess(accessDb({ bans: [ban] }) as never, owner, EURTH)
    ).resolves.toMatchObject({
      canPost: false,
      restriction: { kind: "ban", until: null, reason: null },
      notice: "Your nation is banned from this board until a moderator lifts it",
    });
  });

  it("6. keeps a ban on the player who held the nation, never on its next claimant", async () => {
    const opts = {
      owned: { u_owner: ["c_other"], u_next: ["c_eurth"] },
      claims: [
        { userId: "u_owner", countryId: "c_eurth", reviewedAt: day("2026-04-01") },
        { userId: "u_owner", countryId: "c_other", reviewedAt: day("2026-04-02") },
        { userId: "u_next", countryId: "c_eurth", reviewedAt: day("2026-06-01") },
      ],
      bans: [
        {
          countryId: "c_eurth",
          kind: "ban",
          until: null,
          reason: "Spam",
          createdAt: day("2026-05-01"),
        },
      ],
    };
    await expect(realmPostingAccess(accessDb(opts) as never, owner, EURTH)).resolves.toMatchObject({
      ownedCountryIds: ["c_other"],
      canPost: false,
      restriction: { kind: "ban", reason: "Spam" },
    });
    await expect(realmPostingAccess(accessDb(opts) as never, next, EURTH)).resolves.toMatchObject({
      ownedCountryIds: ["c_eurth"],
      canPost: true,
      restriction: null,
    });
  });

  it("7. makes an archived realm read-only for owners and moderators alike, but never IxWorld", async () => {
    const archived = { ...EURTH, status: "archived" };
    for (const viewer of [owner, founder, officer]) {
      await expect(
        realmPostingAccess(accessDb() as never, viewer, archived)
      ).resolves.toMatchObject({
        canPost: false,
        notice: "This realm is archived: its forum can be read but no longer changes.",
      });
    }
    const db = accessDb({ owned: { u_owner: ["c_ix"] } });
    await expect(
      realmPostingAccess(db as never, owner, { ...IXWORLD, status: "archived" })
    ).resolves.toMatchObject({
      canPost: true,
    });
  });

  it("8. gives IxWorld no founder: board officers and site admins moderate", async () => {
    await expect(
      realmPostingAccess(accessDb({ owned: {} }) as never, plain, IXWORLD)
    ).resolves.toMatchObject({
      isModerator: false,
      canPost: false,
      notice: "Only owners of a nation in IxWorld can post here.",
    });
    await expect(
      realmPostingAccess(accessDb({ owned: {} }) as never, officer, IXWORLD)
    ).resolves.toMatchObject({
      isModerator: true,
      canPost: true,
    });
    await expect(
      realmPostingAccess(accessDb({ owned: {} }) as never, admin, IXWORLD)
    ).resolves.toMatchObject({
      isModerator: true,
      canPost: true,
    });
  });
});

describe("canPostInCategory", () => {
  const site = { scope: "site", realmId: null, visibility: "public", postRole: "any" };
  const hub = { scope: "realm", realmId: "r_eurth", visibility: "public", postRole: "any" };
  function categoryDb(realm: ForumRealm | null = EURTH) {
    const db = accessDb();
    db.realm.findUnique.mockResolvedValue(realm as never);
    return db;
  }

  it("applies the phase 1 rule to sitewide categories without loading a realm", async () => {
    const db = categoryDb();
    await expect(canPostInCategory(db as never, plain, site)).resolves.toBe(true);
    await expect(
      canPostInCategory(db as never, plain, { ...site, postRole: "staff" })
    ).resolves.toBe(false);
    await expect(canPostInCategory(db as never, null, site)).resolves.toBe(false);
    expect(db.realm.findUnique).not.toHaveBeenCalled();
  });

  it("follows the realm posting rule in realm categories", async () => {
    await expect(canPostInCategory(categoryDb() as never, owner, hub)).resolves.toBe(true);
    await expect(canPostInCategory(categoryDb() as never, plain, hub)).resolves.toBe(false);
    await expect(canPostInCategory(categoryDb() as never, admin, hub)).resolves.toBe(true);
    await expect(
      canPostInCategory(categoryDb() as never, owner, { ...hub, postRole: "staff" })
    ).resolves.toBe(false);
  });

  it("refuses a realm category whose realm is hidden from the viewer or gone", async () => {
    await expect(
      canPostInCategory(categoryDb({ ...EURTH, status: "draft" }) as never, owner, hub)
    ).resolves.toBe(false);
    await expect(canPostInCategory(categoryDb(null) as never, owner, hub)).resolves.toBe(false);
  });
});
