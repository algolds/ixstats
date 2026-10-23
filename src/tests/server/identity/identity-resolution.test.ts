/** @jest-environment node */
/**
 * Who a passport handle, an invite's `via` or a URL segment names, through the real resolver over a small user table
 * that answers as Postgres does (Prisma's insensitive `equals` is ILIKE: `%` and `_` are wildcards, `\` escapes).
 *
 * Resolution order: the stored handle (normalised), the viewer's own names (`me`, their forum name and every name they
 * hold, hidden or not), then forum name, claimed wiki name, Clerk id or id; a country name, slug or id never names a
 * person. A claimed wiki name names its owner only while the claim is approved and shown (`visible`); a pending,
 * revoked or hidden claim, or a claims read that fails, names nobody. Every handle the passport chain produces (stored
 * handle, first shown claimed name while wiki attribution is on, forum name, Clerk id) resolves back to its holder, and
 * a computed name another user holds is skipped. With attribution off, or a switch that cannot be read, the chain never
 * emits the wiki name. A realm's Join panel names an inviter only while
 * they hold a nation in that realm (and the realm takes claims). A nation is held only through `Country.ownerUserId`,
 * only in realms the directory lists; the primary nation is one held; Ixnay has no founder.
 *
 * Folds identity-resolve-handle, identity-passport-handle-by-id, identity-invites, identity-nations and
 * identity-mappers.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    country: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    realm: { findMany: jest.fn() },
    realmClaim: { findMany: jest.fn() },
    thinkpagesAccount: { findFirst: jest.fn() },
    wikiNameClaim: { findMany: jest.fn() },
    userConnection: { findMany: jest.fn() },
    lorewardUserStats: { findFirst: jest.fn() },
    wikiRevision: { findFirst: jest.fn() },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});
jest.mock("~/lib/wiki-os/adapters/ixstates/user-sync", () => ({
  lookupWikiUser: jest.fn().mockResolvedValue(null),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { escapeRegExp } from "~/lib/utils/escape-regexp";
import { lookupWikiUser } from "~/lib/wiki-os/adapters/ixstates/user-sync";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";
import {
  loadRecruitedCount,
  resolveInviterUserId,
  resolveRealmInviter,
} from "~/server/modules/identity/identity.invites";
import { primaryNationOf, toRealmMemberships } from "~/server/modules/identity/identity.mappers";
import {
  loadPassportHandle,
  loadPassportHandleById,
} from "~/server/modules/identity/identity.passport-handle";
import { loadRealmRoles } from "~/server/modules/identity/identity.realm-roles";
import {
  resolveCanonicalHandle,
  resolveHandleUser,
  resolveIdentity,
  resolveIdentityNations,
} from "~/server/modules/identity/identity.resolve";
import type { IdentityCountry } from "~/server/modules/identity/identity.selects";
import type { ResolvedIdentity } from "~/server/modules/identity/identity.types";

interface Row {
  id: string;
  clerkUserId: string;
  handle: string | null;
  forumUsername: string | null;
  forumUserId: number | null;
}

/** A wiki name claim (approved unless said otherwise), as `wiki_name_claims` holds it. */
interface Claim {
  userId: string;
  name: string;
  status: string;
  visible: boolean;
}

