/** @jest-environment node */
/**
 * IxStates Passport nations and realm roles: a nation is held only through `Country.ownerUserId`,
 * only in realms the directory lists, and each realm row carries the holder's realm role.
 */
jest.mock("~/server/db", () => {
  const db = {
    country: { findMany: jest.fn() },
    realm: { findMany: jest.fn() },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

jest.mock("~/lib/wiki-os/adapters/ixstates/user-sync", () => ({
  lookupWikiUser: jest.fn().mockResolvedValue(null),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";
import { resolveIdentityNations } from "~/server/modules/identity/identity.resolve";
import { loadRealmRoles } from "~/server/modules/identity/identity.realm-roles";
import type { ResolvedIdentity } from "~/server/modules/identity/identity.types";

const mocked = db as unknown as {
  country: { findMany: jest.Mock };
  realm: { findMany: jest.Mock };
};

interface RealmRow {
  id: string;
  visibility: string;
  status: string;
}

interface CountryRow {
  id: string;
  name: string;
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

const fits = (row: RealmRow, condition: Condition) =>
  (Object.keys(condition) as Array<keyof RealmRow>).every((key) => row[key] === condition[key]);

/** A small stand-in for Postgres: applies the owner and realm-listing clauses the resolver sends. */
function countryTable(rows: CountryRow[]) {
  mocked.country.findMany.mockImplementation((args: { where: NationsWhere }) => {
    const { ownerUserId, OR } = args.where;
    const listed = (row: CountryRow) =>
      OR.some((clause) =>
        clause.realm
          ? Boolean(row.realm && clause.realm.OR.some((c) => fits(row.realm!, c)))
          : row.realmId === clause.realmId
      );
    return Promise.resolve(rows.filter((row) => row.ownerUserId === ownerUserId && listed(row)));
  });
}

const publicRealm = (id: string): RealmRow => ({ id, visibility: "public", status: "active" });

function nation(id: string, overrides: Partial<CountryRow> = {}): CountryRow {
  return {
    id,
    name: id,
    leader: null,
    ownerUserId: "db_kir",
    realmId: "r1",
    realm: publicRealm("r1"),
    ...overrides,
  };
}

function identityOf(overrides: Partial<ResolvedIdentity> = {}): ResolvedIdentity {
  return {
    handle: "kir",
    strippedHandle: "kir",
    user: {
      id: "db_kir",
      clerkUserId: "clerk_kir",
      forumUsername: "Kir",
      wikiUsername: "Kir Wiki",
      countryId: "c_linked",
    } as ResolvedIdentity["user"],
    country: null,
    wikiName: null,
    forumUserId: null,
    forumUsername: null,
    isOwner: false,
    ...overrides,
  };
}

beforeEach(() => {
  mocked.country.findMany.mockReset();
  mocked.realm.findMany.mockReset().mockResolvedValue([]);
});

describe("resolveIdentityNations", () => {
  it("asks only for owned nations in listed realms (IxWorld whatever its row says)", async () => {
    countryTable([]);
    await resolveIdentityNations(identityOf());
    expect(mocked.country.findMany.mock.calls[0]![0].where).toEqual({
      ownerUserId: "db_kir",
      OR: [{ realmId: DEFAULT_REALM_ID }, { realm: DIRECTORY_REALM_WHERE }],
    });
  });

  it("does not list a nation whose leader name matches the user but that nobody owns", async () => {
    countryTable([
      nation("c_owned"),
      nation("c_named", { leader: "Kir", ownerUserId: null }),
      nation("c_wiki", { leader: "kir wiki", ownerUserId: null }),
    ]);
    const nations = await resolveIdentityNations(identityOf());
    expect(nations.map((n) => n.id)).toEqual(["c_owned"]);
  });

  it("does not treat the linked User.countryId or identity.country as held", async () => {
    countryTable([nation("c_linked", { ownerUserId: "someone_else" })]);
    const country = { id: "c_linked" } as ResolvedIdentity["country"];
    expect(await resolveIdentityNations(identityOf({ country }))).toEqual([]);
  });

  it("returns no nations for an identity without a user", async () => {
    const country = { id: "c_linked" } as ResolvedIdentity["country"];
    expect(await resolveIdentityNations(identityOf({ user: null, country }))).toEqual([]);
    expect(mocked.country.findMany).not.toHaveBeenCalled();
  });

  it("leaves out nations in draft and unlisted realms", async () => {
    countryTable([
      nation("c_public"),
      nation("c_draft", {
        realmId: "r2",
        realm: { id: "r2", visibility: "public", status: "draft" },
      }),
      nation("c_unlisted", {
        realmId: "r3",
        realm: { id: "r3", visibility: "unlisted", status: "active" },
      }),
      nation("c_ixworld", { realmId: DEFAULT_REALM_ID, realm: null }),
    ]);
    const nations = await resolveIdentityNations(identityOf());
    expect(nations.map((n) => n.id)).toEqual(["c_public", "c_ixworld"]);
  });
});

describe("loadRealmRoles", () => {
  it("is founder of a realm they own, officer where appointed, member elsewhere", async () => {
    mocked.realm.findMany.mockResolvedValue([
      { id: "r_own", ownerId: "clerk_kir", officers: [] },
      { id: "r_officer", ownerId: "clerk_other", officers: [{ id: "o1" }] },
      { id: "r_member", ownerId: "clerk_other", officers: [] },
    ]);
    const roles = await loadRealmRoles("clerk_kir", ["r_own", "r_officer", "r_member", "r_own"]);
    expect(roles.get("r_own")).toBe("founder");
    expect(roles.get("r_officer")).toBe("officer");
    expect(roles.get("r_member")).toBe("member");
    expect(mocked.realm.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["r_own", "r_officer", "r_member"] } },
      select: {
        id: true,
        ownerId: true,
        officers: { where: { userId: "clerk_kir" }, select: { id: true } },
      },
    });
  });

  it("never makes anyone founder of IxWorld", async () => {
    mocked.realm.findMany.mockResolvedValue([
      { id: DEFAULT_REALM_ID, ownerId: "clerk_kir", officers: [] },
    ]);
    const roles = await loadRealmRoles("clerk_kir", [DEFAULT_REALM_ID]);
    expect(roles.get(DEFAULT_REALM_ID)).toBe("member");
  });

  it("skips the query when there are no realms", async () => {
    expect((await loadRealmRoles("clerk_kir", [])).size).toBe(0);
    expect(mocked.realm.findMany).not.toHaveBeenCalled();
  });
});
