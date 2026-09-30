/** @jest-environment node */
// Plan 409: the rights engine (groups, role mapping, implicit autoconfirmed, expiry, pending links).
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiAccountLink: { findFirst: jest.fn() },
    wikiUserGroup: { findMany: jest.fn() },
    wikiBlock: { findMany: jest.fn() },
    wikiRevision: { count: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
}));

import { isWikiAdmin } from "~/lib/wiki-os/auth";
import {
  AUTOCONFIRM_AGE_MS,
  AUTOCONFIRM_EDIT_COUNT,
  BUREAUCRAT_CHANGEABLE_GROUPS,
  changeableGroups,
  getWikiPermissions,
  getWikiPermissionsForAuthId,
  resolveGroups,
  rightsForGroups,
  type GroupResolutionInput,
} from "~/lib/wiki-os/rights";
import { db } from "~/server/db";

const NOW = new Date("2026-09-30T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const FUTURE = new Date(NOW.getTime() + DAY);
const PAST = new Date(NOW.getTime() - DAY);

const input = (overrides: Partial<GroupResolutionInput> = {}): GroupResolutionInput => ({
  signedIn: true,
  accountCreatedAt: ago(DAY),
  editCount: 0,
  verifiedWikiUsername: null,
  explicitGroups: [],
  roleName: "user",
  isSystemOwner: false,
  now: NOW,
  ...overrides,
});

const groupsOf = (overrides: Partial<GroupResolutionInput> = {}) => [
  ...resolveGroups(input(overrides)),
];

describe("resolveGroups: implicit groups", () => {
  it("gives everyone `*` and only signed-in users `user`", () => {
    expect(groupsOf({ signedIn: false })).toEqual(["*"]);
    expect(groupsOf()).toEqual(["*", "user"]);
  });

  it("autoconfirms a verified wiki link immediately, however new the account", () => {
    expect(groupsOf({ verifiedWikiUsername: "Alice", accountCreatedAt: ago(1000) })).toContain(
      "autoconfirmed"
    );
  });

  it("autoconfirms an account that is old enough and has made enough edits", () => {
    const old = ago(AUTOCONFIRM_AGE_MS);
    expect(groupsOf({ accountCreatedAt: old, editCount: AUTOCONFIRM_EDIT_COUNT })).toContain(
      "autoconfirmed"
    );
  });

  it.each([
    ["too few edits", ago(AUTOCONFIRM_AGE_MS), AUTOCONFIRM_EDIT_COUNT - 1],
    ["too young", ago(AUTOCONFIRM_AGE_MS - 1), AUTOCONFIRM_EDIT_COUNT],
    ["unknown age", null, 500],
  ])("does not autoconfirm: %s", (_label, accountCreatedAt, editCount) => {
    expect(groupsOf({ accountCreatedAt, editCount })).not.toContain("autoconfirmed");
  });

  it("never autoconfirms someone who is signed out", () => {
    expect(groupsOf({ signedIn: false, verifiedWikiUsername: "Alice" })).toEqual(["*"]);
  });
});

describe("resolveGroups: explicit groups", () => {
  it("applies a current membership and ignores an expired one", () => {
    const explicitGroups = [
      { group: "bot", expiresAt: FUTURE },
      { group: "rollbacker", expiresAt: PAST },
      { group: "sysop", expiresAt: null },
    ];
    const groups = groupsOf({ explicitGroups });
    expect(groups).toEqual(expect.arrayContaining(["bot", "sysop"]));
    expect(groups).not.toContain("rollbacker");
  });

  it("ignores a group name it does not know", () => {
    expect(groupsOf({ explicitGroups: [{ group: "suppress", expiresAt: null }] })).toEqual([
      "*",
      "user",
    ]);
  });
});

describe("resolveGroups: the IxStates role mapping", () => {
  it("maps the owner role to sysop, bureaucrat and interface-admin", () => {
    expect(groupsOf({ roleName: "owner" })).toEqual(
      expect.arrayContaining(["sysop", "bureaucrat", "interface-admin"])
    );
  });

  it("treats a system owner as the owner role whatever role the row carries", () => {
    expect(groupsOf({ roleName: "user", isSystemOwner: true })).toEqual(
      expect.arrayContaining(["sysop", "bureaucrat", "interface-admin"])
    );
  });

  it("maps the admin role to sysop only", () => {
    const groups = groupsOf({ roleName: "Admin" });
    expect(groups).toContain("sysop");
    expect(groups).not.toContain("bureaucrat");
    expect(groups).not.toContain("interface-admin");
  });

  it.each(["user", "member", "staff", "constructor", "", null])(
    "gives role %p nothing extra",
    (roleName) => {
      expect(groupsOf({ roleName })).toEqual(["*", "user"]);
    }
  );
});

describe("rights per group", () => {
  const has = (groups: Parameters<typeof rightsForGroups>[0], right: string) =>
    (rightsForGroups(groups) as Set<string>).has(right);

  it("lets signed-out readers read and nothing else", () => {
    expect([...rightsForGroups(["*"])]).toEqual(["read"]);
  });

  it("holds move and upload back until autoconfirmed", () => {
    expect(has(["*", "user"], "edit")).toBe(true);
    expect(has(["*", "user"], "move")).toBe(false);
    expect(has(["*", "user", "autoconfirmed"], "move")).toBe(true);
    expect(has(["*", "user", "autoconfirmed"], "upload")).toBe(true);
  });

  it("gives sysop the admin rights but not the site script rights", () => {
    for (const right of [
      "delete",
      "undelete",
      "protect",
      "block",
      "editprotected",
      "editinterface",
      "rollback",
    ]) {
      expect(has(["sysop"], right)).toBe(true);
    }
    for (const right of ["editsitecss", "editsitejs", "editsitejson", "userrights"]) {
      expect(has(["sysop"], right)).toBe(false);
    }
  });

  it("gives interface-admin the script rights and bureaucrat the rights to change groups", () => {
    expect(has(["interface-admin"], "editsitejs")).toBe(true);
    expect(has(["interface-admin"], "delete")).toBe(false);
    expect(has(["bureaucrat"], "userrights")).toBe(true);
  });
});

describe("changeableGroups", () => {
  it("lists what a bureaucrat may change and nothing for anyone else", () => {
    expect(changeableGroups(rightsForGroups(["bureaucrat"]))).toEqual(BUREAUCRAT_CHANGEABLE_GROUPS);
    expect(changeableGroups(rightsForGroups(["sysop"]))).toEqual([]);
    expect(BUREAUCRAT_CHANGEABLE_GROUPS).toEqual(
      expect.arrayContaining(["bot", "sysop", "interface-admin", "bureaucrat", "autoconfirmed"])
    );
    expect(BUREAUCRAT_CHANGEABLE_GROUPS).not.toContain("rollbacker");
  });
});

// ---------------------------------------------------------------------------
// getWikiPermissions: the database side
// ---------------------------------------------------------------------------

type KeyClause = { userId?: string; wikiUsername?: string };
interface Row extends KeyClause {
  group?: string;
  reason?: string | null;
  allowUserTalk?: boolean;
  expiresAt: Date | null;
}

const mockDb = db as unknown as {
  wikiAccountLink: { findFirst: jest.Mock };
  wikiUserGroup: { findMany: jest.Mock };
  wikiBlock: { findMany: jest.Mock };
  wikiRevision: { count: jest.Mock };
  user: { findUnique: jest.Mock };
};

let groupRows: Row[] = [];
let blockRows: Row[] = [];

/** A findMany that honours `where: { OR: [{ userId }, { wikiUsername }] }`. */
const fakeFindMany =
  (rows: () => Row[]) =>
  async ({ where }: { where: { OR: KeyClause[] } }) =>
    rows().filter((row) =>
      where.OR.some(
        (key) =>
          (key.userId !== undefined && row.userId === key.userId) ||
          (key.wikiUsername !== undefined && row.wikiUsername === key.wikiUsername)
      )
    );

const ctxFor = (
  overrides: {
    role?: string;
    createdAt?: Date | null;
    clerk?: string;
    internal?: string | null;
  } = {}
) => ({
  auth: { userId: overrides.clerk ?? "user_1" },
  user: {
    id: overrides.internal === undefined ? "db1" : overrides.internal,
    clerkUserId: overrides.clerk ?? "user_1",
    role: { name: overrides.role ?? "user" },
    createdAt: overrides.createdAt === undefined ? ago(DAY) : overrides.createdAt,
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
  groupRows = [];
  blockRows = [];
  mockDb.wikiAccountLink.findFirst.mockResolvedValue(null);
  mockDb.wikiUserGroup.findMany.mockImplementation(fakeFindMany(() => groupRows));
  mockDb.wikiBlock.findMany.mockImplementation(fakeFindMany(() => blockRows));
  mockDb.wikiRevision.count.mockResolvedValue(0);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("getWikiPermissions", () => {
  it("gives a signed-out caller read only, without touching the database", async () => {
    const perms = await getWikiPermissions({ auth: null, user: null });
    expect(perms.groups).toEqual(["*"]);
    expect([...perms.rights]).toEqual(["read"]);
    expect(perms.block).toBeNull();
    expect(mockDb.wikiUserGroup.findMany).not.toHaveBeenCalled();
    expect(mockDb.wikiBlock.findMany).not.toHaveBeenCalled();
  });

  it("applies an explicit group row keyed by the WikiOS user id", async () => {
    groupRows = [{ userId: "db1", group: "bot", expiresAt: null }];
    const perms = await getWikiPermissions(ctxFor());
    expect(perms.groups).toContain("bot");
    expect(perms.rights.has("bot")).toBe(true);
  });

  it("applies a group imported for a wiki username only once that link is verified", async () => {
    groupRows = [{ wikiUsername: "Alice", group: "sysop", expiresAt: null }];

    const beforeLink = await getWikiPermissions(ctxFor());
    expect(beforeLink.groups).not.toContain("sysop");
    expect(beforeLink.rights.has("delete")).toBe(false);

    mockDb.wikiAccountLink.findFirst.mockResolvedValue({ username: "Alice" });
    const afterLink = await getWikiPermissions(ctxFor());
    expect(afterLink.groups).toEqual(expect.arrayContaining(["sysop", "autoconfirmed"]));
    expect(afterLink.rights.has("delete")).toBe(true);
    expect(afterLink.verifiedWikiUsername).toBe("Alice");
  });

  it("ignores an expired explicit group", async () => {
    groupRows = [{ userId: "db1", group: "sysop", expiresAt: PAST }];
    expect((await getWikiPermissions(ctxFor())).groups).not.toContain("sysop");
  });

  it("maps the IxStates role and a system owner to groups", async () => {
    expect((await getWikiPermissions(ctxFor({ role: "admin" }))).groups).toContain("sysop");
    const owner = await getWikiPermissions(ctxFor({ role: "user", clerk: "user_owner" }));
    expect(owner.groups).toEqual(
      expect.arrayContaining(["sysop", "bureaucrat", "interface-admin"])
    );
    expect(owner.rights.has("editsitejs")).toBe(true);
  });

  it("autoconfirms by age and edit count, counting edits only for an old enough account", async () => {
    mockDb.wikiRevision.count.mockResolvedValue(AUTOCONFIRM_EDIT_COUNT);
    const old = await getWikiPermissions(ctxFor({ createdAt: ago(AUTOCONFIRM_AGE_MS + DAY) }));
    expect(old.groups).toContain("autoconfirmed");
    expect(mockDb.wikiRevision.count).toHaveBeenCalledWith({ where: { authorId: "db1" } });

    mockDb.wikiRevision.count.mockClear();
    const young = await getWikiPermissions(ctxFor({ createdAt: ago(DAY) }));
    expect(young.groups).not.toContain("autoconfirmed");
    expect(mockDb.wikiRevision.count).not.toHaveBeenCalled();
  });

  it("does not count edits for an account with a verified link", async () => {
    mockDb.wikiAccountLink.findFirst.mockResolvedValue({ username: "Alice" });
    await getWikiPermissions(ctxFor({ createdAt: ago(30 * DAY) }));
    expect(mockDb.wikiRevision.count).not.toHaveBeenCalled();
  });

  it("loads once per request context", async () => {
    const ctx = ctxFor();
    await Promise.all([getWikiPermissions(ctx), getWikiPermissions(ctx)]);
    await getWikiPermissions(ctx);
    expect(mockDb.wikiUserGroup.findMany).toHaveBeenCalledTimes(1);
    await getWikiPermissions(ctxFor());
    expect(mockDb.wikiUserGroup.findMany).toHaveBeenCalledTimes(2);
  });
});

describe("getWikiPermissions: blocks", () => {
  it("reports an active block by user id and ignores an expired one", async () => {
    blockRows = [
      { userId: "db1", reason: "old", expiresAt: PAST, allowUserTalk: true },
      { userId: "db1", reason: "spam", expiresAt: FUTURE, allowUserTalk: true },
    ];
    expect((await getWikiPermissions(ctxFor())).block).toEqual({
      reason: "spam",
      expiresAt: FUTURE,
      allowUserTalk: true,
    });

    blockRows = [{ userId: "db1", reason: "old", expiresAt: PAST, allowUserTalk: true }];
    expect((await getWikiPermissions(ctxFor())).block).toBeNull();
  });

  it("finds a block placed on the wiki username of a verified link", async () => {
    mockDb.wikiAccountLink.findFirst.mockResolvedValue({ username: "Alice" });
    blockRows = [{ wikiUsername: "Alice", reason: null, expiresAt: null, allowUserTalk: false }];
    expect((await getWikiPermissions(ctxFor())).block).toEqual({
      reason: null,
      expiresAt: null,
      allowUserTalk: false,
    });
  });

  it("ignores a block on a wiki username the user has not verified", async () => {
    blockRows = [{ wikiUsername: "Alice", reason: null, expiresAt: null, allowUserTalk: false }];
    expect((await getWikiPermissions(ctxFor())).block).toBeNull();
  });

  it("merges several blocks: indefinite wins and user talk survives only if all allow it", async () => {
    blockRows = [
      { userId: "db1", reason: "a", expiresAt: FUTURE, allowUserTalk: true },
      { userId: "db1", reason: "b", expiresAt: null, allowUserTalk: false },
    ];
    expect((await getWikiPermissions(ctxFor())).block).toEqual({
      reason: "a",
      expiresAt: null,
      allowUserTalk: false,
    });
  });
});

describe("isWikiAdmin", () => {
  it("is true for a sysop (through the admin role or an explicit group) and false for anyone else", async () => {
    expect(await isWikiAdmin(ctxFor({ role: "admin" }))).toBe(true);
    expect(await isWikiAdmin(ctxFor({ clerk: "user_owner" }))).toBe(true);
    expect(await isWikiAdmin(ctxFor())).toBe(false);
    groupRows = [{ userId: "db1", group: "sysop", expiresAt: null }];
    expect(await isWikiAdmin(ctxFor())).toBe(true);
  });

  it("is false for an interface-admin who is not a sysop (editprotected is the admin right)", async () => {
    groupRows = [{ userId: "db1", group: "interface-admin", expiresAt: null }];
    expect(await isWikiAdmin(ctxFor())).toBe(false);
  });
});

describe("getWikiPermissionsForAuthId (callers without a request context)", () => {
  it("loads the user row and applies the role mapping and explicit groups", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "db9",
      clerkUserId: "user_9",
      createdAt: ago(DAY),
      role: { id: "r1", name: "admin", level: 10 },
    });
    groupRows = [{ userId: "db9", group: "bot", expiresAt: null }];

    const perms = await getWikiPermissionsForAuthId("user_9");

    expect(mockDb.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkUserId: "user_9" } })
    );
    expect(perms.groups).toEqual(expect.arrayContaining(["sysop", "bot"]));
    expect(perms.rights.has("import")).toBe(true);
  });

  it("gives a signed-in account with no user row only what being signed in gives", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    const perms = await getWikiPermissionsForAuthId("user_unknown");
    expect(perms.groups).toEqual(["*", "user"]);
    expect(perms.rights.has("import")).toBe(false);
  });

  it("recognises a system owner by their account id", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    expect((await getWikiPermissionsForAuthId("user_owner")).rights.has("import")).toBe(true);
  });
});
