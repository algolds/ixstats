/** @jest-environment node */
/**
 * The rights table (plan 409): who gets which right (groups, the role mapping, a system owner, implicit autoconfirmed,
 * expiry, imported groups passing only through a claim a system owner decided, blocks following every approved claim),
 * which namespaces and interface pages each group may edit (never Special or Media, user scripts only their owner's,
 * site scripts only interface admins, the own user page being the handle's and every claimed name's), and how a page's
 * protection levels gate edit, move and upload.
 */
const mockDb = db as unknown as {
  wikiNameClaim: { findMany: jest.Mock; findFirst: jest.Mock };
  wikiUserGroup: { findMany: jest.Mock };
  wikiBlock: { findMany: jest.Mock };
  wikiRevision: { count: jest.Mock };
  user: { findUnique: jest.Mock };
};
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiNameClaim: { findMany: jest.fn(), findFirst: jest.fn() },
    wikiUserGroup: { findMany: jest.fn() },
    wikiBlock: { findMany: jest.fn() },
    wikiRevision: { count: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: jest.fn((id: string) => id === "user_owner"),
  SYSTEM_OWNER_IDS: ["user_owner"],
}));

import { isWikiAdmin } from "~/lib/wiki-os/auth";
import {
  AUTOCONFIRM_AGE_MS,
  AUTOCONFIRM_EDIT_COUNT,
  BUREAUCRAT_CHANGEABLE_GROUPS,
  changeableGroups,
  getWikiPermissions,
  getWikiPermissionsForAuthId,
  type Group,
  type GroupResolutionInput,
  loadTargetPermissions,
  resolveGroups,
  type Right,
  rightsForGroups,
  type WikiPermissions,
} from "~/lib/wiki-os/rights";
import { isSystemOwner } from "~/lib/auth";
import { db } from "~/server/db";
import {
  checkEditPolicy,
  type EditPolicyIdentity,
  parseWikiTitle,
} from "~/lib/wiki-os/namespace-policy";
import { decideAction, type PageRestriction } from "~/lib/wiki-os/permissions";

