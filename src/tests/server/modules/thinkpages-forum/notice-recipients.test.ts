/** @jest-environment node */
import {
  readableUsers,
  type NoticePlace,
} from "~/server/modules/thinkpages-forum/notice-recipients";

const role = { name: "user", level: 100 };
const user = (id: string, over: object = {}) => ({
  id,
  clerkUserId: `clerk_${id}`,
  countryId: null,
  role,
  ...over,
});
const admin = user("u_admin", { role: { name: "admin", level: 10 } });
const plain = user("u_plain");
const author = user("u_author");
const founder = user("u_founder");

const db = {
  realm: { findMany: jest.fn(async () => []) },
  realmOfficer: { findMany: jest.fn(async () => []) },
  forumCategoryModerator: { findMany: jest.fn(async () => []) },
};
const category = (visibility: string) => ({ id: "cat", scope: "site", realmId: null, visibility });
const place = (over: Partial<NoticePlace> = {}): NoticePlace => ({
  thread: { authorUserId: "u_author", hidden: false },
  category: category("public"),
  realm: null,
  ...over,
});
const ids = async (p: NoticePlace, users = [admin, plain, author, founder]) =>
  (await readableUsers(db as never, p, users)).map((u) => u.id);

describe("readableUsers", () => {
  it("lets everyone read a public thread, without a role lookup", async () => {
    expect(await ids(place())).toEqual(["u_admin", "u_plain", "u_author", "u_founder"]);
    expect(db.realm.findMany).not.toHaveBeenCalled();
  });

  it("tells nobody about a hidden thread, moderators included", async () => {
    expect(await ids(place({ thread: { authorUserId: "u_author", hidden: true } }))).toEqual([]);
  });

  it("keeps a staff board to site admins", async () => {
    expect(await ids(place({ category: category("staff") }))).toEqual(["u_admin"]);
  });

  it("keeps a Reports thread to its author and the people who moderate it", async () => {
    expect(await ids(place({ category: category("reporter_staff") }))).toEqual([
      "u_admin",
      "u_author",
    ]);
  });

  it("hides a draft realm from everyone but its founder and site admins", async () => {
    const draft = {
      id: "r1",
      slug: "draft",
      name: "Draft",
      status: "draft",
      ownerId: "clerk_u_founder",
    };
    const inRealm = place({
      category: { id: "cat", scope: "realm", realmId: "r1", visibility: "public" },
      realm: draft,
    });
    expect(await ids(inRealm)).toEqual(["u_admin", "u_founder"]);
    const open = { ...draft, status: "active" };
    expect(await ids({ ...inRealm, realm: open })).toEqual([
      "u_admin",
      "u_plain",
      "u_author",
      "u_founder",
    ]);
  });

  describe("who moderates, looked up for the whole list", () => {
    const modDb = (over: { founded?: string[]; officers?: string[]; moderators?: string[] }) => ({
      realm: {
        findMany: jest.fn(async (_args: object) =>
          (over.founded ?? []).map((ownerId) => ({ ownerId }))
        ),
      },
      realmOfficer: {
        findMany: jest.fn(async (_args: object) =>
          (over.officers ?? []).map((userId) => ({ userId }))
        ),
      },
      forumCategoryModerator: {
        findMany: jest.fn(async (_args: object) =>
          (over.moderators ?? []).map((userId) => ({ userId }))
        ),
      },
    });
    const reports = (realmId: string | null) =>
      place({
        category: {
          id: "cat",
          scope: realmId ? "realm" : "site",
          realmId,
          visibility: "reporter_staff",
        },
      });
    const users = [plain, author, founder];

    it("lets a category moderator, a realm founder and a board officer read a Reports thread", async () => {
      const mods = modDb({ founded: ["clerk_u_founder"], officers: ["clerk_u_plain"] });
      const readable = await readableUsers(mods as never, reports("r1"), users);
      expect(readable.map((u) => u.id)).toEqual(["u_plain", "u_author", "u_founder"]);
      const catMods = modDb({ moderators: ["u_plain"] });
      expect(
        (await readableUsers(catMods as never, reports(null), users)).map((u) => u.id)
      ).toEqual(["u_plain", "u_author"]);
    });
  });
});
