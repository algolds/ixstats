/** @jest-environment node */
/** The admin's name claims procedures (plan A Task 6): the queue, the decisions, the direct link and the name search. */
jest.mock("~/lib/auth", () => ({
  ...jest.requireActual<object>("~/lib/auth"),
  isSystemOwner: jest.fn((clerkUserId: string) => clerkUserId === "owner_1"),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/account-proof", () => ({
  ...jest.requireActual<object>("~/lib/wiki-os/adapters/mediawiki/account-proof"),
  fetchClassicWikiUsers: jest.fn(),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { adminRouter } from "~/server/api/routers/admin";
import { fetchClassicWikiUsers } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(adminRouter);
let db: MemoryPrisma;

const caller = (clerkUserId: string, id: string) =>
  createCaller(
    createMockRouterContext({
      auth: { userId: clerkUserId },
      user: { id, clerkUserId, role: { name: "admin", level: 10 } },
      db,
    }) as never
  );
const admin = () => caller("admin_1", "db_admin");
const systemOwner = () => caller("owner_1", "db_owner");

beforeEach(async () => {
  db = createMemoryPrisma();
  jest.mocked(fetchClassicWikiUsers).mockReset().mockResolvedValue([]);
  for (const [id, clerkUserId] of [
    ["db_admin", "admin_1"],
    ["db_owner", "owner_1"],
    ["p1", "user_p1"],
    ["p2", "user_p2"],
  ])
    await db.user.create({ data: { id, clerkUserId } });
});

const pending = (userId: string, name: string) =>
  db.wikiNameClaim.create({
    data: { userId, name, status: "PENDING", origin: "PLAYER", requestedById: userId },
  });

describe("admin name claims", () => {
  it("lets an administrator who is not a system owner approve a name with imported groups, which stay behind", async () => {
    const claim = await pending("p1", "Foo bar");
    await db.wikiUserGroup.create({
      data: { wikiUsername: "Foo bar", group: "sysop", source: "mw-import" },
    });

    await expect(
      admin().approveNameClaim({ claimId: claim.id, note: "Checked" })
    ).resolves.toMatchObject({
      status: "APPROVED",
      rightsPass: false,
      decisionNote: "Checked",
    });
    expect(await db.wikiNameClaim.findUnique({ where: { id: claim.id } })).toMatchObject({
      decidedById: "db_admin",
    });
  });

  it("passes the groups when a system owner approves", async () => {
    const claim = await pending("p1", "Foo bar");
    await expect(systemOwner().approveNameClaim({ claimId: claim.id })).resolves.toMatchObject({
      rightsPass: true,
    });
  });

  it("refuses to link a name another account holds, as a conflict", async () => {
    await systemOwner().linkLegacyWikiName({ userId: "p2", name: "Foo bar" });

    await expect(
      admin().linkLegacyWikiName({ userId: "p1", name: "foo_bar" })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "That name already belongs to another account.",
    });
  });

  it("rejects and removes claims", async () => {
    const asked = await pending("p1", "Asked");
    await expect(
      admin().rejectNameClaim({ claimId: asked.id, note: " no " })
    ).resolves.toMatchObject({
      status: "REJECTED",
      decisionNote: "no",
    });
    const held = await admin().linkLegacyWikiName({ userId: "p2", name: "Held", mwUserId: 7 });
    await expect(admin().revokeNameClaim({ claimId: held.id })).resolves.toMatchObject({
      status: "REVOKED",
    });
    await expect(admin().revokeNameClaim({ claimId: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lists the pending queue and says whether the viewer is a system owner", async () => {
    await pending("p1", "Foo bar");

    const asOwner = await systemOwner().listNameClaims({});
    expect(asOwner.viewerIsSystemOwner).toBe(true);
    expect(asOwner.items.map((i) => i.name)).toEqual(["Foo bar"]);
    expect(asOwner.nextCursor).toBeNull();
    expect((await admin().listNameClaims({ status: "APPROVED" })).viewerIsSystemOwner).toBe(false);
  });

  it("searches legacy names with MediaWiki's user list and finds accounts to link", async () => {
    jest.mocked(fetchClassicWikiUsers).mockResolvedValue([{ name: "Foo classic", editCount: 3 }]);
    await db.user.update({ where: { id: "p1" }, data: { handle: "foo_player" } });

    const names = await admin().searchLegacyWikiNames({ query: "foo" });
    expect(names.map((n) => n.name)).toEqual(["Foo classic"]);
    expect(fetchClassicWikiUsers).toHaveBeenCalledWith("foo", 20);
    expect((await admin().findNameLinkTargets({ query: "foo" })).map((t) => t.userId)).toEqual([
      "p1",
    ]);
  });

  it("searchWikiUsers answers from the legacy name search, never from User.wikiUsername", async () => {
    await db.lorewardUserStats.create({ data: { username: "Foo bar", totalScore: 12 } });
    const findMany = jest.spyOn(db.user, "findMany");

    await expect(admin().searchWikiUsers({ query: "foo" })).resolves.toEqual([
      { username: "Foo bar", editCount: 12 },
    ]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