const mocked = db as unknown as {
  user: { findUnique: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
  country: { findUnique: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
  realm: { findMany: jest.Mock };
  realmClaim: { findMany: jest.Mock };
  thinkpagesAccount: { findFirst: jest.Mock };
  wikiNameClaim: { findMany: jest.Mock };
  userConnection: { findMany: jest.Mock };
  lorewardUserStats: { findFirst: jest.Mock };
  wikiRevision: { findFirst: jest.Mock };
};

type Clause = Record<string, string | { equals: string } | { in: string[] }>;

/** Postgres ILIKE, which Prisma's insensitive `equals` compiles to: `%` and `_` are wildcards, `\\` escapes. */
function ilike(value: string, pattern: string): boolean {
  const source = pattern.replace(
    /\\(.)|([%_])|([^\\%_]+)/gs,
    (_m, escaped: string, wild: string, text: string) =>
      escaped !== undefined
        ? escapeRegExp(escaped)
        : wild !== undefined
          ? wild === "%"
            ? ".*"
            : "."
          : escapeRegExp(text)
  );
  return new RegExp(`^${source}$`, "is").test(value);
}

/** One `legacyNameWhere` clause: an exact id, one of a list of ids, or a case-insensitive name. */
function matches(row: Row, clause: Clause): boolean {
  return Object.entries(clause).every(([field, test]) => {
    const value = row[field as keyof Row];
    if (typeof value !== "string") return false;
    if (typeof test === "string") return value === test;
    return "in" in test ? test.in.includes(value) : ilike(value, test.equals);
  });
}

/** A tiny user table behind the lookups the resolver makes (wiki-name candidates through findMany). */
function usersTable(rows: Row[]) {
  const anyClause = (where: { OR: Clause[] }) => (row: Row) =>
    where.OR.some((clause) => matches(row, clause));
  mocked.user.findUnique.mockImplementation(({ where }: { where: Clause }) =>
    Promise.resolve(rows.find((row) => matches(row, where)) ?? null)
  );
  mocked.user.findFirst.mockImplementation(({ where }: { where: { OR: Clause[] } }) =>
    Promise.resolve(rows.find(anyClause(where)) ?? null)
  );
  mocked.user.findMany.mockImplementation(({ where }: { where: { OR: Clause[] } }) =>
    Promise.resolve(rows.filter(anyClause(where)))
  );
}

interface ClaimWhere {
  status?: string;
  visible?: boolean;
  userId?: { in: string[] };
  OR?: Array<{ name: { equals: string } }>;
}

/** The claims table behind the resolver's reads: by owner, by status and `visible`, and by name (ILIKE). */
function claimsTable(claims: Claim[]) {
  const fits = (claim: Claim, where: ClaimWhere) =>
    (!where.status || claim.status === where.status) &&
    (where.visible === undefined || claim.visible === where.visible) &&
    (!where.userId || where.userId.in.includes(claim.userId)) &&
    (!where.OR || where.OR.some((clause) => ilike(claim.name, clause.name.equals)));
  mocked.wikiNameClaim.findMany.mockImplementation(({ where }: { where: ClaimWhere }) =>
    Promise.resolve(claims.filter((claim) => fits(claim, where)))
  );
}

const claim = (userId: string, name: string, fields: Partial<Claim> = {}): Claim => ({
  userId,
  name,
  status: "APPROVED",
  visible: true,
  ...fields,
});

const row = (id: string, fields: Partial<Row>): Row => ({
  id,
  clerkUserId: `user_${id}_${"x".repeat(24)}`,
  handle: null,
  forumUsername: null,
  forumUserId: null,
  ...fields,
});

const noForum = { lookupUser: jest.fn().mockResolvedValue(null), getActivity: jest.fn() };

async function roundTrip(user: Row) {
  const handle = await loadPassportHandle(user);
  const identity = await resolveIdentity(handle, null, noForum);
  return { handle, resolvedId: identity?.user?.id ?? null };
}

/** The user's stored privacy config (Settings → Privacy & Security). */
function privacyOf(user: Row, config: Record<string, boolean>) {
  mocked.userConnection.findMany.mockResolvedValue([
    { userId: user.clerkUserId, status: JSON.stringify(config) },
  ]);
}

beforeEach(() => {
  jest.resetAllMocks();
  usersTable([]);
  claimsTable([]);
  for (const delegate of [
    mocked.country.findUnique,
    mocked.country.findFirst,
    mocked.thinkpagesAccount.findFirst,
    mocked.lorewardUserStats.findFirst,
    mocked.wikiRevision.findFirst,
  ]) {
    delegate.mockResolvedValue(null);
  }
  mocked.userConnection.findMany.mockResolvedValue([]);
  mocked.realm.findMany.mockResolvedValue([]);
  noForum.lookupUser.mockResolvedValue(null);
  jest.mocked(lookupWikiUser).mockResolvedValue(null);
});

describe("resolving a segment", () => {
  const kir = row("kir", { handle: "kir", forumUsername: "Kir Forum", forumUserId: 7 });

  it("resolves a stored handle first, normalised, without the legacy name lookup", async () => {
    usersTable([kir]);
    expect((await resolveIdentity("@KIR", null))?.user?.id).toBe("kir");
    expect(mocked.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { handle: "kir" } })
    );
    expect(mocked.user.findFirst).not.toHaveBeenCalled();
  });

  it("resolves me to the signed-in viewer, as the owner", async () => {
    usersTable([kir]);
    const identity = await resolveIdentity("me", kir.clerkUserId);
    expect(identity?.user?.id).toBe("kir");
    expect(identity?.isOwner).toBe(true);
  });

  it("never resolves a country name, slug or id to a person", async () => {
    usersTable([kir]);
    for (const segment of ["Caphiria", "caphiria", "c_cap"]) {
      expect([segment, await resolveIdentity(segment, null, noForum)]).toEqual([segment, null]);
    }
    expect(mocked.country.findFirst).not.toHaveBeenCalled();
  });

  it("redirects a legacy name to its holder's stored handle, and nothing else", async () => {
    usersTable([kir, row("bare", { forumUsername: "Bare Forum" })]);
    await expect(resolveCanonicalHandle("Kir Forum")).resolves.toEqual({ handle: "kir" });
    await expect(resolveCanonicalHandle("@kir")).resolves.toEqual({ handle: "kir" });
    await expect(resolveCanonicalHandle("me")).resolves.toBeNull();
    await expect(resolveCanonicalHandle("nobody")).resolves.toBeNull();
    await expect(resolveCanonicalHandle("Bare Forum")).resolves.toBeNull();
  });
});

