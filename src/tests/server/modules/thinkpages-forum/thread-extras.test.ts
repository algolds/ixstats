/** @jest-environment node */
import { POSTS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { postNumberOf } from "~/lib/thinkpages-forum/numbers";
import {
  roleContextOf,
  roleOf,
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

describe("postNumberOf", () => {
  it("counts from 1 and continues across pages", () => {
    expect(postNumberOf(1, 0)).toBe(1);
    expect(postNumberOf(1, POSTS_PER_PAGE - 1)).toBe(POSTS_PER_PAGE);
    expect(postNumberOf(2, 0)).toBe(POSTS_PER_PAGE + 1);
    expect(postNumberOf(3, 4)).toBe(2 * POSTS_PER_PAGE + 5);
  });
});

describe("roleOf", () => {
  it("ranks staff over officer over starter", () => {
    const all = ctx({
      staffUserIds: new Set(["u1"]),
      officerUserIds: new Set(["u1", "u2"]),
      starterUserId: "u1",
    });
    expect(roleOf(player("u1"), all)).toBe("staff");
    expect(roleOf(player("u2"), all)).toBe("officer");
    const starter = ctx({ officerUserIds: new Set(["u2"]), starterUserId: "u3" });
    expect(roleOf(player("u3"), starter)).toBe("starter");
    expect(roleOf(player("u4"), starter)).toBeNull();
  });

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
    user: { findMany: jest.fn(async () => users) },
    realmOfficer: {
      findMany: jest.fn(async ({ where }: { where: { userId: { in: string[] } } }) =>
        where.userId.in.filter((id) => officers.includes(id)).map((userId) => ({ userId }))
      ),
    },
  });
  const posts = [player("u_admin"), player("u_off"), player("u_plain"), player("u_admin")];
  const thread = { authorUserId: "u_plain", authorPersonaId: null };

  it("finds staff by role and officers of the thread's realm in one query each", async () => {
    const db = fakeDb();
    const out = await roleContextOf(db as never, thread, { scope: "realm", realmId: "r1" }, posts);
    expect([...out.staffUserIds]).toEqual(["u_admin"]);
    expect([...out.officerUserIds]).toEqual(["u_off"]);
    expect(out).toMatchObject({ starterUserId: "u_plain", starterPersonaId: null });
    expect(db.user.findMany).toHaveBeenCalledTimes(1);
    expect(db.user.findMany.mock.calls[0]![0]).toMatchObject({
      where: { id: { in: ["u_admin", "u_off", "u_plain"] } },
    });
    expect(db.realmOfficer.findMany).toHaveBeenCalledTimes(1);
    expect(db.realmOfficer.findMany.mock.calls[0]![0].where).toMatchObject({ realmId: "r1" });
  });

  it("looks up no officers for a sitewide thread", async () => {
    const db = fakeDb();
    const out = await roleContextOf(db as never, thread, { scope: "site", realmId: null }, posts);
    expect(out.officerUserIds.size).toBe(0);
    expect(out.staffUserIds.has("u_admin")).toBe(true);
    expect(db.realmOfficer.findMany).not.toHaveBeenCalled();
  });

  it("never loads the player behind a persona post", async () => {
    const db = fakeDb();
    await roleContextOf(
      db as never,
      thread,
      { scope: "realm", realmId: "r1" },
      [{ authorUserId: "u_admin", authorPersonaId: "pa1" }, player("u_off")]
    );
    expect(db.user.findMany.mock.calls[0]![0]).toMatchObject({ where: { id: { in: ["u_off"] } } });
  });

  it("runs no query when no post has a player author", async () => {
    const db = fakeDb();
    const out = await roleContextOf(db as never, thread, { scope: "realm", realmId: "r1" }, [
      { authorUserId: null, authorPersonaId: null },
    ]);
    expect(out.staffUserIds.size + out.officerUserIds.size).toBe(0);
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.realmOfficer.findMany).not.toHaveBeenCalled();
  });
});

describe("threadParticipants", () => {
  const general = { id: "cat_g", scope: "site", realmId: null, visibility: "public" };
  const member = { id: "u_m", clerkUserId: "m", countryId: null, role: { name: "user", level: 100 } };
  const admin = { id: "u_a", clerkUserId: "a", countryId: null, role: { name: "admin", level: 10 } };
  const rows = [
    { authorUserId: "u1", authorPersonaId: null, importedAuthorName: null, _count: { _all: 5 } },
    { authorUserId: "u2", authorPersonaId: "pa1", importedAuthorName: null, _count: { _all: 7 } },
    { authorUserId: "u2", authorPersonaId: null, importedAuthorName: null, _count: { _all: 2 } },
    { authorUserId: null, authorPersonaId: null, importedAuthorName: "OldName", _count: { _all: 3 } },
  ];
  const fakeDb = () => ({
    forumPost: { groupBy: jest.fn(async (_args: object) => rows) },
  });

  it("groups persona posts under the persona and never under the player", async () => {
    const out = await threadParticipants(fakeDb() as never, member, general, "t1");
    expect(out).toEqual([
      { authorUserId: null, authorPersonaId: "pa1", importedAuthorName: null, posts: 7 },
      { authorUserId: "u1", authorPersonaId: null, importedAuthorName: null, posts: 5 },
      { authorUserId: null, authorPersonaId: null, importedAuthorName: "OldName", posts: 3 },
      { authorUserId: "u2", authorPersonaId: null, importedAuthorName: null, posts: 2 },
    ]);
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
    expect(
      (db.forumPost.groupBy.mock.calls[1]![0] as { where: object }).where
    ).not.toHaveProperty("hidden");
  });

  it("merges one persona's rows and honours the limit", async () => {
    const db = {
      forumPost: {
        groupBy: jest.fn(async () => [
          { authorUserId: "u1", authorPersonaId: "pa1", importedAuthorName: null, _count: { _all: 2 } },
          { authorUserId: "u9", authorPersonaId: "pa1", importedAuthorName: null, _count: { _all: 3 } },
          ...rows,
        ]),
      },
    };
    const out = await threadParticipants(db as never, member, general, "t1", 2);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ authorPersonaId: "pa1", posts: 12, authorUserId: null });
  });
});
