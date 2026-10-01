/** @jest-environment node */
// Plan 409: authorizeAction / decideAction (block, namespace, protection, the action's own right).
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiAccountLink: { findFirst: jest.fn() },
    wikiUserGroup: { findMany: jest.fn() },
    wikiBlock: { findMany: jest.fn() },
    wikiRevision: { count: jest.fn() },
    wikiRestriction: { findMany: jest.fn() },
  },
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
}));

import {
  assertPageVisible,
  authorizeAction,
  decideAction,
  decideFilePageCreation,
  importVerdict,
  requireCanonicalTitle,
  requireGroupChange,
  requireRight,
  requireUploadTitle,
  refusals,
  rightForLevel,
  type ActionDecision,
  type PageRestriction,
  type WikiAction,
} from "~/lib/wiki-os/permissions";
import {
  rightsForGroups,
  type ActiveBlock,
  type Group,
  type WikiPermissions,
} from "~/lib/wiki-os/rights";
import { db } from "~/server/db";

const NOW = new Date("2026-09-30T12:00:00Z");
const PAST = new Date("2026-09-01T00:00:00Z");
const FUTURE = new Date("2026-12-01T00:00:00Z");

const perms = (
  groups: Group[],
  extra: { block?: ActiveBlock | null; verified?: string | null } = {}
): WikiPermissions => ({
  groups,
  rights: rightsForGroups(groups),
  block: extra.block ?? null,
  verifiedWikiUsername: extra.verified ?? null,
});

const plain = perms(["*", "user"]);
const autoconfirmed = perms(["*", "user", "autoconfirmed"], { verified: "Alice" });
const sysop = perms(["*", "user", "sysop"]);
const interfaceAdmin = perms(["*", "user", "interface-admin"]);
const owner = perms(["*", "user", "sysop", "bureaucrat", "interface-admin"]);
const anonymous = perms(["*"]);

const restriction = (
  action: string,
  level: string,
  expiresAt: Date | null = null
): PageRestriction => ({ action, level, expiresAt });

const decide = (
  who: WikiPermissions,
  action: WikiAction,
  title: string,
  restrictions: PageRestriction[] = []
): ActionDecision => decideAction({ action, title, permissions: who, restrictions, now: NOW });

const isAllowed = (...args: Parameters<typeof decide>) => decide(...args).allowed;
const denialCode = (...args: Parameters<typeof decide>) => {
  const decision = decide(...args);
  return decision.allowed ? null : decision.code;
};

describe("decideAction: blocks", () => {
  const block = (overrides: Partial<ActiveBlock> = {}): ActiveBlock => ({
    reason: "vandalism",
    expiresAt: null,
    allowUserTalk: true,
    ...overrides,
  });

  it("refuses every action to a blocked user, with the reason", () => {
    const blocked = perms(["*", "user", "autoconfirmed"], { block: block(), verified: "Alice" });
    for (const action of ["edit", "create", "move", "rollback", "upload"] as const) {
      expect(denialCode(blocked, action, "Caphiria")).toBe("blocked");
    }
    const decision = decide(blocked, "edit", "Caphiria");
    expect(decision.allowed === false && decision.reason).toContain("vandalism");
  });

  it("blocks a sysop too", () => {
    expect(
      denialCode(perms(["*", "user", "sysop"], { block: block() }), "delete", "Caphiria")
    ).toBe("blocked");
  });

  it("lets a blocked user edit their own user talk page when the block allows it", () => {
    const blocked = perms(["*", "user"], { block: block(), verified: "Alice" });
    expect(isAllowed(blocked, "edit", "User talk:Alice")).toBe(true);
    expect(isAllowed(blocked, "create", "User talk:Alice/Appeal")).toBe(true);
    expect(denialCode(blocked, "edit", "User talk:Bob")).toBe("blocked");
    expect(denialCode(blocked, "edit", "Talk:Caphiria")).toBe("blocked");
    expect(denialCode(blocked, "edit", "User:Alice")).toBe("blocked");
    expect(denialCode(blocked, "move", "User talk:Alice")).toBe("blocked");
  });

  it("refuses the user talk exception when the block forbids it or no wiki account is verified", () => {
    const noTalk = perms(["*", "user"], {
      block: block({ allowUserTalk: false }),
      verified: "Alice",
    });
    expect(denialCode(noTalk, "edit", "User talk:Alice")).toBe("blocked");
    const unverified = perms(["*", "user"], { block: block(), verified: null });
    expect(denialCode(unverified, "edit", "User talk:Alice")).toBe("blocked");
  });
});