describe("the passport handle chain", () => {
  it("resolves a stored handle, a claimed wiki name, a forum name and a Clerk id back to their user", async () => {
    const stored = row("a", { handle: "kir" });
    const wiki = row("b", { forumUsername: "LyraForum" });
    const forum = row("c", { forumUsername: "Dax_" });
    const bare = row("d", {});
    usersTable([stored, wiki, forum, bare]);
    claimsTable([claim("b", "Lyra Wiki")]);

    expect(await roundTrip(stored)).toEqual({ handle: "kir", resolvedId: "a" });
    expect(await roundTrip(wiki)).toEqual({ handle: "Lyra Wiki", resolvedId: "b" });
    expect(await roundTrip(forum)).toEqual({ handle: "Dax_", resolvedId: "c" });
    expect(await roundTrip(bare)).toEqual({ handle: bare.clerkUserId, resolvedId: "d" });
  });

  it("skips a computed name another user holds as a handle or a name", async () => {
    const holder = row("owner", { handle: "bob" });
    const namesake = row("namesake", { forumUsername: "Bob" });
    const zed = row("zed", { forumUsername: "Zed" });
    usersTable([holder, zed, namesake]);

    expect(await roundTrip(namesake)).toEqual({
      handle: namesake.clerkUserId,
      resolvedId: "namesake",
    });
    claimsTable([claim("namesake", "Zed")]);
    expect(await roundTrip(namesake)).toEqual({
      handle: namesake.clerkUserId,
      resolvedId: "namesake",
    });
  });

  it.each(["%", "H%", "_elvianir", "Helviani_", "Da%"])(
    "treats %s literally: a wildcard names nobody",
    async (probe) => {
      usersTable([row("h", { forumUsername: "Helvianir" }), row("c", { forumUsername: "Dax_" })]);
      expect(await resolveHandleUser(probe)).toBeNull();
      expect((await resolveHandleUser("helvianir"))?.id).toBe("h");
      expect((await resolveHandleUser("Dax_"))?.id).toBe("c");
    }
  );

  it("finds a user by id for a card: the stored handle with no further reads, and null for nobody", async () => {
    usersTable([row("u1", { handle: "kir" })]);
    await expect(loadPassportHandleById("u1")).resolves.toBe("kir");
    expect(mocked.wikiNameClaim.findMany).not.toHaveBeenCalled();
    await expect(loadPassportHandleById("gone")).resolves.toBeNull();
  });
});

