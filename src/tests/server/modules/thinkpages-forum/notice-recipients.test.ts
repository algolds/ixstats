/** @jest-environment node */
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { createMany: jest.fn() } }));
jest.mock("~/lib/notifications/guard", () => ({ isNotificationEventEnabled: jest.fn() }));

import {
  readableUsers,
  type NoticePlace,
} from "~/server/modules/thinkpages-forum/notice-recipients";
import { memberName } from "~/server/modules/thinkpages-forum/notice-text";
import { privacyConnections, wikiAttributionOff } from "~/tests/helpers/privacy-config-fake";
import { notificationAPI } from "~/lib/notifications/api";
import { isNotificationEventEnabled } from "~/lib/notifications/guard";
import {
  sendForumNotices,
  type ForumNotice,
} from "~/server/modules/thinkpages-forum/forum-notices";

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
});

describe("naming a member in a notice", () => {
  type MemberRow = { handle: string | null; wikiUsername: string | null; clerkUserId: string };
  function memberDb(row: MemberRow | null, connections = privacyConnections()) {
    return {
      user: { findUnique: jest.fn(async (_args: object): Promise<MemberRow | null> => row) },
      userConnection: connections,
    };
  }
  describe("memberName", () => {
    const wikiOnly: MemberRow = { handle: null, wikiUsername: "Wiki Name", clerkUserId: "c1" };
    it("gives the fallback instead of the wiki name with wiki attribution off", async () => {
      const off = privacyConnections(wikiAttributionOff("c1"));
      expect(await memberName(memberDb(wikiOnly, off) as never, "u1", "Member")).toBe("Member");
    });

    it("fails closed: a switch it cannot read gives the fallback", async () => {
      const broken = privacyConnections();
      broken.findMany.mockRejectedValue(new Error("db down"));
      expect(await memberName(memberDb(wikiOnly, broken) as never, "u1", "Member")).toBe("Member");
    });
  });
});

describe("sending the notices", () => {
  const createMany = jest.mocked(notificationAPI.createMany);
  const enabled = jest.mocked(isNotificationEventEnabled);
  const notice = (n: number): ForumNotice => ({
    clerkUserId: `clerk_${n}`,
    title: "Kir mentioned you in Trade talks",
    message: "hello",
    href: "/thinkpages/post/p1",
    priority: "medium",
    metadata: { kind: "mention", postId: "p1", threadId: "t1" },
  });
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    createMany.mockReset();
    createMany.mockResolvedValue([]);
    enabled.mockReset();
    enabled.mockResolvedValue(true);
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());
  describe("sendForumNotices", () => {
    it("checks the admin switch itself, since createMany has no guard, and writes nothing when it is off", async () => {
      enabled.mockResolvedValue(false);
      await expect(sendForumNotices([notice(1)])).resolves.toBe(true);
      expect(enabled).toHaveBeenCalledWith("thinkpages-forumNotification");
      expect(createMany).not.toHaveBeenCalled();
    });
  });
});