describe("decideAction: namespaces (D9)", () => {
  it.each([
    "Template:Infobox country",
    "Module:Foo",
    "MediaWiki:Sidebar",
    "MediaWiki:Common.css",
    "Help:Editing",
    "IxWiki:Policy",
    "File:Flag.png",
    "Category:Nations",
    "Gadget:Foo",
    "Widget:Foo",
    "User:Bob",
  ])("denies %s to a plain autoconfirmed user and allows it to a sysop", (title) => {
    expect(denialCode(autoconfirmed, "edit", title)).toBe("namespaceprotected");
    expect(denialCode(autoconfirmed, "create", title)).toBe("namespaceprotected");
    const allowedForSysop = !/\.(css|js|json)$/.test(title);
    expect(isAllowed(sysop, "edit", title)).toBe(allowedForSysop);
  });

  it("lets anyone signed in edit articles and talk pages", () => {
    expect(isAllowed(plain, "edit", "Caphiria")).toBe(true);
    expect(isAllowed(plain, "edit", "Talk:Caphiria")).toBe(true);
    expect(isAllowed(plain, "edit", "User talk:Bob")).toBe(true);
  });

  it("needs interface-admin for site CSS, JS and JSON", () => {
    for (const title of ["MediaWiki:Common.css", "MediaWiki:Common.js", "MediaWiki:Data.json"]) {
      expect(denialCode(sysop, "edit", title)).toBe("namespaceprotected");
      expect(isAllowed(interfaceAdmin, "edit", title)).toBe(true);
      expect(isAllowed(owner, "edit", title)).toBe(true);
    }
  });

  it("lets a verified owner edit their own user page, but never a script subpage of it", () => {
    expect(isAllowed(autoconfirmed, "edit", "User:Alice")).toBe(true);
    expect(isAllowed(autoconfirmed, "edit", "User:Alice/Notes")).toBe(true);
    expect(denialCode(autoconfirmed, "edit", "User:Alice/common.js")).toBe("namespaceprotected");
    expect(denialCode(plain, "edit", "User:Alice")).toBe("namespaceprotected");
  });

  it("never lets anyone edit Special or Media pages", () => {
    expect(denialCode(owner, "edit", "Special:Version")).toBe("namespaceprotected");
    expect(denialCode(owner, "delete", "Media:Foo.png")).toBe("namespaceprotected");
  });

  it("applies the namespace policy to admin actions too", () => {
    expect(isAllowed(sysop, "delete", "Template:Foo")).toBe(true);
    expect(denialCode(sysop, "delete", "MediaWiki:Common.js")).toBe("namespaceprotected");
    expect(isAllowed(interfaceAdmin, "delete", "MediaWiki:Common.js")).toBe(false); // no delete right
  });

  it("does not hold an upload to the File: edit policy", () => {
    expect(denialCode(autoconfirmed, "edit", "File:Flag.png")).toBe("namespaceprotected");
    expect(isAllowed(autoconfirmed, "upload", "File:Flag.png")).toBe(true);
  });
});