describe("the passport handle chain and wiki attribution", () => {
  const lyra = row("b", { forumUsername: "LyraForum" });
  const bare = row("d", {});

  beforeEach(() => {
    usersTable([lyra, bare]);
    claimsTable([claim("b", "Lyra Wiki"), claim("d", "Dee Wiki")]);
  });

  it("uses the shown claimed name while wiki attribution is on", async () => {
    privacyOf(lyra, { showWikiAttribution: true });
    expect(await roundTrip(lyra)).toEqual({ handle: "Lyra Wiki", resolvedId: "b" });
  });

  it("skips the wiki name when it is off, for the next name that resolves back", async () => {
    privacyOf(lyra, { showWikiAttribution: false });
    expect(await roundTrip(lyra)).toEqual({ handle: "LyraForum", resolvedId: "b" });
    privacyOf(bare, { showWikiAttribution: false });
    expect(await roundTrip(bare)).toEqual({ handle: bare.clerkUserId, resolvedId: "d" });
  });

  it("treats an unreadable switch as off", async () => {
    mocked.userConnection.findMany.mockRejectedValue(new Error("db down"));
    expect(await roundTrip(lyra)).toEqual({ handle: "LyraForum", resolvedId: "b" });
  });

  it("keeps a stored handle whatever the switch, without reading it", async () => {
    const kir = row("k", { handle: "kir" });
    usersTable([kir]);
    claimsTable([claim("k", "Kir Wiki")]);
    privacyOf(kir, { showWikiAttribution: false });
    expect(await roundTrip(kir)).toEqual({ handle: "kir", resolvedId: "k" });
    expect(mocked.userConnection.findMany).not.toHaveBeenCalled();
  });

  it("skips a hidden claim for a handle-less user, and the first shown one names them", async () => {
    claimsTable([
      claim("b", "Lyra Secret", { visible: false }),
      claim("b", "Lyra Wiki"),
      claim("d", "Dee Wiki", { visible: false }),
    ]);
    expect(await roundTrip(lyra)).toEqual({ handle: "Lyra Wiki", resolvedId: "b" });
    expect(await roundTrip(bare)).toEqual({ handle: bare.clerkUserId, resolvedId: "d" });
  });
});

