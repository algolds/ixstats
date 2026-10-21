/** @jest-environment node */
import {
  roleContextOf,
  roleOf,
  threadLastPosters,
  threadParticipants,
  type RoleContext,
} from "~/server/modules/thinkpages-forum/thread-extras";

const ctx = (over: Partial<RoleContext> = {}): RoleContext => ({
  staffUserIds: new Set(),
  officerUserIds: new Set(),
  starterUserId: null,
  starterPersonaId: null,
  ...over,
});
const player = (id: string) => ({ authorUserId: id, authorPersonaId: null });
describe("roleOf", () => {
  it("gives imported posts without an account no role", () => {
    const c = ctx({ starterUserId: "u1" });
    expect(roleOf({ authorUserId: null, authorPersonaId: null }, c)).toBeNull();
  });

  it("never gives a player's staff, officer or starter pill to a persona post", () => {
    const c = ctx({
      staffUserIds: new Set(["u1"]),
      officerUserIds: new Set(["u1"]),
      starterUserId: "u1",
      starterPersonaId: null,
    });
    expect(roleOf({ authorUserId: "u1", authorPersonaId: "pa1" }, c)).toBeNull();
  });

  it("marks a persona post as starter only when it is the thread's own persona", () => {
    const c = ctx({ starterUserId: "u1", starterPersonaId: "pa1" });
    expect(roleOf({ authorUserId: "u1", authorPersonaId: "pa1" }, c)).toBe("starter");
    expect(roleOf({ authorUserId: "u1", authorPersonaId: "pa2" }, c)).toBeNull();
    // The player's own post in a persona thread is not the starter (the thread has a persona).
    expect(roleOf(player("u1"), c)).toBeNull();
  });
});

describe("roleContextOf", () => {
  const users = [
    { id: "u_admin", clerkUserId: "c_admin", role: { name: "admin", level: 10 } },
    { id: "u_off", clerkUserId: "c_off", role: { name: "user", level: 100 } },
    { id: "u_plain", clerkUserId: "c_plain", role: null },
  ];
  const fakeDb = (officers: string[] = ["c_off"]) => ({
    user: { findMany: jest.fn(async (_args: object) => users) },
    realmOfficer: {
      findMany: jest.fn(async ({ where }: { where: { userId: { in: string[] } } }) =>
        where.userId.in.filter((id) => officers.includes(id)).map((userId) => ({ userId }))
      ),
    },
  });
  const thread = { authorUserId: "u_plain", authorPersonaId: null };
  it("never loads the player behind a persona post", async () => {
    const db = fakeDb();
    await roleContextOf(db as never, thread, { scope: "realm", realmId: "r1" }, [
      { authorUserId: "u_admin", authorPersonaId: "pa1" },
      player("u_off"),
    ]);
    expect(db.user.findMany.mock.calls[0]![0]).toMatchObject({ where: { id: { in: ["u_off"] } } });
  });
});

describe("threadParticipants", () => {
  const general = { id: "cat_g", scope: "site", realmId: null, visibility: "public" };
  const member = {
    id: "u_m",
    clerkUserId: "m",
    countryId: null,
    role: { name: "user", level: 100 },
  };
  const admin = {
    id: "u_a",
    clerkUserId: "a",
    countryId: null,
    role: { name: "admin", level: 10 },
  };
  const rows = [
    { authorUserId: "u1", authorPersonaId: null, importedAuthorName: null, _count: { _all: 5 } },
    { authorUserId: "u2", authorPersonaId: "pa1", importedAuthorName: null, _count: { _all: 7 } },
    { authorUserId: "u2", authorPersonaId: null, importedAuthorName: null, _count: { _all: 2 } },
    {
      authorUserId: null,
      authorPersonaId: null,
      importedAuthorName: "OldName",
      _count: { _all: 3 },
    },
  ];
  const fakeDb = () => ({
    forumPost: { groupBy: jest.fn(async (_args: object) => rows) },
  });

  it("groups persona posts under the persona and never under the player", async () => {
    const out = await threadParticipants(fakeDb() as never, member, general, "t1");
    expect(out.top).toEqual([
      { authorUserId: null, authorPersonaId: "pa1", importedAuthorName: null, posts: 7 },
      { authorUserId: "u1", authorPersonaId: null, importedAuthorName: null, posts: 5 },
      { authorUserId: null, authorPersonaId: null, importedAuthorName: "OldName", posts: 3 },
      { authorUserId: "u2", authorPersonaId: null, importedAuthorName: null, posts: 2 },
    ]);
    expect(out.total).toBe(4);
  });

  it("counts only the posts a member can see, and hidden ones too for a moderator", async () => {
    const db = fakeDb();
    await threadParticipants(db as never, member, general, "t1");
    expect(db.forumPost.groupBy.mock.calls[0]![0]).toMatchObject({
      where: { threadId: "t1", hidden: false },
      by: ["authorUserId", "authorPersonaId", "importedAuthorName"],
    });
    await threadParticipants(db as never, admin, general, "t1");
    expect(db.forumPost.groupBy.mock.calls[1]![0]).toMatchObject({ where: { threadId: "t1" } });
    expect((db.forumPost.groupBy.mock.calls[1]![0] as { where: object }).where).not.toHaveProperty(
      "hidden"
    );
  });
});

describe("threadLastPosters", () => {
  const general = { id: "cat_g", scope: "site", realmId: null, visibility: "public" };
  const member = {
    id: "u_m",
    clerkUserId: "m",
    countryId: null,
    role: { name: "user", level: 100 },
  };
  const admin = {
    id: "u_a",
    clerkUserId: "a",
    countryId: null,
    role: { name: "admin", level: 10 },
  };
  const posts = [
    { threadId: "t1", authorUserId: "u1", authorPersonaId: "pa1", importedAuthorName: "Old" },
    { threadId: "t2", authorUserId: "u2", authorPersonaId: null, importedAuthorName: null },
    { threadId: "t3", authorUserId: null, authorPersonaId: null, importedAuthorName: "OldName" },
  ];
  const fakeDb = () => ({ forumPost: { findMany: jest.fn(async (_args: object) => posts) } });
  it("reads hidden posts too for the category's moderator only", async () => {
    const db = fakeDb();
    await threadLastPosters(db as never, admin, general, ["t1"]);
    expect(JSON.stringify(db.forumPost.findMany.mock.calls[0]![0])).not.toContain('"hidden"');
  });

  it("names a persona post by the persona alone, for a member and a moderator alike", async () => {
    for (const viewer of [member, admin]) {
      const out = await threadLastPosters(fakeDb() as never, viewer, general, ["t1", "t2", "t3"]);
      expect(out.get("t1")).toEqual({
        authorUserId: null,
        authorPersonaId: "pa1",
        importedAuthorName: null,
      });
      expect(out.get("t2")).toEqual({
        authorUserId: "u2",
        authorPersonaId: null,
        importedAuthorName: null,
      });
      expect(out.get("t3")).toEqual({
        authorUserId: null,
        authorPersonaId: null,
        importedAuthorName: "OldName",
      });
    }
  });
});