const NOW = new Date("2026-09-30T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const FUTURE = new Date(NOW.getTime() + DAY);
const PAST = new Date(NOW.getTime() - DAY);

const input = (overrides: Partial<GroupResolutionInput> = {}): GroupResolutionInput => ({
  signedIn: true,
  accountCreatedAt: ago(DAY),
  editCount: 0,
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
    expect(
      groupsOf({
        signedIn: false,
        accountCreatedAt: ago(AUTOCONFIRM_AGE_MS),
        editCount: AUTOCONFIRM_EDIT_COUNT,
      })
    ).toEqual(["*"]);
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

/** The approved claims `namesOfUser` reads for `userId`: each name, and whether a system owner decided it (`rightsPass`). */
const claimsOf = (
  userId: string,
  rows: Array<{ name: string; rightsPass: boolean; visible?: boolean }>
) =>
  mockDb.wikiNameClaim.findMany.mockResolvedValue(
    rows.map((row, i) => ({
      id: `c${i}`,
      userId,
      name: row.name,
      visible: row.visible ?? true,
      rightsPass: row.rightsPass,
      decidedAt: NOW,
      mwUserId: null,
    }))
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
  mockDb.user.findUnique.mockResolvedValue(null);
  groupRows = [];
  blockRows = [];
  mockDb.wikiNameClaim.findMany.mockResolvedValue([]);
  mockDb.wikiNameClaim.findFirst.mockResolvedValue(null);
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

  it("applies a group imported for a wiki username only once a system owner's claim gives the name to the account", async () => {
    groupRows = [{ wikiUsername: "Alice", group: "sysop", expiresAt: null }];

    const beforeClaim = await getWikiPermissions(ctxFor());
    expect(beforeClaim.groups).not.toContain("sysop");
    expect(beforeClaim.rights.has("delete")).toBe(false);

    claimsOf("db1", [{ name: "Alice", rightsPass: true }]);
    const afterClaim = await getWikiPermissions(ctxFor());
    expect(afterClaim.groups).toContain("sysop");
    expect(afterClaim.rights.has("delete")).toBe(true);
    expect(afterClaim.ownUserNames).toEqual(["Alice"]);
    expect(mockDb.wikiNameClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: "ixwiki", userId: { in: ["db1"] }, status: "APPROVED" },
      })
    );
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

  it("never autoconfirms from a claimed name alone: the MediaWiki account's age is not read (design decision 6)", async () => {
    claimsOf("db1", [{ name: "Alice", rightsPass: true }]);
    const young = await getWikiPermissions(ctxFor({ createdAt: ago(1000) }));
    expect(young.groups).not.toContain("autoconfirmed");

    // the revisions a claim tagged carry the account's id, so WikiOS's own rule counts them
    mockDb.wikiRevision.count.mockResolvedValue(AUTOCONFIRM_EDIT_COUNT);
    const aged = await getWikiPermissions(ctxFor({ createdAt: ago(AUTOCONFIRM_AGE_MS + DAY) }));
    expect(aged.groups).toContain("autoconfirmed");
    expect(mockDb.wikiRevision.count).toHaveBeenCalledWith({ where: { authorId: "db1" } });
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

  it("finds a block placed on a name the account holds, whoever approved the claim", async () => {
    claimsOf("db1", [{ name: "Alice", rightsPass: false }]);
    blockRows = [{ wikiUsername: "Alice", reason: null, expiresAt: null, allowUserTalk: false }];
    expect((await getWikiPermissions(ctxFor())).block).toEqual({
      reason: null,
      expiresAt: null,
      allowUserTalk: false,
    });
  });

  it("ignores a block on a wiki username the account does not hold", async () => {
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

describe("loadTargetPermissions (someone else's profile)", () => {
  it("maps a system owner from the configured ids without the audit-logging isSystemOwner", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      createdAt: ago(DAY),
      clerkUserId: "user_owner",
      role: { name: "user" },
    });

    const perms = await loadTargetPermissions({ userId: "db7", wikiUsername: "Boss" });

    expect(perms.groups).toEqual(
      expect.arrayContaining(["sysop", "bureaucrat", "interface-admin"])
    );
    expect(isSystemOwner).not.toHaveBeenCalled();
  });

  it("gives a claiming ordinary user only being signed in, and a wiki username nobody holds only its explicit groups", async () => {
    claimsOf("db8", [{ name: "Plain", rightsPass: false }]);
    mockDb.user.findUnique.mockResolvedValue({
      createdAt: ago(DAY),
      clerkUserId: "user_plain",
      handle: null,
      role: { name: "user" },
    });
    expect((await loadTargetPermissions({ userId: "db8", wikiUsername: "Plain" })).groups).toEqual([
      "*",
      "user",
    ]);

    groupRows = [{ wikiUsername: "Pending", group: "bot", expiresAt: null }];
    const pending = await loadTargetPermissions({ userId: null, wikiUsername: "Pending" });
    expect(pending.groups).toEqual(["*", "bot"]);
    expect(mockDb.user.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe("imported rows attach only through a claim a system owner decided (plan 409 review)", () => {
  const PENDING_SYSOP = { wikiUsername: "Alice", group: "sysop", expiresAt: null };
  const PENDING_BLOCK = {
    wikiUsername: "Alice",
    reason: "spam",
    expiresAt: null,
    allowUserTalk: false,
  };

  it("attaches groups and blocks to a claim a system owner approved or linked (rightsPass)", async () => {
    groupRows = [PENDING_SYSOP];
    blockRows = [PENDING_BLOCK];
    claimsOf("db1", [{ name: "Alice", rightsPass: true }]);

    const perms = await getWikiPermissions(ctxFor());
    expect(perms.groups).toContain("sysop");
    expect(perms.block).not.toBeNull();
  });

  it("does NOT pass imported groups through a claim an ordinary admin approved: the reviewer's exploit gains nothing", async () => {
    groupRows = [
      { wikiUsername: "Mwbureaucrat", group: "bureaucrat", expiresAt: null },
      { wikiUsername: "Mwbureaucrat", group: "sysop", expiresAt: null },
      { wikiUsername: "Mwbureaucrat", group: "interface-admin", expiresAt: null },
    ];
    blockRows = [{ ...PENDING_BLOCK, wikiUsername: "Mwbureaucrat" }];
    // a staff member approved (or linked) an unclaimed wiki bureaucrat's name to an account
    claimsOf("db1", [{ name: "Mwbureaucrat", rightsPass: false }]);

    const perms = await getWikiPermissions(ctxFor());

    expect(perms.ownUserNames).toEqual(["Mwbureaucrat"]); // the name is theirs
    expect(perms.groups).toEqual(["*", "user"]);
    expect(perms.rights.has("userrights")).toBe(false);
    expect(perms.rights.has("delete")).toBe(false);
    expect(perms.rights.has("editsitejs")).toBe(false);
    expect(perms.block).toMatchObject({ reason: "spam" }); // the block follows the name
  });

  it("passes groups only through the names a system owner decided, when an account holds several", async () => {
    groupRows = [
      { wikiUsername: "Old sysop", group: "sysop", expiresAt: null },
      { wikiUsername: "Old bot", group: "bot", expiresAt: null },
    ];
    claimsOf("db1", [
      { name: "Old sysop", rightsPass: false },
      { name: "Old bot", rightsPass: true },
    ]);

    const perms = await getWikiPermissions(ctxFor());
    expect(perms.groups).toContain("bot");
    expect(perms.groups).not.toContain("sysop");
  });

  it("never attaches imported rows through the passport handle, even one that spells an imported sysop's name", async () => {
    groupRows = [{ wikiUsername: "Old sysop", group: "sysop", expiresAt: null }];
    blockRows = [{ ...PENDING_BLOCK, wikiUsername: "Old sysop" }];
    mockDb.user.findUnique.mockResolvedValue({ handle: "old_sysop" });

    const perms = await getWikiPermissions(ctxFor());
    expect(perms.ownUserNames).toEqual(["old_sysop"]);
    expect(perms.groups).not.toContain("sysop");
    expect(perms.block).toBeNull();
  });

  it("still applies rows keyed by the user id, whoever decided the claims", async () => {
    groupRows = [{ userId: "db1", group: "bot", expiresAt: null }];
    blockRows = [{ userId: "db1", reason: "x", expiresAt: null, allowUserTalk: true }];
    claimsOf("db1", [{ name: "Alice", rightsPass: false }]);

    const perms = await getWikiPermissions(ctxFor());
    expect(perms.groups).toContain("bot");
    expect(perms.block).not.toBeNull();
  });

  it("applies the same rule to the permissions shown for another user", async () => {
    groupRows = [PENDING_SYSOP];
    claimsOf("db1", [{ name: "Alice", rightsPass: false }]);
    mockDb.user.findUnique.mockResolvedValue({
      createdAt: ago(DAY),
      clerkUserId: "user_1",
      handle: null,
      role: { name: "user" },
    });

    const perms = await loadTargetPermissions({ userId: "db1", wikiUsername: "Alice" });
    expect(perms.groups).not.toContain("sysop");

    claimsOf("db1", [{ name: "Alice", rightsPass: true }]);
    expect(
      (await loadTargetPermissions({ userId: "db1", wikiUsername: "Alice" })).groups
    ).toContain("sysop");
  });
});

describe("imported rights and blocks through claims (plan 409, design decision 5)", () => {
  const claims = (rows: Array<{ name: string; rightsPass: boolean }>) => claimsOf("u1", rows);

  it("passes a name's imported groups only through a claim a system owner decided", async () => {
    claims([{ name: "Old sysop", rightsPass: false }]);
    await loadTargetPermissions({ userId: "u1", wikiUsername: "x" }, NOW);
    expect(mockDb.wikiUserGroup.findMany.mock.calls[0]![0].where.OR).toEqual([{ userId: "u1" }]);
    claims([{ name: "Old sysop", rightsPass: true }]);
    await loadTargetPermissions({ userId: "u1", wikiUsername: "x" }, NOW);
    expect(mockDb.wikiUserGroup.findMany.mock.calls[1]![0].where.OR).toEqual([
      { userId: "u1" },
      { wikiUsername: "Old sysop" },
    ]);
  });

  it("lets every approved name's blocks follow it, whoever approved it", async () => {
    claims([{ name: "Old sysop", rightsPass: false }]);
    await loadTargetPermissions({ userId: "u1", wikiUsername: "x" }, NOW);
    expect(mockDb.wikiBlock.findMany.mock.calls[0]![0].where.OR).toEqual([
      { userId: "u1" },
      { wikiUsername: "Old sysop" },
    ]);
  });

  it("keys a name nobody holds by the name itself, for groups and blocks", async () => {
    await loadTargetPermissions({ userId: null, wikiUsername: "Nobody" }, NOW);
    expect(mockDb.wikiUserGroup.findMany.mock.calls[0]![0].where.OR).toEqual([
      { wikiUsername: "Nobody" },
    ]);
    expect(mockDb.wikiBlock.findMany.mock.calls[0]![0].where.OR).toEqual([
      { wikiUsername: "Nobody" },
    ]);
  });

  it("normalizes a name nobody holds as MediaWiki does", async () => {
    await loadTargetPermissions({ userId: null, wikiUsername: "old_vandal" }, NOW);
    expect(mockDb.wikiBlock.findMany.mock.calls[0]![0].where.OR).toEqual([
      { wikiUsername: "Old vandal" },
    ]);
  });
});

describe("the own user page", () => {
  it("is the handle's page and every claimed name's page", () => {
    const identity: EditPolicyIdentity = {
      rights: new Set(["edit"]),
      ownUserNames: ["alpha", "Old name"],
    };
    expect(checkEditPolicy("User:Alpha", identity).allowed).toBe(true);
    expect(checkEditPolicy("User:Old_name/Sandbox", identity).allowed).toBe(true);
    expect(checkEditPolicy("User:Someone", identity).allowed).toBe(false);
  });

  it("lists the handle and every approved claim, hidden ones included", async () => {
    mockDb.user.findUnique.mockResolvedValue({ handle: "alpha" });
    claimsOf("db1", [
      { name: "Old name", rightsPass: false },
      { name: "Private name", rightsPass: false, visible: false },
    ]);
    expect((await getWikiPermissions(ctxFor())).ownUserNames).toEqual([
      "alpha",
      "Old name",
      "Private name",
    ]);
    expect(mockDb.wikiNameClaim.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { source: "ixwiki", name: "Alpha", status: "APPROVED" } })
    );
  });

  it("leaves out the handle when another account holds that name", async () => {
    mockDb.user.findUnique.mockResolvedValue({ handle: "alpha" });
    mockDb.wikiNameClaim.findFirst.mockResolvedValue({ userId: "someone-else" });
    claimsOf("db1", [{ name: "Old name", rightsPass: false }]);
    expect((await getWikiPermissions(ctxFor())).ownUserNames).toEqual(["Old name"]);
  });

  it("keeps the handle when the account itself holds that name", async () => {
    mockDb.user.findUnique.mockResolvedValue({ handle: "alpha" });
    mockDb.wikiNameClaim.findFirst.mockResolvedValue({ userId: "db1" });
    expect((await getWikiPermissions(ctxFor())).ownUserNames).toEqual(["alpha"]);
  });

  it("is nobody's for a signed-out caller, who has no handle or claims", async () => {
    expect((await getWikiPermissions({ auth: null, user: null })).ownUserNames).toEqual([]);
    expect(mockDb.wikiNameClaim.findMany).not.toHaveBeenCalled();
  });
});

describe("namespaces and interface pages", () => {
  // Plan 409: the policy asks for rights, not for "is admin". These are the rights of the groups that matter.
  const userRights: ReadonlySet<Right> = new Set<Right>(["edit", "createpage", "createtalk"]);
  const sysopRights: ReadonlySet<Right> = new Set<Right>([
    ...userRights,
    "editprotected",
    "editinterface",
  ]);
  const interfaceAdminRights: readonly Right[] = [
    "editinterface",
    "editsitecss",
    "editsitejs",
    "editsitejson",
    "editusercss",
    "edituserjs",
    "edituserjson",
  ];
  /** The owner role: sysop + interface-admin. */
  const adminRights: ReadonlySet<Right> = new Set<Right>([...sysopRights, ...interfaceAdminRights]);

  const user = { rights: userRights, ownUserNames: ["Alice"] };
  const unlinked = { rights: userRights, ownUserNames: [] };
  const sysop = { rights: sysopRights, ownUserNames: [] };
  const interfaceAdmin = {
    rights: new Set<Right>([...userRights, ...interfaceAdminRights]),
    ownUserNames: [],
  };
  const admin = { rights: adminRights, ownUserNames: [] };

  const allowed = (title: string, identity: EditPolicyIdentity = user) =>
    checkEditPolicy(title, identity).allowed;

  describe("parseWikiTitle", () => {
    it("refuses titles that hide a prefix behind character references, and empty titles", () => {
      expect(parseWikiTitle("Template&#58;Foo")).toBeNull();
      expect(parseWikiTitle("Module&colon;Foo")).toBeNull();
      expect(parseWikiTitle("  :  ")).toBeNull();
    });

    it("folds unicode spaces and invisible marks", () => {
      expect(parseWikiTitle("Template\u00A0:Foo")?.namespaceId).toBe(10);
      expect(parseWikiTitle("Mod\u200Bule:Foo")?.namespaceId).toBe(828);
    });
  });

  describe("checkEditPolicy: ordinary users", () => {
    it("may edit main-namespace articles and talk pages", () => {
      expect(allowed("Caphiria")).toBe(true);
      expect(allowed("Star Wars: A Story")).toBe(true);
      expect(allowed("Talk:Caphiria")).toBe(true);
      expect(allowed("User talk:Somebody")).toBe(true);
      expect(allowed("Template talk:Infobox")).toBe(true);
      expect(allowed("Campaign talk:Operation Dawn")).toBe(true);
    });

    it("treats Portal: as a main-namespace title, as IxWiki does (it has no Portal namespace)", () => {
      expect(allowed("Portal:Eurth")).toBe(true);
    });

    it.each([
      "Template:Infobox country",
      "Module:Foo",
      "MediaWiki:Common.js",
      "MediaWiki:Sidebar",
      "Help:Editing",
      "Category:Nations",
      "File:Flag.png",
      "Image:Flag.png",
      "IxWiki:Policy",
      "Project:Policy",
      "Gadget:Foo",
      "Gadget definition:Foo",
      "MediaWiki talk:Common.js",
      "Module talk:Foo",
      "Widget:Foo",
      "Campaign:Operation Dawn",
      "campaign : Operation Dawn",
      ":Template:Foo",
      "template:foo",
      "TEMPLATE:foo",
      "Template :foo",
      "Template:Foo/Module:Bar",
      "Template\u00A0:Foo",
      "Template&#58;Foo",
      "Mod&#x75;le:Foo",
    ])("cannot edit %s", (title) => {
      expect(allowed(title)).toBe(false);
    });

    it("can never edit Special or Media pages, even as admin", () => {
      expect(allowed("Special:Version", admin)).toBe(false);
      expect(allowed("Media:Foo.png", admin)).toBe(false);
    });

    it("may edit only their own user page", () => {
      expect(allowed("User:Alice")).toBe(true);
      expect(allowed("user:alice")).toBe(true); // first letter is case-insensitive
      expect(allowed("User:ALICE")).toBe(false);
      expect(allowed("User:Alice/Sandbox")).toBe(true);
      expect(allowed("User:Bob")).toBe(false);
      expect(allowed("User:Alice Smith")).toBe(false);
      expect(allowed("User:Alice", unlinked)).toBe(false);
    });

    it("cannot edit user script, style or data subpages, even their own", () => {
      expect(allowed("User:Alice/common.js")).toBe(false);
      expect(allowed("User:Alice/vector.css")).toBe(false);
      expect(allowed("User:Alice/data.JSON")).toBe(false);
      expect(allowed("User:Bob/common.js")).toBe(false);
    });
  });

  describe("checkEditPolicy: wiki admins", () => {
    it.each([
      "Caphiria",
      "Template:Infobox country",
      "Module:Foo",
      "MediaWiki:Common.js",
      "Category:Nations",
      "File:Flag.png",
      "IxWiki:Policy",
      "User:Bob/common.js",
    ])("can edit %s", (title) => {
      expect(allowed(title, admin)).toBe(true);
    });
  });

  describe("checkEditPolicy: sysop versus interface-admin (plan 409)", () => {
    it.each([
      "Template:Infobox country",
      "Module:Foo",
      "MediaWiki:Sidebar",
      "MediaWiki talk:Sidebar",
      "Help:Editing",
      "Category:Nations",
      "File:Flag.png",
      "IxWiki:Policy",
      "User:Bob",
    ])("sysop can edit %s", (title) => {
      expect(allowed(title, sysop)).toBe(true);
    });

    it.each([
      "MediaWiki:Common.css",
      "MediaWiki:Common.js",
      "MediaWiki:Gadgets.json",
      "MediaWiki:Theme.less",
      "User:Bob/common.js",
      "User:Bob/vector.css",
      "User:Bob/data.json",
    ])("sysop alone cannot edit the interface page %s", (title) => {
      expect(allowed(title, sysop)).toBe(false);
    });

    it("asks for the right that matches the kind of interface page", () => {
      const only = (right: Right) => ({
        rights: new Set<Right>(["edit", right]),
        ownUserNames: [],
      });
      expect(allowed("MediaWiki:Common.css", only("editsitecss"))).toBe(true);
      expect(allowed("MediaWiki:Common.js", only("editsitecss"))).toBe(false);
      expect(allowed("MediaWiki:Common.js", only("editsitejs"))).toBe(true);
      expect(allowed("MediaWiki:Data.json", only("editsitejson"))).toBe(true);
      expect(allowed("MediaWiki:Sidebar", only("editsitejs"))).toBe(false);
      expect(allowed("MediaWiki:Sidebar", only("editinterface"))).toBe(true);
      expect(allowed("User:Bob/common.js", only("edituserjs"))).toBe(true);
      expect(allowed("User:Bob/common.js", only("editsitejs"))).toBe(false);
      expect(allowed("User:Bob/vector.css", only("editusercss"))).toBe(true);
    });

    it("lets interface-admin edit script pages but not other namespaces", () => {
      expect(allowed("MediaWiki:Common.js", interfaceAdmin)).toBe(true);
      expect(allowed("MediaWiki:Sidebar", interfaceAdmin)).toBe(true);
      expect(allowed("User:Bob/common.js", interfaceAdmin)).toBe(true);
      expect(allowed("Template:Foo", interfaceAdmin)).toBe(false);
      expect(allowed("User:Bob", interfaceAdmin)).toBe(false);
    });

    it("still lets the owner of a name edit their own text pages but not their own scripts", () => {
      expect(allowed("User:Alice/Notes", user)).toBe(true);
      expect(allowed("User:Alice/common.js", user)).toBe(false);
      expect(allowed("User:Alice/common.js", { ...user, rights: adminRights })).toBe(true);
    });
  });
});

describe("protection levels", () => {
  const NOW = new Date("2026-09-27T12:00:00Z");
  const PAST = new Date("2026-09-01T00:00:00Z");
  const FUTURE = new Date("2026-12-01T00:00:00Z");

  const who = (groups: Group[]): WikiPermissions => ({
    groups,
    rights: rightsForGroups(groups),
    block: null,
    ownUserNames: [],
  });

  const plain = who(["*", "user"]);
  // The legacy `User.wikiUsername` column grants nothing: such a user is just a plain user.
  const legacyUsername = who(["*", "user"]);
  // An autoconfirmed user (WikiOS's own rule: old enough, enough edits).
  const verified = who(["*", "user", "autoconfirmed"]);
  const admin = who(["*", "user", "sysop"]);
  const anonymous = who(["*"]);

  const restriction = (level: string, expiresAt: Date | null = null): PageRestriction[] => [
    { action: "edit", level, expiresAt },
  ];

  describe("page protection (edit restrictions)", () => {
    it.each([
      ["new page, signed in", "create", [], plain, true],
      ["unprotected, signed in", "edit", [], plain, true],
      ["unprotected, anonymous", "edit", [], anonymous, false],
      [
        "autoconfirmed level, no verified account",
        "edit",
        restriction("autoconfirmed"),
        plain,
        false,
      ],
      [
        "autoconfirmed level, legacy wikiUsername but no verified account",
        "edit",
        restriction("autoconfirmed"),
        legacyUsername,
        false,
      ],
      [
        "autoconfirmed level, verified account",
        "edit",
        restriction("autoconfirmed"),
        verified,
        true,
      ],
      ["autoconfirmed level, admin", "edit", restriction("autoconfirmed"), admin, true],
      ["sysop level, verified non-admin", "edit", restriction("sysop"), verified, false],
      ["sysop level, admin", "edit", restriction("sysop"), admin, true],
      [
        "legacy PROTECTED level, verified non-admin",
        "edit",
        restriction("PROTECTED"),
        verified,
        false,
      ],
      ["legacy PROTECTED level, admin", "edit", restriction("PROTECTED"), admin, true],
      ["unknown level fails closed", "edit", restriction("SOMETHING_NEW"), verified, false],
      ["unknown level, admin", "edit", restriction("SOMETHING_NEW"), admin, true],
      [
        "expired sysop level counts as unprotected",
        "edit",
        restriction("sysop", PAST),
        plain,
        true,
      ],
      ["unexpired sysop level", "edit", restriction("sysop", FUTURE), plain, false],
    ] as const)("%s", (_label, action, restrictions, permissions, expected) => {
      const decision = decideAction({
        action,
        title: "Caphiria",
        permissions,
        restrictions: [...restrictions],
        now: NOW,
      });
      expect(decision.allowed).toBe(expected);
    });
  });
});