describe("a claimed wiki name in a link", () => {
  const old = row("o", { handle: "olden", forumUsername: "OldForum" });

  beforeEach(() => usersTable([old, row("v", {})]));

  it("resolves /@Old_name to the claim's owner while it is shown, and not once it is hidden", async () => {
    claimsTable([claim("o", "Old name")]);
    expect((await resolveIdentity("@Old_name", null, noForum))?.user?.id).toBe("o");
    expect((await resolveHandleUser("old name"))?.id).toBe("o");
    await expect(resolveCanonicalHandle("Old_name")).resolves.toEqual({ handle: "olden" });

    claimsTable([claim("o", "Old name", { visible: false })]);
    expect(await resolveIdentity("@Old_name", null, noForum)).toBeNull();
    expect(await resolveHandleUser("old name")).toBeNull();
    await expect(resolveCanonicalHandle("Old_name")).resolves.toBeNull();
    // ...while the owner's other names still resolve
    expect((await resolveHandleUser("OldForum"))?.id).toBe("o");
  });

  it("resolves the viewer's own hidden claim to themself", async () => {
    claimsTable([claim("o", "Old name", { visible: false })]);
    const identity = await resolveIdentity("@Old_name", old.clerkUserId, noForum);
    expect(identity?.user?.id).toBe("o");
    expect(identity?.isOwner).toBe(true);
    // ...and nobody else's
    expect(await resolveIdentity("@Old_name", row("v", {}).clerkUserId, noForum)).toBeNull();
  });

  it.each([
    ["pending", { status: "PENDING" }],
    ["revoked", { status: "REVOKED" }],
    ["rejected", { status: "REJECTED" }],
  ])("names nobody by a %s claim, not even its requester", async (_status, fields) => {
    claimsTable([claim("o", "Old name", fields)]);
    expect(await resolveHandleUser("Old name")).toBeNull();
    expect(await resolveIdentity("@Old_name", old.clerkUserId, noForum)).toBeNull();
  });

  it("is the shown claimed name on the identity, never a hidden one", async () => {
    claimsTable([claim("o", "Old name", { visible: false })]);
    expect((await resolveIdentity("olden", null, noForum))?.wikiName).toBeNull();
    claimsTable([claim("o", "Old name", { visible: false }), claim("o", "Second name")]);
    expect((await resolveIdentity("olden", null, noForum))?.wikiName).toBe("Second name");
  });

  it("fails closed: a claims read that fails resolves no wiki name", async () => {
    mocked.wikiNameClaim.findMany.mockRejectedValue(new Error("db down"));
    expect(await resolveHandleUser("Old name")).toBeNull();
    expect((await resolveHandleUser("OldForum"))?.id).toBe("o");
  });

  it("never matches a wildcard against a claimed name", async () => {
    claimsTable([claim("o", "Old name")]);
    for (const probe of ["%", "Old%", "Ol_ name"]) {
      expect([probe, await resolveHandleUser(probe)]).toEqual([probe, null]);
    }
  });
});