describe("decideAction: page protection", () => {
  it("separates create-protection from edit-protection", () => {
    const createOnly = [restriction("create", "sysop")];
    expect(denialCode(plain, "create", "Caphiria", createOnly)).toBe("titleprotected");
    expect(isAllowed(plain, "edit", "Caphiria", createOnly)).toBe(true);
    expect(isAllowed(sysop, "create", "Caphiria", createOnly)).toBe(true);

    const editOnly = [restriction("edit", "sysop")];
    expect(denialCode(plain, "edit", "Caphiria", editOnly)).toBe("protectedpage");
    // restriction rows outlive a delete, so creating over an edit-protected title is held too
    expect(denialCode(plain, "create", "Caphiria", editOnly)).toBe("protectedpage");
    expect(isAllowed(sysop, "edit", "Caphiria", editOnly)).toBe(true);
  });

  it("asks autoconfirmed for an autoconfirmed-level protection and sysop for a sysop-level one", () => {
    const semi = [restriction("edit", "autoconfirmed")];
    expect(denialCode(plain, "edit", "Caphiria", semi)).toBe("protectedpage");
    expect(isAllowed(autoconfirmed, "edit", "Caphiria", semi)).toBe(true);
    expect(isAllowed(sysop, "edit", "Caphiria", semi)).toBe(true);

    const full = [restriction("edit", "sysop")];
    expect(denialCode(autoconfirmed, "edit", "Caphiria", full)).toBe("protectedpage");
    expect(isAllowed(sysop, "edit", "Caphiria", full)).toBe(true);
  });

  it("fails closed on a level it does not know", () => {
    const odd = [restriction("edit", "SOMETHING_NEW")];
    expect(denialCode(autoconfirmed, "edit", "Caphiria", odd)).toBe("protectedpage");
    expect(isAllowed(sysop, "edit", "Caphiria", odd)).toBe(true);
    expect(rightForLevel("SOMETHING_NEW")).toBe("editprotected");
  });

  it("ignores an expired protection and honours a current one", () => {
    expect(isAllowed(plain, "edit", "Caphiria", [restriction("edit", "sysop", PAST)])).toBe(true);
    expect(denialCode(plain, "edit", "Caphiria", [restriction("edit", "sysop", FUTURE)])).toBe(
      "protectedpage"
    );
  });

  it("holds each action to its own protection", () => {
    const moveOnly = [restriction("move", "sysop")];
    expect(denialCode(autoconfirmed, "move", "Caphiria", moveOnly)).toBe("protectedpage");
    expect(isAllowed(autoconfirmed, "edit", "Caphiria", moveOnly)).toBe(true);
    expect(isAllowed(sysop, "move", "Caphiria", moveOnly)).toBe(true);

    const uploadOnly = [restriction("upload", "sysop")];
    expect(denialCode(autoconfirmed, "upload", "File:Flag.png", uploadOnly)).toBe("protectedpage");
    expect(isAllowed(autoconfirmed, "edit", "Caphiria", uploadOnly)).toBe(true);
  });

  it("lets a sysop delete a protected page and a rollback respect its edit protection", () => {
    const full = [restriction("edit", "sysop")];
    expect(isAllowed(sysop, "delete", "Caphiria", full)).toBe(true);
    expect(isAllowed(perms(["*", "user", "rollbacker"]), "rollback", "Caphiria", [])).toBe(true);
    expect(denialCode(perms(["*", "user", "rollbacker"]), "rollback", "Caphiria", full)).toBe(
      "protectedpage"
    );
  });
});