describe("realm invites", () => {
  const kir = row("db_kir", { handle: "kir", forumUsername: "Kir Forum" });
  /** Realm slug → status, for the open-realm filter. */
  const REALMS: Record<string, string> = { eurth: "active", unlisted: "active", drafty: "draft" };
  interface MemberWhere {
    ownerUserId: string;
    realmId?: string;
    realm?: { slug: string; status: string };
  }
  /** Kir holds a nation in every realm; the filter decides which realms count. */
  const kirHoldsEverywhere = () =>
    mocked.country.findFirst.mockImplementation(({ where }: { where: MemberWhere }) => {
      if (where.ownerUserId !== "db_kir") return Promise.resolve(null);
      const open = where.realm ? REALMS[where.realm.slug] === where.realm.status : true;
      return Promise.resolve(open ? { id: "c1" } : null);
    });

  it("resolve a via by stored handle, normalised, then forum name, and never me, a blank or nobody", async () => {
    usersTable([kir]);
    await expect(resolveInviterUserId("@Kir")).resolves.toBe("db_kir");
    expect(mocked.user.findFirst).not.toHaveBeenCalled();
    await expect(resolveInviterUserId("Kir Forum")).resolves.toBe("db_kir");
    for (const via of ["nobody", "me", "  "]) {
      expect([via, await resolveInviterUserId(via)]).toEqual([via, null]);
    }
  });

  it("name a member of the realm by handle and persona name, nothing else", async () => {
    usersTable([kir]);
    kirHoldsEverywhere();
    mocked.thinkpagesAccount.findFirst.mockResolvedValue({ displayName: "Kir of Caphiria" });
    await expect(resolveRealmInviter("eurth", "kir")).resolves.toEqual({
      handle: "kir",
      displayName: "Kir of Caphiria",
    });
    expect(mocked.country.findFirst).toHaveBeenCalledWith({
      where: { ownerUserId: "db_kir", realm: { slug: "eurth", status: "active" } },
      select: { id: true },
    });
  });

  it("name nobody in a realm that takes no claims, though they hold a nation there; an unlisted realm does", async () => {
    usersTable([kir]);
    kirHoldsEverywhere();
    await expect(resolveRealmInviter("drafty", "kir")).resolves.toBeNull();
    await expect(resolveRealmInviter("unlisted", "kir")).resolves.not.toBeNull();
  });

  it("read Ixnay membership by its realm id", async () => {
    usersTable([kir]);
    mocked.country.findFirst.mockResolvedValue({ id: "c1" });
    await expect(resolveRealmInviter("ixnay", "kir")).resolves.toEqual({
      handle: "kir",
      displayName: "Kir Forum",
    });
    expect(mocked.country.findFirst).toHaveBeenCalledWith({
      where: { ownerUserId: "db_kir", realmId: "default" },
      select: { id: true },
    });
  });

  it("are null when the inviter holds no nation in the realm, or is unknown", async () => {
    usersTable([kir]);
    await expect(resolveRealmInviter("eurth", "kir")).resolves.toBeNull();
    await expect(resolveRealmInviter("eurth", "nobody")).resolves.toBeNull();
  });

  it("name a handle-less inviter by the chain, leaving a hidden wiki name out", async () => {
    const handleless = row("db_kir", { forumUsername: "Kir Forum" });
    usersTable([handleless]);
    mocked.country.findFirst.mockResolvedValue({ id: "c1" });
    await expect(resolveRealmInviter("eurth", "Kir Forum")).resolves.toEqual({
      handle: "Kir Forum",
      displayName: "Kir Forum",
    });
    claimsTable([claim("db_kir", "Kir Wiki")]);
    await expect(resolveRealmInviter("eurth", handleless.clerkUserId)).resolves.toMatchObject({
      handle: "Kir Wiki",
    });
    // With wiki attribution off, the chain names the inviter by their other name.
    privacyOf(handleless, { showWikiAttribution: false });
    await expect(resolveRealmInviter("eurth", handleless.clerkUserId)).resolves.toEqual({
      handle: "Kir Forum",
      displayName: "Kir Forum",
    });
  });

  it("count the holder's distinct approved recruits, and zero without a user or on a failed count", async () => {
    mocked.realmClaim.findMany.mockResolvedValue([{ userId: "p1" }, { userId: "p2" }]);
    await expect(loadRecruitedCount("db_kir")).resolves.toBe(2);
    expect(mocked.realmClaim.findMany).toHaveBeenCalledWith({
      where: { invitedByUserId: "db_kir", status: "approved" },
      distinct: ["userId"],
      select: { userId: true },
    });
    await expect(loadRecruitedCount(undefined)).resolves.toBe(0);
    mocked.realmClaim.findMany.mockRejectedValue(new Error("db down"));
    await expect(loadRecruitedCount("db_kir")).resolves.toBe(0);
  });
});

describe("held nations and realm roles", () => {
  interface RealmRow {
    id: string;
    visibility: string;
    status: string;
  }
  interface CountryRow {
    id: string;
    leader: string | null;
    ownerUserId: string | null;
    realmId: string;
    realm: RealmRow | null;
  }
  type Condition = Partial<Record<keyof RealmRow, string>>;
  interface NationsWhere {
    ownerUserId: string;
    OR: Array<{ realmId?: string; realm?: { OR: Condition[] } }>;
  }
  const fits = (realm: RealmRow, condition: Condition) =>
    (Object.keys(condition) as Array<keyof RealmRow>).every((key) => realm[key] === condition[key]);
  /** A small stand-in for Postgres: applies the owner and realm-listing clauses the resolver sends. */
  const countryTable = (rows: CountryRow[]) =>
    mocked.country.findMany.mockImplementation(({ where }: { where: NationsWhere }) =>
      Promise.resolve(
        rows.filter(
          (r) =>
            r.ownerUserId === where.ownerUserId &&
            where.OR.some((clause) =>
              clause.realm
                ? Boolean(r.realm && clause.realm.OR.some((c) => fits(r.realm!, c)))
                : r.realmId === clause.realmId
            )
        )
      )
    );
  const nation = (id: string, overrides: Partial<CountryRow> = {}): CountryRow => ({
    id,
    leader: null,
    ownerUserId: "db_kir",
    realmId: "r1",
    realm: { id: "r1", visibility: "public", status: "active" },
    ...overrides,
  });
  const identity = (
    user: ResolvedIdentity["user"] | null = {
      id: "db_kir",
      clerkUserId: "clerk_kir",
      forumUsername: "Kir",
      wikiUsername: "Kir Wiki",
      countryId: "c_linked",
    } as ResolvedIdentity["user"]
  ): ResolvedIdentity => ({
    handle: "kir",
    strippedHandle: "kir",
    user,
    wikiName: null,
    forumUserId: null,
    forumUsername: null,
    isOwner: false,
  });

  it("are asked for by owner, in listed realms only (Ixnay whatever its row says)", async () => {
    countryTable([]);
    await resolveIdentityNations(identity());
    expect(mocked.country.findMany.mock.calls[0]![0].where).toEqual({
      ownerUserId: "db_kir",
      OR: [{ realmId: DEFAULT_REALM_ID }, { realm: DIRECTORY_REALM_WHERE }],
    });
  });

  it("never come from a matching leader name, the linked User.countryId, or a draft or unlisted realm", async () => {
    countryTable([
      nation("c_owned"),
      nation("c_named", { leader: "Kir", ownerUserId: null }),
      nation("c_linked", { ownerUserId: "someone_else" }),
      nation("c_draft", {
        realmId: "r2",
        realm: { id: "r2", visibility: "public", status: "draft" },
      }),
      nation("c_unlisted", {
        realmId: "r3",
        realm: { id: "r3", visibility: "unlisted", status: "active" },
      }),
      nation("c_ixnay", { realmId: DEFAULT_REALM_ID, realm: null }),
    ]);
    expect((await resolveIdentityNations(identity())).map((n) => n.id)).toEqual([
      "c_owned",
      "c_ixnay",
    ]);
    expect(await resolveIdentityNations(identity(null))).toEqual([]);
  });

  const held = (id: string, gdp: number, realmId = "default"): IdentityCountry => ({
    id,
    name: id,
    slug: id,
    flag: null,
    coatOfArms: null,
    continent: null,
    region: null,
    governmentType: null,
    currentPopulation: 1,
    currentTotalGdp: gdp,
    currentGdpPerCapita: 3,
    publicApproval: 61,
    realmId,
    realm:
      realmId === "default"
        ? { id: "default", name: "Ixnay", slug: "ixnay" }
        : { id: realmId, name: "Arathia", slug: "arathia" },
  });

  it("make the primary nation the linked one only when it is held, else the largest held", () => {
    const small = held("c_small", 10);
    const big = held("c_big", 500);
    expect(primaryNationOf([big, small], "c_small")?.id).toBe("c_small");
    expect(primaryNationOf([small, big], "c_elsewhere")?.id).toBe("c_big");
    expect(primaryNationOf([], "c_small")).toBeNull();
  });

  it("place default-realm nations in Ixnay, with the realm role, and never make anyone Ixnay's founder", async () => {
    const [ixnay, arathia] = toRealmMemberships(
      [held("c1", 2), held("c2", 1, "r9")],
      "c2",
      new Map([["r9", "founder" as const]])
    );
    expect(ixnay).toMatchObject({ id: "default", name: "Ixnay", role: "member", isPrimary: false });
    expect(arathia).toMatchObject({ id: "r9", role: "founder", isPrimary: true });

    mocked.realm.findMany.mockResolvedValue([
      { id: "r_own", ownerId: "clerk_kir", officers: [] },
      { id: "r_officer", ownerId: "clerk_other", officers: [{ id: "o1" }] },
      { id: DEFAULT_REALM_ID, ownerId: "clerk_kir", officers: [] },
    ]);
    const roles = await loadRealmRoles("clerk_kir", ["r_own", "r_officer", DEFAULT_REALM_ID]);
    expect(Object.fromEntries(roles)).toEqual({
      r_own: "founder",
      r_officer: "officer",
      [DEFAULT_REALM_ID]: "member",
    });
  });
});