describe("decideAction: the action's own right", () => {
  it("holds moving and uploading back until autoconfirmed", () => {
    expect(denialCode(plain, "move", "Caphiria")).toBe("permissiondenied");
    expect(isAllowed(autoconfirmed, "move", "Caphiria")).toBe(true);
    expect(denialCode(plain, "upload", "File:Flag.png")).toBe("permissiondenied");
    expect(isAllowed(autoconfirmed, "upload", "File:Flag.png")).toBe(true);
  });

  it.each(["delete", "undelete", "protect", "import"] as const)("keeps %s for sysops", (action) => {
    expect(denialCode(autoconfirmed, action, "Caphiria")).toBe("permissiondenied");
    expect(isAllowed(sysop, action, "Caphiria")).toBe(true);
  });

  it("needs the rollback right (and edit) to roll back", () => {
    expect(denialCode(plain, "rollback", "Caphiria")).toBe("permissiondenied");
    expect(isAllowed(perms(["*", "user", "rollbacker"]), "rollback", "Caphiria")).toBe(true);
    expect(isAllowed(sysop, "rollback", "Caphiria")).toBe(true);
    expect(denialCode(perms(["*", "rollbacker"]), "rollback", "Caphiria")).toBe("permissiondenied");
  });

  it("refuses a signed-out caller, even on an open namespace", () => {
    expect(denialCode(anonymous, "edit", "Caphiria")).toBe("permissiondenied");
    expect(denialCode(anonymous, "create", "Caphiria")).toBe("permissiondenied");
  });

  it("asks for createtalk to create a talk page and createpage for any other page", () => {
    const noCreatePage = {
      ...plain,
      rights: new Set([...plain.rights].filter((right) => right !== "createpage")),
    };
    expect(isAllowed(noCreatePage, "create", "Talk:Caphiria")).toBe(true);
    expect(denialCode(noCreatePage, "create", "Caphiria")).toBe("permissiondenied");
    expect(isAllowed(noCreatePage, "edit", "Caphiria")).toBe(true);

    const noCreateTalk = {
      ...plain,
      rights: new Set([...plain.rights].filter((right) => right !== "createtalk")),
    };
    expect(denialCode(noCreateTalk, "create", "Talk:Caphiria")).toBe("permissiondenied");
    expect(isAllowed(noCreateTalk, "create", "Caphiria")).toBe(true);
  });

  it("lets the owner do everything", () => {
    for (const action of [
      "edit",
      "create",
      "move",
      "delete",
      "undelete",
      "protect",
      "rollback",
      "upload",
      "import",
    ] as const) {
      expect(isAllowed(owner, action, "MediaWiki:Common.js")).toBe(true);
    }
    expect(isAllowed(owner, "protect", "Template:Foo", [restriction("edit", "sysop")])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// authorizeAction / requireRight: the database-backed entry points
// ---------------------------------------------------------------------------

const mockDb = db as unknown as {
  wikiAccountLink: { findFirst: jest.Mock };
  wikiUserGroup: { findMany: jest.Mock };
  wikiBlock: { findMany: jest.Mock };
  wikiRevision: { count: jest.Mock };
  wikiRestriction: { findMany: jest.Mock };
};

const ctx = (clerk = "user_1") => ({
  auth: { userId: clerk },
  user: {
    id: "db1",
    clerkUserId: clerk,
    role: { name: "user" },
    createdAt: new Date("2026-01-01"),
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.wikiAccountLink.findFirst.mockResolvedValue(null);
  mockDb.wikiUserGroup.findMany.mockResolvedValue([]);
  mockDb.wikiBlock.findMany.mockResolvedValue([]);
  mockDb.wikiRevision.count.mockResolvedValue(0);
  mockDb.wikiRestriction.findMany.mockResolvedValue([]);
});

describe("authorizeAction", () => {
  it("resolves for an allowed action", async () => {
    await expect(authorizeAction(ctx(), "edit", "Caphiria")).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN with the reason code first in the message", async () => {
    await expect(authorizeAction(ctx(), "edit", "Template:Foo")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/^namespaceprotected: /),
    });
    await expect(authorizeAction(ctx(), "delete", "Caphiria")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/^permissiondenied: /),
    });
  });

  it("loads the page's restrictions by canonical title, whatever spelling was sent", async () => {
    mockDb.wikiRestriction.findMany.mockResolvedValue([
      { action: "edit", level: "sysop", expiresAt: null },
    ]);
    await expect(authorizeAction(ctx(), "edit", "foo_bar")).rejects.toMatchObject({
      message: expect.stringMatching(/^protectedpage: /),
    });
    expect(mockDb.wikiRestriction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { source: "ixwiki", title: "Foo bar" } })
    );
  });

  it("does not look up protections for an action they cannot hold back", async () => {
    await authorizeAction(ctx("user_owner"), "delete", "Caphiria");
    expect(mockDb.wikiRestriction.findMany).not.toHaveBeenCalled();
  });

  it("refuses a blocked caller before anything else", async () => {
    mockDb.wikiBlock.findMany.mockResolvedValue([
      { reason: "spam", expiresAt: null, allowUserTalk: false },
    ]);
    await expect(authorizeAction(ctx(), "edit", "Caphiria")).rejects.toMatchObject({
      message: expect.stringMatching(/^blocked: .*spam/),
    });
  });

  it("lets a sysop through what a plain user cannot", async () => {
    mockDb.wikiUserGroup.findMany.mockResolvedValue([{ group: "sysop", expiresAt: null }]);
    await expect(authorizeAction(ctx(), "edit", "Template:Foo")).resolves.toBeUndefined();
    await expect(authorizeAction(ctx(), "protect", "Template:Foo")).resolves.toBeUndefined();
  });

  it("refuses a title MediaWiki would refuse", async () => {
    await expect(authorizeAction(ctx(), "edit", "a[b")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("requireGroupChange", () => {
  it("lets a bureaucrat change the groups on the changeable list only", async () => {
    await expect(requireGroupChange(ctx("user_owner"), ["sysop", "bot"])).resolves.toBeUndefined();
    await expect(
      requireGroupChange(ctx("user_owner"), ["sysop", "rollbacker"])
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/^permissiondenied: .*rollbacker/),
    });
  });

  it("refuses a caller without the userrights right", async () => {
    mockDb.wikiUserGroup.findMany.mockResolvedValue([{ group: "sysop", expiresAt: null }]);
    await expect(requireGroupChange(ctx(), ["bot"])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("requireRight and requireCanonicalTitle", () => {
  it("requires the right and hands back the caller's permissions", async () => {
    await expect(requireRight(ctx(), "block")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/^permissiondenied: /),
    });
    const permissions = await requireRight(ctx("user_owner"), "userrights");
    expect(permissions.groups).toContain("bureaucrat");
  });

  it("canonicalizes a title or refuses it", () => {
    expect(requireCanonicalTitle("user_talk:jane")).toBe("User talk:Jane");
    expect(() => requireCanonicalTitle("a[b")).toThrow("That page title is not valid.");
  });
});

describe("assertPageVisible", () => {
  it("lets everyone see a published page, and a page that does not exist is not its business", async () => {
    await expect(
      assertPageVisible(ctx(), { status: "PUBLISHED" }, "Caphiria")
    ).resolves.toBeUndefined();
    await expect(assertPageVisible(ctx(), null, "Caphiria")).resolves.toBeUndefined();
    expect(mockDb.wikiUserGroup.findMany).not.toHaveBeenCalled();
  });

  it("hides a deleted page from anyone without deletedhistory", async () => {
    await expect(
      assertPageVisible(ctx(), { status: "ARCHIVED" }, "Caphiria")
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      assertPageVisible({ auth: null, user: null }, { status: "ARCHIVED" }, "Caphiria")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("shows a deleted page to a sysop", async () => {
    mockDb.wikiUserGroup.findMany.mockResolvedValue([{ group: "sysop", expiresAt: null }]);
    await expect(
      assertPageVisible(ctx(), { status: "ARCHIVED" }, "Caphiria")
    ).resolves.toBeUndefined();
  });
});

describe("importVerdict (per-page authorization of a dump)", () => {
  const verdict = (who: WikiPermissions, title: string, namespaceId: number) =>
    importVerdict(who, title, namespaceId);

  it.each([
    ["Caphiria", 0],
    ["Talk:Caphiria", 1],
    ["Template:Infobox", 10],
    ["Module:Foo", 828],
    ["MediaWiki:Sidebar", 8],
    ["Help:Editing", 12],
  ])("lets a sysop import %s", (title, ns) => {
    expect(verdict(sysop, title, ns).allowed).toBe(true);
  });

  it.each([
    ["MediaWiki:Common.js", 8],
    ["MediaWiki:Common.css", 8],
    ["MediaWiki:Gadgets.json", 8],
    ["User:Bob/common.js", 2],
    ["User:Bob/vector.css", 2],
  ])("keeps %s from a sysop and gives it to an interface administrator", (title, ns) => {
    const refused = verdict(sysop, title, ns);
    expect(refused.allowed).toBe(false);
    expect(verdict(owner, title, ns).allowed).toBe(true);
  });

  it("names the right that is missing", () => {
    const refused = verdict(sysop, "MediaWiki:Common.js", 8);
    expect(refused).toEqual({
      allowed: false,
      reason: "Editing this MediaWiki page needs the editsitejs right.",
    });
  });

  it("refuses everything to a blocked importer, and Special: pages to everyone", () => {
    const blocked = perms(["*", "user", "sysop"], {
      block: { reason: "spam", expiresAt: null, allowUserTalk: true },
    });
    expect(verdict(blocked, "Caphiria", 0).allowed).toBe(false);
    expect(verdict(owner, "Special:Version", -1).allowed).toBe(false);
  });

  it("leaves a namespace this wiki does not know (the dump's own prefix) to administrators", () => {
    expect(verdict(perms(["*", "user", "bot"]), "Portal:Testia", 100)).toMatchObject({
      allowed: false,
      reason: "Only wiki administrators can import pages in this namespace.",
    });
    expect(verdict(sysop, "Portal:Testia", 100).allowed).toBe(true);
  });
});

describe("requireUploadTitle (the name MediaWiki stores an upload under)", () => {
  it.each([
    ["Flag.png", "File:Flag.png"],
    ["flag of testia.png", "File:Flag of testia.png"],
    ["pics/2026/Flag.png", "File:Flag.png"],
    ["C:\\pics\\Flag.png", "File:Flag.png"],
    ["../../../Flag.png", "File:Flag.png"],
    ["Template:Flag.png", "File:Template-Flag.png"],
    ["MediaWiki:Common.js", "File:MediaWiki-Common.js"],
    ["Module:Foo", "File:Module-Foo"],
    ["File:Flag.png", "File:File-Flag.png"],
    ["a[b]{c}|d#e.png", "File:A-b--c--d-e.png"],
    ["  Flag.png  ", "File:Flag.png"],
  ])("%s becomes %s", (raw, title) => {
    expect(requireUploadTitle(raw)).toBe(title);
  });

  it.each(["", "dir/", "dir\\", "a%41.png"])("refuses %p", (raw) => {
    expect(() => requireUploadTitle(raw)).toThrow("That page title is not valid.");
  });

  it("never lands in another namespace, whatever the name says", () => {
    for (const raw of [
      "Template:X.png",
      "User:Bob/x.png",
      "MediaWiki:Common.js",
      "Special:Upload",
    ]) {
      expect(requireUploadTitle(raw).startsWith("File:")).toBe(true);
    }
  });
});

describe("an upload is held by the File: page's edit protection too", () => {
  const editProtected = [restriction("edit", "sysop")];

  it("refuses an autoconfirmed uploader, lets a sysop, and ignores an expired one", () => {
    expect(denialCode(autoconfirmed, "upload", "File:Flag.png", editProtected)).toBe(
      "protectedpage"
    );
    expect(isAllowed(sysop, "upload", "File:Flag.png", editProtected)).toBe(true);
    expect(
      isAllowed(autoconfirmed, "upload", "File:Flag.png", [restriction("edit", "sysop", PAST)])
    ).toBe(true);
  });
});

describe("decideFilePageCreation (the File: page an upload creates)", () => {
  const decideCreation = (who: WikiPermissions, restrictions: PageRestriction[] = []) =>
    decideFilePageCreation({ title: "File:Flag.png", permissions: who, restrictions, now: NOW });

  it("needs edit and createpage, and ignores the namespace rule that keeps File: pages to administrators", () => {
    expect(decideCreation(plain)).toEqual({ allowed: true });
    expect(decideCreation(autoconfirmed)).toEqual({ allowed: true });
    expect(decideCreation(anonymous)).toMatchObject({ allowed: false, code: "permissiondenied" });
    // the same account may not write that page by hand
    expect(decide(plain, "create", "File:Flag.png")).toMatchObject({
      allowed: false,
      code: "namespaceprotected",
    });
  });

  it("is held by create protection (a salted title) and by edit protection, until it expires", () => {
    expect(decideCreation(autoconfirmed, [restriction("create", "sysop")])).toMatchObject({
      allowed: false,
      code: "titleprotected",
    });
    expect(decideCreation(autoconfirmed, [restriction("edit", "sysop")])).toMatchObject({
      allowed: false,
      code: "protectedpage",
    });
    expect(decideCreation(sysop, [restriction("create", "sysop")])).toEqual({ allowed: true });
    expect(decideCreation(autoconfirmed, [restriction("create", "sysop", PAST)])).toEqual({
      allowed: true,
    });
  });

  it("is refused to a blocked user", () => {
    const blocked = perms(["*", "user"], {
      block: { reason: "vandalism", expiresAt: null, allowUserTalk: true } as ActiveBlock,
    });
    expect(decideCreation(blocked)).toMatchObject({ allowed: false, code: "blocked" });
  });
});

describe("refusals", () => {
  it("maps a page-service refusal to the TRPC code of the same name and passes anything else through", async () => {
    const { PageOperationError } = jest.requireActual<
      typeof import("~/lib/wiki-os/core/page-management-service")
    >("~/lib/wiki-os/core/page-management-service");
    for (const code of ["NOT_FOUND", "CONFLICT", "BAD_REQUEST"] as const) {
      await expect(
        refusals(Promise.reject(new PageOperationError(code, "no")))
      ).rejects.toMatchObject({
        code,
        message: "no",
      });
    }
    await expect(refusals(Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(refusals(Promise.resolve(7))).resolves.toBe(7);
  });
});
